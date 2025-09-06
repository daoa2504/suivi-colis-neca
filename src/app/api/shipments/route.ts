// src/app/api/shipments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createShipmentByGN } from "@/lib/validators";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs"; // important pour Prisma en prod

const genTracking = () =>
    "GNCA-" + Math.random().toString(36).slice(2, 8).toUpperCase();

export async function POST(req: NextRequest) {
    // Auth v4 côté API
    const session = await getServerSession(authOptions);
    if (!session)
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "AGENT_GN"].includes(session.user.role))
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const parsed = createShipmentByGN.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const d = parsed.data;
        const convoyDate = new Date(d.convoyDate as any);

        // 1) upsert du convoi par date
        const convoy = await prisma.convoy.upsert({
            where: { date: convoyDate },
            update: {},
            create: { date: convoyDate },
        });

        // 2) création du colis + event + statut initial
        const shipment = await prisma.shipment.create({
            data: {
                trackingId: genTracking(),
                receiverName: d.receiverName,
                receiverEmail: d.receiverEmail,
                receiverPhone: d.receiverPhone,
                originCountry: d.originCountry ?? "Guinée",
                destinationCountry: d.destinationCountry ?? "Canada",
                weightKg: d.weightKg,
                price: d.price,
                notes: d.notes ?? null,
                status: "RECEIVED_IN_GUINEA",
                convoyId: convoy.id,
                events: {
                    create: {
                        type: "RECEIVED_IN_GUINEA",
                        description: "Colis reçu et enregistré par l’agent Guinée",
                        location: "Guinée",
                    },
                },
            },
            include: { convoy: true },
        });

        // 3) email immédiat au destinataire (optionnel si RESEND_API_KEY absent)
        try {
            await sendEmail({
                from: process.env.EMAIL_FROM ?? "no-reply@resend.dev",
                to: shipment.receiverEmail,
                subject: `Colis reçu en Guinée – Convoi du ${shipment.convoy!.date.toLocaleDateString()}`,
                text: `Bonjour ${shipment.receiverName},

Votre colis (${shipment.trackingId}) a été reçu en Guinée.
Convoi prévu : ${shipment.convoy!.date.toLocaleDateString()}.

Vous serez notifié quand le convoi sera en route et à son arrivée au Canada.

— Équipe GN → CA`,
            });
        } catch {
            // on ignore en prod si l’email échoue pour ne pas bloquer l’enregistrement
        }

        return NextResponse.json({
            ok: true,
            id: shipment.id,
            trackingId: shipment.trackingId,
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}
