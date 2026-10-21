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
    /** Vrai quand le montant retenu s'écarte du tarif. */
    overridden: boolean;
};

/**
 * Arrête le montant et la devise d'un envoi.
 *
 * - Convoi avec tarif et envoi pesé → le tarif fait foi.
 * - L'agent a explicitement corrigé le montant → sa valeur est retenue,
 *   et `overridden` le signale pour qu'on puisse le tracer.
 * - Pas de tarif, ou aucun poids (un appareil non pesé) → on retombe sur
 *   le montant saisi, comme avant cette fonctionnalité.
 */
export function decidePricing(opts: {
    direction: Direction;
    pricePerKg: number | null | undefined;
    lines: WeighableLine[] | null | undefined;
    /** Ce que le formulaire a envoyé. */
    submittedAmount: number | null | undefined;
    /** L'agent a cliqué « Corriger le montant ». */
    priceOverridden?: boolean;
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
            overridden: false,
        };
    }

    // Correction assumée : on suit l'agent, mais on le note.
    if (opts.priceOverridden && submitted != null && submitted >= 0) {
        return {
            totalAmount: submitted,
            currency,
            quoted: q.amount,
            pricePerKg: q.pricePerKg,
            weightKg,
            overridden: submitted !== q.amount,
        };
    }

    return {
        totalAmount: q.amount,
        currency,
        quoted: q.amount,
        pricePerKg: q.pricePerKg,
        weightKg,
        overridden: false,
    };
}
