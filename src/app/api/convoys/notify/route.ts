// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { notifyConvoySchema } from "@/lib/validators";
import type { Direction } from "@prisma/client";

export const runtime = "nodejs";

// petit utilitaire pour éviter le throttling du provider d’email
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "AGENT_CA", "AGENT_GN"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        // ✅ on sort les champs validés et bien typés
        const { convoyDate, template, customMessage, direction } = parsed.data as {
            convoyDate: string | Date;
            template: "EN_ROUTE" | "ARRIVED_CUSTOMS";
            customMessage?: string | null;
            direction: Direction; // "GN_TO_CA" | "CA_TO_GN"
        };

        const date = new Date(convoyDate);

        // ✅ upsert via la clé unique composite @unique([date, direction], name: "date_direction")
        const convoy = await prisma.convoy.upsert({
            where: {
                date_direction: {
                    date,
                    direction, // <- obligatoire ici
                },
            },
            update: {},
            create: {
                date,
                direction,
            },
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

        if (!convoy || convoy.shipments.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Aucun colis pour ce convoi" },
                { status: 404 }
            );
        }

        const dateStr = convoy.date.toLocaleDateString("fr-CA");

        // Sujet dynamique selon direction + template
        const subject =
            template === "EN_ROUTE"
                ? direction === "GN_TO_CA"
                    ? "Votre convoi est en route vers le Canada"
                    : "Votre convoi est en route vers la Guinée"
                : direction === "GN_TO_CA"
                    ? "Votre convoi est arrivé à la douane (Canada)"
                    : "Votre convoi est arrivé à la douane (Guinée)";

        // Pied de mail dynamique
        const FOOTER = direction === "GN_TO_CA" ? "— Équipe GN → CA" : "— Équipe CA → GN";

        // Déduplique les emails (au cas où plusieurs colis ont le même destinataire)
        const unique = new Map<
            string,
            { id: string; trackingId: string; receiverName: string }
        >();
        for (const s of convoy.shipments) {
            const email = (s.receiverEmail || "").trim().toLowerCase();
            if (!email) continue;
            if (!unique.has(email)) {
                unique.set(email, {
                    id: s.id,
                    trackingId: s.trackingId,
                    receiverName: s.receiverName,
                });
            }
        }

        const list = Array.from(unique.entries()); // [ [email, meta], ... ]
        if (list.length === 0) {
            return NextResponse.json({ ok: false, error: "Aucun email valide" }, { status: 400 });
        }

        // Envoi par lots (batches) avec une petite pause pour éviter le throttling
        const BATCH = 40;
        const batches = chunk(list, BATCH);

        const results: { email: string; ok: boolean; error?: string; id?: string }[] = [];

        for (const batch of batches) {
            await Promise.all(
                batch.map(async ([email, meta]) => {
                    const text = `Bonjour ${meta.receiverName},

Convoi du ${dateStr} — ${
                        template === "EN_ROUTE"
                            ? direction === "GN_TO_CA"
                                ? "il est en route vers le Canada."
                                : "il est en route vers la Guinée."
                            : direction === "GN_TO_CA"
                                ? "il est arrivé à la douane (Canada)."
                                : "il est arrivé à la douane (Guinée)."
                    }
Colis: ${meta.trackingId}

${customMessage ?? ""}

${FOOTER}`;

                    const r = await sendEmailSafe({
                        from: FROM,
                        to: email,
                        subject,
                        text,
                    });

                    results.push(r.ok ? { email, ok: true, id: r.id } : { email, ok: false, error: r.error });
                })
            );

            // petite pause entre deux batches
            await sleep(400);
        }

        const sent = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok);

        return NextResponse.json({
            ok: true,
            convoyId: convoy.id,
            totalRecipients: list.length,
            sent,
            failedCount: failed.length,
            failed,
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}