import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createShipmentSchema } from "@/lib/validators";
import { generateTrackingId } from "@/lib/utils";
import { resend, FROM, BASE_URL } from "@/lib/email";

// ✅ Prisma 6.x : on récupère le type d'enum via Prisma.$Enums
type ShipmentStatus =
    | "CREATED"
    | "RECEIVED_IN_GUINEA"
    | "IN_TRANSIT"
    | "IN_CUSTOMS"
    | "ARRIVED_IN_CANADA"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED";

// Statut initial pour une création
const INITIAL_STATUS: ShipmentStatus = "CREATED";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = createShipmentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const trackingId = generateTrackingId();

        const shipment = await prisma.shipment.create({
            data: {
                trackingId,
                senderName: data.senderName,
                receiverName: data.receiverName,
                receiverEmail: data.receiverEmail,


                status: INITIAL_STATUS, // ✅ "CREATED" (type-safe)
            },
        });

        // (facultatif) email de confirmation
        try {
            const trackUrl = `${BASE_URL}/shipments/${shipment.trackingId}`;
            await resend.emails.send({
                from: FROM,
                to: shipment.receiverEmail,
                subject: `Votre colis est créé – ${shipment.trackingId}`,
                text:
                    `Bonjour ${shipment.receiverName},\n\n` +
                    `Votre colis a été créé. Statut: ${shipment.status}\n\n` +
                    `Suivi: ${trackUrl}\n\n` +
                    `— Équipe Colis GN → CA`,
            });
        } catch (err) {
            console.error("[email create shipment error]", err);
        }

        return NextResponse.json({ ok: true, shipmentId: shipment.id, trackingId });
    } catch (e) {
        console.error("[POST /api/shipments]", e);
        return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
    }
}
