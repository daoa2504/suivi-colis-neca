import { z } from 'zod'

export const createShipmentSchema = z.object({
    senderName: z.string().min(1, 'Nom expéditeur requis'),
    receiverName: z.string().min(1, 'Nom destinataire requis'),
    receiverEmail: z.string().email('Email invalide'),
    originCountry: z.string().default('Guinea').optional(),
    destinationCountry: z.string().default('Canada').optional(),
    initialStatus: z
        .enum([
            'CREATED',
            'RECEIVED_IN_GUINEA',
            'IN_TRANSIT',
            'IN_CUSTOMS',
            'ARRIVED_IN_CANADA',
            'PICKED_UP',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
        ])
        .default('RECEIVED_IN_GUINEA')
        .optional(),
})

export const addEventSchema = z.object({
    type: z.enum([
        'RECEIVED_IN_GUINEA',
        'IN_TRANSIT',
        'IN_CUSTOMS',        // ⬅️ ajouté
        'ARRIVED_IN_CANADA',
        'PICKED_UP',         // ⬅️ ajouté
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CUSTOM',
    ]),
    description: z.string().min(1, 'Description requise'),
    location: z.string().min(1, 'Lieu requis'),
    occurredAt: z.string().datetime().optional(),
})

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>
export type AddEventInput = z.infer<typeof addEventSchema>
