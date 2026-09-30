// src/lib/surcharge.ts
//
// Supplément de ville : montant ajouté aux clients d'une ville donnée pour
// un convoi donné (livraison vers Québec, par exemple).
//
// Le montant applicable est recopié sur l'envoi au moment de l'enregistrement
// (Shipment.surchargeAmount) plutôt que recalculé à la volée. Deux raisons :
// le montant dû ne doit pas changer sous les pieds de l'agent si un admin
// retouche la grille, et totalAmount reste le prix convenu — réenregistrer
// un colis n'ajoute donc jamais le supplément une seconde fois.

import { prisma } from "@/lib/prisma";

/** Insensible à la casse et aux accents : côté CA→NE la ville est libre. */
function normalizeCity(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

export type ResolvedSurcharge = {
    /** Montant total du supplément : tarif × poids. */
    amount: number;
    /** Tarif au kilo tel que configuré sur le convoi. */
    rate: number;
    /** Poids retenu pour le calcul. */
    weightKg: number;
    city: string;
    label: string | null;
} | null;

/**
 * Supplément applicable à un envoi, ou null.
 *
 * Le montant configuré est un TARIF AU KILO : 3 $/kg sur un envoi de 2 kg
 * donne 6 $. Un envoi sans poids connu ne peut donc pas être majoré — le
 * cas se présente pour un appareil non pesé, et il vaut mieux ne rien
 * facturer qu'inventer un poids.
 *
 * Un supplément libellé dans une autre devise que l'envoi est ignoré plutôt
 * qu'additionné à tort.
 */
export async function resolveSurcharge(
    convoyId: string | null | undefined,
    receiverCity: string | null | undefined,
    currency: string,
    weightKg: number | null | undefined
): Promise<ResolvedSurcharge> {
    if (!convoyId || !receiverCity?.trim()) return null;

    const rows = await prisma.convoySurcharge.findMany({ where: { convoyId } });
    const target = normalizeCity(receiverCity);
    const match = rows.find((r) => normalizeCity(r.city) === target);

    if (!match) return null;

    if (match.currency !== currency) {
        console.warn(
            `[surcharge] ${match.city} en ${match.currency} ignoré : envoi en ${currency}`
        );
        return null;
    }

    const rate = Number(match.amount);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
        console.warn(
            `[surcharge] ${match.city} ignoré : poids inconnu, tarif au kilo inapplicable`
        );
        return null;
    }

    return {
        amount: round2(rate * weightKg),
        rate,
        weightKg,
        city: match.city,
        label: match.label,
    };
}

/** Montant réellement dû par le client : prix convenu + supplément. */
export function amountDue(
    totalAmount: number | null | undefined,
    surchargeAmount: number | null | undefined
): number | null {
    if (totalAmount == null) return null;
    return round2(totalAmount + (surchargeAmount ?? 0));
}

/** Arrondi au cent, pour que les sommes d'argent restent exactes. */
export function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
