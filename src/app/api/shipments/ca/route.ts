// src/app/api/shipments/ca/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";

import { Prisma, $Enums } from '@prisma/client';
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "AGENT_CA"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const convoyDate = new Date(body.convoyDate);

        // 1) convoi CA -> GN (créé s'il n'existe pas)
        const convoy = await prisma.convoy.upsert({
            where: {
                date_direction: {
                    date: convoyDate,
                    direction: $Enums.Direction.CA_TO_GN,
                },
            },
            update: {},
            create: {
                date: convoyDate,
                direction: $Enums.Direction.CA_TO_GN,
            },
        });

        // 2) créer le colis (départ Canada vers Guinée)
        const shipment = await prisma.shipment.create({
            data: {
                trackingId: `CAGN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, // remplace par ton generateTrackingId si tu as
                originCountry: "Canada",
                destinationCountry: "Guinea",
                status: "CREATED",
                convoyId: convoy.id,

                receiverName: body.receiverName,
                receiverEmail: body.receiverEmail,
                receiverPhone: body.receiverPhone ?? null,
                weightKg:
                    body.weightKg !== undefined && body.weightKg !== ""
                        ? Number(body.weightKg)
                        : null,
                receiverAddress: body.receiverAddress ?? null,
                receiverCity: body.receiverCity ?? null,
                receiverPoBox: body.receiverPoBox ?? null,
                notes: body.notes ?? null,
            },
        });

        // 3) historiser un événement et propager le statut
        await prisma.$transaction(async (tx) => {
            await tx.shipmentEvent.create({
                data: {
                    shipmentId: shipment.id,
                    type: "RECEIVED_IN_CANADA", // reçu par agent au Canada (avant envoi vers GN)
                    description: "Colis reçu par l’agent Canada (départ vers Guinée)",
                    location: "Canada",
                },
            });
            await tx.shipment.update({
                where: { id: shipment.id },
                data: { status: $Enums.ShipmentStatus.RECEIVED_IN_CANADA},
            });
        });

        // 4) email au destinataire (en Guinée) — inclure notes si présentes
        const notesTxt =
            shipment.notes && shipment.notes.trim()
                ? `\nNotes :\n${shipment.notes.trim()}\n`
                : "";

        const dateStr = convoyDate.toLocaleDateString("fr-CA");
        const subject = `Colis enregistré au Canada – Convoi ${dateStr} (${shipment.trackingId})`;
        const text = `Bonjour ${shipment.receiverName},

Votre colis a été reçu par notre agent au Canada et sera expédié vers la Guinée lors du convoi du ${dateStr}.

Détails :
- Tracking : ${shipment.trackingId}
- Poids : ${shipment.weightKg ?? "n/a"} kg
${notesTxt}
— Équipe CA → GN`;

        try {
            await sendEmailSafe({ from: FROM, to: shipment.receiverEmail, subject, text });
        } catch (e) {
            console.warn("[agent-ca:create] échec email:", e);
        }

        return NextResponse.json({ ok: true, id: shipment.id, trackingId: shipment.trackingId });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
