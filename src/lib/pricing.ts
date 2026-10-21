// src/lib/pricing.ts
//
// Tarification au kilo.
//
// Le prix d'un envoi n'est plus saisi par l'agent : l'administrateur fixe un
// tarif au kilo sur le convoi, et le montant se déduit du poids. L'agent
// pèse, le système chiffre. Moins d'erreurs de frappe, et surtout un même
// tarif pour tous les clients d'un même départ.
//
// La devise découle du sens, parce qu'elle découle de qui paie :
//   · Niger → Canada : l'expéditeur est au Niger, il paie en FCFA ;
//   · Canada → Niger : l'expéditeur est au Canada, il paie en dollars.
//
// Aucun import serveur ici : ce module sert aussi aux formulaires, pour que
// l'agent voie le montant se calculer pendant qu'il saisit, et que le
// serveur le recalcule ensuite à l'identique.

export type Direction = "NE_TO_CA" | "CA_TO_NE";
export type Currency = "CAD" | "XOF";

/** Devise de facturation d'un sens. Règle, et non réglage : une facture
 *  Niger → Canada libellée en dollars n'aurait pas de sens pour celui qui
 *  la paie à Niamey. */
export function currencyForDirection(direction: Direction | null | undefined): Currency {
    return direction === "CA_TO_NE" ? "CAD" : "XOF";
}

export function currencySymbol(currency: Currency): string {
    return currency === "CAD" ? "$" : "FCFA";
}

/**
 * Arrondi propre à la devise. Le franc CFA n'a pas de sous-unité : afficher
 * « 11 250,37 FCFA » annonce une précision qui n'existe pas à la caisse.
 */
export function roundMoney(amount: number, currency: Currency): number {
    if (currency === "XOF") return Math.round(amount);
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Montant lisible, avec séparateurs de milliers — un tarif en FCFA se
 *  compte en milliers, et « 11250 » se lit mal. */
export function formatMoney(amount: number, currency: Currency): string {
    const digits = currency === "XOF" ? 0 : 2;
    return `${amount.toLocaleString("fr-CA", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })} ${currencySymbol(currency)}`;
}

/** Poids affiché sans décimale superflue : 4 kg, 4,5 kg. */
export function formatWeight(kg: number): string {
    return `${kg.toLocaleString("fr-CA", { maximumFractionDigits: 3 })} kg`;
}

export type WeighableLine = {
    weightKg?: number | string | null;
    quantity?: number | string | null;
};

function toNumber(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

/**
 * Poids total facturable d'un envoi.
 *
 * Le poids d'une ligne est unitaire, la quantité le multiplie — même règle
 * que celle qui alimente Shipment.weightKg, pour que le montant calculé
 * corresponde toujours au poids imprimé sur la facture.
 *
 * `null` quand aucune ligne n'est pesée : un appareil non pesé ne se
 * tarifie pas au kilo, et inventer un poids vaut moins que ne rien dire.
 */
export function totalWeightKg(lines: WeighableLine[] | null | undefined): number | null {
    if (!lines?.length) return null;
    let total = 0;
    let weighed = 0;
    for (const line of lines) {
        const w = toNumber(line.weightKg);
        if (w === null || w <= 0) continue;
        const q = toNumber(line.quantity) ?? 1;
        total += w * (q > 0 ? q : 1);
        weighed++;
    }
    if (weighed === 0) return null;
    return Math.round((total + Number.EPSILON) * 1000) / 1000;
}

export type Quote = {
    amount: number;
    pricePerKg: number;
    weightKg: number;
    currency: Currency;
};

/**
 * Montant à facturer, ou `null` si le calcul n'est pas possible — pas de
 * tarif sur le convoi, ou pas de poids. Dans ce cas l'ancien
 * fonctionnement reprend la main : l'agent saisit le prix à la main.
 */
export function quote(
    pricePerKg: number | string | null | undefined,
    weightKg: number | null | undefined,
    currency: Currency
): Quote | null {
    const rate = toNumber(pricePerKg);
    if (rate === null || rate <= 0) return null;
    if (weightKg === null || weightKg === undefined || !Number.isFinite(weightKg) || weightKg <= 0) {
        return null;
    }
    return {
        amount: roundMoney(rate * weightKg, currency),
        pricePerKg: rate,
        weightKg,
        currency,
    };
}

/** Le calcul en toutes lettres, pour que l'agent voie d'où sort le montant
 *  — et repère tout de suite un poids mal saisi. */
export function explainQuote(q: Quote): string {
    return `${formatMoney(q.pricePerKg, q.currency)}/kg × ${formatWeight(q.weightKg)} = ${formatMoney(
        q.amount,
        q.currency
    )}`;
}
