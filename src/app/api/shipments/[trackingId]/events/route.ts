import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addEventSchema } from '@/lib/validators'
import { resend, FROM, BASE_URL } from '@/lib/email'
import { ShipmentStatus } from '@prisma/client'

const STATUS_BY_EVENT: Partial<Record<string, ShipmentStatus>> = {
    RECEIVED_IN_GUINEA: 'RECEIVED_IN_GUINEA',
    IN_TRANSIT: 'IN_TRANSIT',
    IN_CUSTOMS: 'IN_CUSTOMS',
    ARRIVED_IN_CANADA: 'ARRIVED_IN_CANADA',
    PICKED_UP: 'PICKED_UP',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
}

const EVENT_LABEL: Record<string, string> = {
    RECEIVED_IN_GUINEA: 'Reçu en Guinée',
    IN_TRANSIT: 'En transit',
    IN_CUSTOMS: 'À la douane',
    ARRIVED_IN_CANADA: 'Arrivé au Canada',
    PICKED_UP: 'Récupéré par agent Canada',
    OUT_FOR_DELIVERY: 'En cours de livraison',
    DELIVERED: 'Livré',
    CUSTOM: 'Mise à jour',
}
type EventPayload = {
    type: "IN_CUSTOMS" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "RECEIVED_IN_GUINEA"
    description: string
    location: string
}
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    try {
        // ✅ Next 14.2+ : params est une Promise
        const { trackingId } = await params

        const json = await req.json()
        const parsed = addEventSchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 })
        }

        const { type, description, location, occurredAt } = parsed.data

        const shipment = await prisma.shipment.findUnique({ where: { trackingId } })
        if (!shipment) {
            return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
        }

        const event = await prisma.$transaction(async (tx) => {
            const ev = await tx.shipmentEvent.create({
                data: {
                    shipmentId: shipment.id,
                    type,
                    description,
                    location,
                    occurredAt: occurredAt ? new Date(occurredAt) : undefined,
                },
            })

            const newStatus = STATUS_BY_EVENT[type]
            if (newStatus) {
                await tx.shipment.update({ where: { id: shipment.id }, data: { status: newStatus } })
            }
            return ev
        })

        const trackUrl = `${BASE_URL}/shipments/${shipment.trackingId}`
        try {
            await resend.emails.send({
                from: FROM,
                to: shipment.receiverEmail,
                subject: `Mise à jour colis – ${shipment.trackingId}`,
                text:
                    `Bonjour ${shipment.receiverName},\n\n` +
                    `Événement: ${EVENT_LABEL[type] ?? type}\n` +
                    `${description}\n\n` +
                    `Suivre le colis: ${trackUrl}\n\n` +
                    `— Équipe Colis GN → CA`,
            })
        } catch (err) {
            console.error('[email event error]', err)
            // on n’échoue pas la requête si l’email tombe
        }

        return NextResponse.json({ ok: true, eventId: event.id })
    } catch (e: unknown) {
        console.error('[POST /api/shipments/:trackingId/events]', e)
        return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 })
    }
}
