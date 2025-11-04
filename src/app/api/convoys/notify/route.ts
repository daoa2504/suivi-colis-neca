// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { notifyConvoySchema } from "@/lib/validators";
import { Direction as DirectionEnum } from "@prisma/client";

export const runtime = "nodejs";

/* ----------------------------- Helpers utils ----------------------------- */

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function startOfDayUTC(input: string | Date) {
    const d = new Date(input);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function normalizeEmail(raw: string) {
    return (raw || "").trim().toLowerCase();
}

function isValidEmail(e: string) {
    // raisonnable pour filtrage basique (on laisse le provider faire la validation stricte)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sendWithRetry(
    args: Parameters<typeof sendEmailSafe>[0],
    maxAttempts = 5
) {
    let last:
        | Awaited<ReturnType<typeof sendEmailSafe>>
        | undefined;
    for (let i = 0; i < maxAttempts; i++) {
        last = await sendEmailSafe(args);
        if (last.ok) return last;

        // On ne retente que si l'erreur semble transitoire (rate-limit, 5xx, timeout…)
        const msg = last.error || "";
        const transient = /(?:429|rate|throttl|temporar|timeout|5\d\d)/i.test(msg);
        if (!transient) break;

        // Backoff simple (0.6s, 1.2s, 1.8s, …)
        await sleep(600 * (i + 1));
    }
    return last!;
}

/* --------------------------------- Route --------------------------------- */

export async function POST(req: NextRequest) {
    // Auth
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    if (!["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Validation stricte via Zod (ne pas caster !)
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { convoyDate, template, customMessage, direction } = parsed.data;

        // Règles d'accès : l'agent Canada ne notifie QUE NE -> CA
        if (role === "AGENT_CA" && direction !== DirectionEnum.NE_TO_CA) {
            return NextResponse.json(
                { ok: false, error: "AGENT_CA ne peut notifier que NE_TO_CA" },
                { status: 403 }
            );
        }

        // Ici, on interdit complètement l'agent NE de notifier (si c'est ta politique)
        if (role === "AGENT_NE") {
            return NextResponse.json(
                { ok: false, error: "AGENT_NE n'est pas autorisé à notifier des convois" },
                { status: 403 }
            );
        }

        // Normalisation de la date pour la clé composite (date, direction)
        const date = startOfDayUTC(convoyDate);

        // Upsert du convoi (la clé unique composite doit exister en Prisma : @@unique([date, direction], name: "date_direction"))
        const convoy = await prisma.convoy.upsert({
            where: { date_direction: { date, direction } },
            update: {},
            create: { date, direction },
            include: {
                shipments: {
                    select: {
                        id: true,
                        trackingId: true,
                        receiverName: true,
                        receiverEmail: true,
                        notes: true,
                    },
                },
            },
        });

        if (!convoy.shipments.length) {
            return NextResponse.json(
                { ok: false, error: "Aucun colis pour ce convoi" },
                { status: 404 }
            );
        }

        // Sujet / Footer selon sens + template
        const dateStr = convoy.date.toLocaleDateString("fr-CA", { timeZone: "UTC" });
        const subject =
            template === "EN_ROUTE"
                ? direction === DirectionEnum.NE_TO_CA
                    ? "Votre convoi est en route vers le Canada"
                    : "Votre convoi est en route vers le Niger"
                : direction === DirectionEnum.NE_TO_CA
                    ? "Votre convoi est arrivé à la douane (Canada)"
                    : "Votre convoi est arrivé à la douane (Niger)";

        const FOOTER =
            direction === DirectionEnum.NE_TO_CA ? "— Équipe NE → CA" : "— Équipe CA → NE";

        // Construction des destinataires uniques + validation
        type Recipient = {
            email: string;
            id: string;
            trackingId: string;
            receiverName: string;
        };

        const recipientsMap = new Map<string, Recipient>();
        const invalidEmails: Array<{ emailRaw: string; id: string; trackingId: string }> = [];

        for (const s of convoy.shipments) {
            const emailRaw = s.receiverEmail ?? "";
            const email = normalizeEmail(emailRaw);

            if (!email || !isValidEmail(email)) {
                invalidEmails.push({ emailRaw, id: s.id, trackingId: s.trackingId });
                continue;
            }

            // Un seul email par destinataire (dédoublonnage)
            if (!recipientsMap.has(email)) {
                recipientsMap.set(email, {
                    email,
                    id: s.id,
                    trackingId: s.trackingId,
                    receiverName: s.receiverName,
                });
            }
        }

        const recipients = Array.from(recipientsMap.values());
        if (!recipients.length) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Aucun email valide",
                    invalidCount: invalidEmails.length,
                    invalidSamples: invalidEmails.slice(0, 5),
                },
                { status: 400 }
            );
        }

        // Envoi séquentiel (évite les rate-limits des providers)
        const results: { email: string; ok: boolean; error?: string; id?: string }[] = [];

        for (const r of recipients) {
            const text = `Bonjour ${r.receiverName},

Convoi du ${dateStr} — ${
                template === "EN_ROUTE"
                    ? direction === DirectionEnum.NE_TO_CA
                        ? "il est en route vers le Canada."
                        : "il est en route vers le Niger."
                    : direction === DirectionEnum.NE_TO_CA
                        ? "il est arrivé à la douane (Canada)."
                        : "il est arrivé à la douane (Niger)."
            }
Colis: ${r.trackingId}

${customMessage ?? ""}

${FOOTER}`;

            const resp = await sendWithRetry(
                { from: FROM, to: r.email, subject, text },
                5
            );
            results.push(
                resp.ok ? { email: r.email, ok: true, id: resp.id } : { email: r.email, ok: false, error: resp.error }
            );

            // Pause entre chaque envoi (ajuste 700–1200ms selon ton provider)
            await sleep(900);
        }

        const sent = results.filter((x) => x.ok).length;
        const failed = results.filter((x) => !x.ok);

        return NextResponse.json({
            ok: true,
            convoyId: convoy.id,
            totalShipments: convoy.shipments.length, // colis dans le convoi (peut > uniqueRecipients)
            uniqueRecipients: recipients.length,     // destinataires uniques (après dédoublonnage)
            sent,
            failedCount: failed.length,
            failed, // [{ email, ok:false, error }]
            invalidCount: invalidEmails.length,
            invalidSamples: invalidEmails.slice(0, 5),
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
