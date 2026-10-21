// src/lib/pricingServer.ts
//
// Application de la tarification au moment d'enregistrer un envoi.
//
// Le montant affiché par le formulaire est un confort : c'est ici qu'il est
// arrêté. Un navigateur peut envoyer n'importe quel chiffre — une facture ne
// doit pas dépendre de ce qu'on veut bien lui dire.
//
// Même raison pour la devise : elle découle du sens du convoi et n'est
// jamais reprise du client.

import {
    currencyForDirection,
    quote,
    totalWeightKg,
    type Currency,
    type Direction,
    type WeighableLine,
} from "./pricing";

export type PricingDecision = {
    totalAmount: number | null;
    currency: Currency;
    /** Montant issu du tarif, pour le journal et les messages. */
    quoted: number | null;
    pricePerKg: number | null;
    weightKg: number | null;
    /**
     * Montant que le client avait envoyé et que le tarif a écarté. Toujours
     * null en fonctionnement normal : une valeur ici signale un formulaire
     * desynchronisé, ou un appel forgé. Elle est journalisée, jamais suivie.
     */
    discardedAmount: number | null;
};

/**
 * Arrête le montant et la devise d'un envoi.
 *
 * - Convoi avec tarif et envoi pesé → le tarif fait foi, sans exception.
 *   Le montant envoyé par le formulaire est ignoré : seul l'administrateur
 *   fixe les prix, en réglant le tarif du convoi.
 * - Pas de tarif, ou aucun poids (un appareil non pesé) → on retombe sur
 *   le montant saisi, comme avant cette fonctionnalité. Sans cette porte,
 *   les convois déjà créés deviendraient inutilisables.
 */
export function decidePricing(opts: {
    direction: Direction;
    pricePerKg: number | null | undefined;
    lines: WeighableLine[] | null | undefined;
    /** Ce que le formulaire a envoyé. */
    submittedAmount: number | null | undefined;
}): PricingDecision {
    const currency = currencyForDirection(opts.direction);
    const weightKg = totalWeightKg(opts.lines);
    const q = quote(opts.pricePerKg, weightKg, currency);

    const submitted =
        opts.submittedAmount != null && Number.isFinite(opts.submittedAmount)
            ? opts.submittedAmount
            : null;

    // Sans tarif applicable, le montant saisi reste la seule source.
    if (!q) {
        return {
            totalAmount: submitted,
            currency,
            quoted: null,
            pricePerKg: opts.pricePerKg ?? null,
            weightKg,
            discardedAmount: null,
        };
    }

    return {
        totalAmount: q.amount,
        currency,
        quoted: q.amount,
        pricePerKg: q.pricePerKg,
        weightKg,
        discardedAmount: submitted !== null && submitted !== q.amount ? submitted : null,
    };
}
