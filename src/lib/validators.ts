// src/lib/validators.ts
import { z } from "zod";

// Formulaire Agent GN : enregistre un colis + date de convoi (obligatoire)
export const createShipmentByGN = z.object({
    receiverName: z.string().min(1),
    receiverEmail: z.string().email(),
    receiverPhone: z.string().optional(),
    originCountry: z.string().default("Guinée"),
    destinationCountry: z.string().default("Canada"),
    weightKg: z.preprocess(
        (v) => (v === "" || v === null ? undefined : Number(v)),
        z.number().positive().optional()
    ),
    price: z.preprocess(
        (v) => (v === "" || v === null ? undefined : Number(v)),
        z.number().positive().optional()
    ),
    notes: z.string().optional(),
    convoyDate: z.union([z.string(), z.date()]), // ex: "2025-09-06" ou Date
});

// Formulaire Agent CA : envoi email groupé par convoi
export const notifyConvoySchema = z.object({
    convoyDate: z.union([z.string(), z.date()]),
    template: z.enum(["EN_ROUTE", "ARRIVED_CUSTOMS_CA"]),
    customMessage: z.string().optional(),
});
