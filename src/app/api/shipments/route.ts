import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShipmentSchema } from '@/lib/validators'
import { generateTrackingId } from '@/lib/utils'
import { ShipmentStatus } from '@prisma/client'
import { resend, FROM, BASE_URL } from '@/lib/email'   // 👈 ajoute ça

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // 1) Validation Zod
        const parsed = createShipmentSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const {
            senderName,
            receiverName,
            receiverEmail,
            originCountry,
            destinationCountry,
            initialStatus,
        } = parsed.data

        // 2) Générer un trackingId
        const trackingId = generateTrackingId()

        // 3) Enregistrer en base
        const created = await prisma.shipment.create({
            data: {
                trackingId,
                senderName,
                receiverName,
                receiverEmail,
                originCountry: originCountry ?? 'Guinea',
                destinationCountry: destinationCountry ?? 'Canada',
                status: (initialStatus ?? 'RECEIVED_IN_GUINEA') as ShipmentStatus,
                events: {
                    create: {
                        type: 'RECEIVED_IN_GUINEA',
                        description: 'Colis reçu par nos agents en Guinée',
                        location: originCountry ?? 'Guinea',
                    },
                },
            },
            include: { events: true },
        })

        // 4) Envoyer un email au destinataire 👇
        const trackUrl = `${BASE_URL}/shipments/${created.trackingId}`
        try {
            const result = await resend.emails.send({
                from: FROM,
                to: receiverEmail,
                subject: `Votre colis ${created.trackingId} a été enregistré`,
                text: `Bonjour ${receiverName},

Votre colis a bien été enregistré par nos agents en Guinée.

Suivez son évolution ici : ${trackUrl}

— Équipe Colis GN → CA`,
            })
            console.log('[email] envoyé:', result)
        } catch (err) {
            console.error('[email] erreur:', err)
        }

        // 5) Réponse (utile pour le front/agent)
        return NextResponse.json({
            ok: true,
            id: created.id,
            trackingId: created.trackingId,
            status: created.status,
        })
    } catch (e: any) {
        console.error('[POST /api/shipments]', e)
        return NextResponse.json(
            { ok: false, error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
