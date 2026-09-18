// src/lib/validators.ts
import { z } from "zod";

// Nombre facultatif venant d'un <input type="number">.
// Le champ absent (undefined) doit être traité comme les autres formes de
// « vide » : un formulaire lu par Object.fromEntries n'envoie tout simplement
// pas les champs qu'il n'affiche pas, et Number(undefined) vaut NaN.
const optionalPositive = z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive().optional()
);

/**
 * Une ligne de contenu : soit un colis, soit un appareil.
 * Un envoi en porte une ou plusieurs, ce qui permet à un même client de
 * confier un carton ET une télévision sous un seul numéro de suivi.
 */
export const contentLineSchema = z
    .object({
        itemKind: z.enum(["PARCEL", "DEVICE"]).default("PARCEL"),
        label: z.string().trim().max(200).optional(),
        quantity: z.preprocess(
            (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
            z.number().int().positive().max(9999)
        ),
        weightKg: optionalPositive,
        deviceType: z.string().trim().min(1).nullish(),
        lengthCm: optionalPositive,
        widthCm: optionalPositive,
        heightCm: optionalPositive,
    })
    .superRefine((line, ctx) => {
        if (line.itemKind === "DEVICE") {
            // Appareil : le type fait foi. Poids et dimensions sont souvent
            // inconnus à la prise en charge, ils restent facultatifs.
            if (!line.deviceType) {
                ctx.addIssue({
                    path: ["deviceType"],
                    code: z.ZodIssueCode.custom,
                    message: "Type d'appareil requis",
                });
            }
            return;
        }
        // Colis : la description et le poids servent au tarif et à la douane.
        if (!line.label) {
            ctx.addIssue({
                path: ["label"],
                code: z.ZodIssueCode.custom,
                message: "Description requise pour un colis",
            });
        }
        if (line.weightKg == null) {
            ctx.addIssue({
                path: ["weightKg"],
                code: z.ZodIssueCode.custom,
                message: "Poids obligatoire pour un colis",
            });
        }
    });

// Champs décrivant le contenu de l'envoi, communs aux deux sens
const contentFields = {
    items: z.array(contentLineSchema).min(1, "Au moins une ligne de contenu"),
    packageCount: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
        z.number().int().positive().max(999)
    ),
};

// Formulaire Agent GN : enregistre un colis + date de convoi (obligatoire)
const shipmentBase = z.object({
    receiverName: z.string().min(1),
    receiverEmail: z.string().email(),
    receiverPhone: z.string().nullish(),
    originCountry: z.string().default("Niger"),
    destinationCountry: z.string().default("Canada"),
    ...contentFields,
    receiverAddress: z.string().nullish(),
    receiverCity: z.string().nullish(),
    receiverPoBox: z.string().nullish(),
    notes: z.string().nullish(),
    convoyId: z.string().min(1).optional(),
    convoyDate: z.union([z.string(), z.date()]).optional(), // legacy, remplacé par convoyId
});

export const createShipmentByGN = shipmentBase;

// Formulaire Agent CA : identique à GN + infos du récupérateur au Niger (obligatoires)
export const createShipmentByCA = shipmentBase
    .extend({
        originCountry: z.string().default("Canada"),
        destinationCountry: z.string().default("Niger"),
        pickupLastName: z.string().min(1, "Nom du récupérateur requis"),
        pickupFirstName: z.string().min(1, "Prénoms du récupérateur requis"),
        pickupQuartier: z.string().nullish(),
        pickupPhone: z.string().min(1, "Téléphone du récupérateur requis"),
    });

// src/lib/validators.ts

// ... vos autres schémas ...

// Schéma de connexion avec username
export const loginSchema = z.object({
    username: z.string()
        .min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères")
        .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores"
        ),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});






export const notifyConvoySchema = z.object({
    convoyDate: z.string().min(1),
    template: z.enum(["EN_ROUTE", "IN_CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED"]),
    customMessage: z.string().optional().default(""),
    direction: z.enum(["NE_TO_CA", "CA_TO_NE"]),
    pickupCity: z.string().optional(),
    customerEmail: z.string().email().optional(), // sera raffermi par refine ci-dessous
}).superRefine((data, ctx) => {
    if (data.template === "DELIVERED" && !data.customerEmail) {
        ctx.addIssue({
            path: ["customerEmail"],
            code: z.ZodIssueCode.custom,
            message: "Email client requis pour DELIVERED",
        });
    }
});



export const addEventSchema = z.object({
    type: z.enum([
        "RECEIVED_IN_NIGER",
        "RECEIVED_IN_CANADA",
        "IN_TRANSIT",
        "IN_CUSTOMS",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CUSTOM",
    ]),
    description: z.string().optional(),
    location: z.string().optional(),
    occurredAt: z.union([z.string(), z.date()]).optional(),
});
export const updateShipmentSchema = z.object({
    receiverName: z.string().min(1),
    receiverEmail: z.string().email(),
    receiverPhone: z.string().optional().nullable(),
    weightKg: z.preprocess(v => (v === "" || v == null ? undefined : Number(v)), z.number().positive().optional()),
    notes: z.string().optional().nullable(),
    convoyDate: z.union([z.string(), z.date()]).optional(), // si tu veux éditer le convoi
    receiverAddress: z.string().optional().nullable(),
    receiverCity: z.string().optional().nullable(),
    receiverPoBox: z.string().optional().nullable(),
    pickupLastName: z.string().optional().nullable(),
    pickupFirstName: z.string().optional().nullable(),
    pickupQuartier: z.string().optional().nullable(),
    pickupPhone: z.string().optional().nullable(),
});