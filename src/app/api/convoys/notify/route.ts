// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { notifyConvoySchema } from "@/lib/validators";
import { Direction as DirectionEnum } from "@prisma/client";
import { getEmailContent, getEmailSubject, type ConvoyStatus, type Direction } from "@/lib/emailTemplates";

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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sendWithRetry(
    args: Parameters<typeof sendEmailSafe>[0],
    maxAttempts = 5
) {
    let last: Awaited<ReturnType<typeof sendEmailSafe>> | undefined;
    for (let i = 0; i < maxAttempts; i++) {
        last = await sendEmailSafe(args);
        if (last.ok) return last;

        const msg = last.error || "";
        const transient = /(?:429|rate|throttl|temporar|timeout|5\d\d)/i.test(msg);
        if (!transient) break;

        await sleep(600 * (i + 1));
    }
    return last!;
}

/* ----------------------------- Helper pour convertir Direction ----------------------------- */

function toEmailDirection(prismaDir: DirectionEnum): Direction {
    return prismaDir === DirectionEnum.NE_TO_CA ? "NE_TO_CA" : "CA_TO_NE";
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

        // Validation via Zod
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { convoyDate, template, customMessage, direction, customerEmail } = parsed.data;

        // Règles d'accès
        if (role === "AGENT_CA" && direction !== DirectionEnum.NE_TO_CA) {
            return NextResponse.json(
                { ok: false, error: "AGENT_CA ne peut notifier que NE_TO_CA" },
                { status: 403 }
            );
        }
        if (role === "AGENT_NE") {
            return NextResponse.json(
                { ok: false, error: "AGENT_NE n'est pas autorisé à notifier des convois" },
                { status: 403 }
            );
        }

        // Date normalisée
        const date = startOfDayUTC(convoyDate);

        // Upsert du convoi
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
                        receiverCity: true,  // ✅ AJOUT ICI
                        notes: true,
                        thankYouEmailSent: true,
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

        const dateStr = convoy.date.toLocaleDateString("fr-CA", { timeZone: "UTC" });
        const emailDirection = toEmailDirection(direction);

        const results: { email: string; ok: boolean; error?: string; id?: string; trackingIds?: string[] }[] = [];

        // ========== EN_ROUTE, IN_CUSTOMS, OUT_FOR_DELIVERY : Emails groupés ==========

        // ✅ MODIFICATION DU TYPE POUR INCLURE CITY
        type RecipientGroup = { name: string; ids: string[]; city: string };
        const grouped = new Map<string, RecipientGroup>();
        const invalidEmails: Array<{ emailRaw: string; id: number; trackingId: string }> = [];

        for (const s of convoy.shipments) {
            const emailRaw = s.receiverEmail ?? "";
            const email = normalizeEmail(emailRaw);

            if (!email || !isValidEmail(email)) {
                invalidEmails.push({ emailRaw, id: s.id, trackingId: s.trackingId });
                continue;
            }

            // ✅ CLÉ UNIQUE : email + ville
            const groupKey = `${email}|${s.receiverCity || ""}`;

            const entry = grouped.get(groupKey);
            if (entry) {
                entry.ids.push(s.trackingId);
            } else {
                // ✅ STOCKAGE DE LA VILLE
                grouped.set(groupKey, {
                    name: s.receiverName,
                    ids: [s.trackingId],
                    city: s.receiverCity || ""
                });
            }
        }

        if (!grouped.size) {
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

        // ✅ BOUCLE MODIFIÉE POUR UTILISER city
        for (const [groupKey, { name, ids, city }] of grouped.entries()) {
            // Extraire l'email de la clé
            const email = groupKey.split("|")[0];

            // 🔍 LOG POUR DÉBOGUER
            console.log("=== ENVOI EMAIL ===");
            console.log("Email:", email);
            console.log("Ville (receiverCity):", city);
            console.log("Tracking IDs:", ids);
            console.log("==================");

            // ✅ PASSAGE DE city À getEmailContent
            const { subject, text, html } = getEmailContent(
                template as ConvoyStatus,
                emailDirection,
                name,
                ids,
                dateStr,
                customMessage,
                city  // ✅ PARAMÈTRE AJOUTÉ ICI
            );

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: email,
                    subject,
                    text,
                    html,
                });
                results.push(resp.ok ? { email, ok: true, id: resp.id } : { email, ok: false, error: resp.error });
            } catch (e: any) {
                results.push({ email, ok: false, error: e?.message || String(e) });
            }

            await sleep(900);
        }

        const sent = results.filter((x) => x.ok).length;
        const failed = results.filter((x) => !x.ok);

        return NextResponse.json({
            ok: true,
            convoyId: convoy.id,
            totalShipments: convoy.shipments.length,
            uniqueRecipients: grouped.size,
            sent,
            failedCount: failed.length,
            failed,
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