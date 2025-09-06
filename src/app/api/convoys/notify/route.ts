// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notifyConvoySchema } from "@/lib/validators";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session)
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "AGENT_CA"].includes(session.user.role))
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const convoyDate = new Date(parsed.data.convoyDate as any);
        const template = parsed.data.template;
        const custom = parsed.data.customMessage;

        const convoy = await prisma.convoy.findUnique({
            where: { date: convoyDate },
            include: { shipments: true },
        });

        if (!convoy || convoy.shipments.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Aucun colis pour ce convoi" },
                { status: 404 }
            );
        }

        const dateStr = convoy.date.toLocaleDateString();
        const subject =
            template === "EN_ROUTE"
                ? "Votre convoi est en route vers le Canada"
                : "Votre convoi est arrivé à la douane (Canada)";

        // 1) envoi groupé
        for (const s of convoy.shipments) {
            try {
                await sendEmail({
                    from: process.env.EMAIL_FROM ?? "no-reply@resend.dev",
                    to: s.receiverEmail,
                    subject,
                    text: `Bonjour ${s.receiverName},

Convoi du ${dateStr} — ${
                        template === "EN_ROUTE"
                            ? "il est en route vers le Canada."
                            : "il est arrivé à la douane au Canada."
                    }
Colis: ${s.trackingId}

${custom ?? ""}

— Équipe GN → CA`,
                });
            } catch {
                // on continue même si un envoi échoue
            }
        }

        // 2) mise à jour de statut en masse (optionnelle mais utile)
        await prisma.shipment.updateMany({
            where: { convoyId: convoy.id },
            data: { status: template === "EN_ROUTE" ? "IN_TRANSIT" : "IN_CUSTOMS" },
        });

        // 3) historisation d’événements (optionnel) — décommenter pour créer un event par colis
        // await prisma.shipmentEvent.createMany({
        //   data: convoy.shipments.map((s) => ({
        //     shipmentId: s.id,
        //     type: template === "EN_ROUTE" ? "IN_TRANSIT" : "IN_CUSTOMS",
        //     description:
        //       template === "EN_ROUTE"
        //         ? "Convoi en route vers le Canada"
        //         : "Convoi arrivé à la douane (Canada)",
        //     location: "Canada",
        //   })),
        // });

        return NextResponse.json({ ok: true, sent: convoy.shipments.length });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
