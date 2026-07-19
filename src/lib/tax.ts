// src/lib/tax.ts
//
// Service de calcul et de détermination fiscale.
// Fondation (Phase 1). Ne dépend d'aucune UI — utilisable depuis n'importe
// quelle route/action.
//
// ⚠️ POINTS À VALIDER PAR UN COMPTABLE / FISCALISTE ⚠️
//   1. Traitement fiscal des services de transport internationaux CA↔NE
//      (probable ZERO_RATED sous l'Annexe VI Partie VII LTA — À CONFIRMER)
//   2. Application de la TVQ pour clients hors QC (Ontario, Alberta, etc.)
//   3. Compounding TPS/TVQ : depuis 2013 la TVQ n'est PAS appliquée sur la
//      TPS au Québec. Ce module suit cette règle (les taux s'appliquent
//      indépendamment sur le HT).
//   4. Format et mentions obligatoires sur factures — voir Loi ARC/RQ.
//
// AUCUN TAUX N'EST HARDCODÉ ICI. Les taux et les règles vivent en base
// (TaxRate, TaxRule). Voir scripts/seed-tax.ts pour l'initialisation avec
// placeholders TODO comptable.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

// --- Types publics -----------------------------------------------------------

export type TaxRegimeValue =
    | "TAX_INCLUDED"
    | "TAX_EXCLUDED"
    | "ZERO_RATED"
    | "TAX_EXEMPT"
    | "OUT_OF_SCOPE";

/** Une ligne de taxe appliquée (snapshot immuable côté facture — Phase 2). */
export interface AppliedTax {
    taxRateId: string;
    code: string;                          // "GST", "QST", "HST"
    name: string;                          // "TPS", "TVQ"
    rate: string;                          // "0.05" — sérialisé pour immutabilité
    jurisdiction: string;
    amount: string;                        // montant de taxe calculé, sérialisé "4.35"
}

/** Résultat d'un calcul fiscal complet. Tous les montants en string décimal
 *  pour éviter les erreurs de float et faciliter la sérialisation. */
export interface TaxCalculation {
    regime: TaxRegimeValue;
    amountBeforeTax: string;               // HT
    totalTax: string;                      // Somme des taxes appliquées
    totalIncludingTax: string;             // TTC (= HT + totalTax, exact au cent)
    taxes: AppliedTax[];
}

/** Contexte fourni au moteur de règles pour déterminer le régime applicable. */
export interface TaxContext {
    originCountry?: string | null;         // "CA", "NE"
    destinationCountry?: string | null;
    clientProvince?: string | null;        // "QC", "ON"...
    serviceType?: string | null;           // "SHIPPING", "STORAGE"...
}

// --- Utilitaires internes ----------------------------------------------------

/** Arrondit un Decimal à 2 décimales, mode "half up" (arrondi commercial). */
function round2(d: Dec): Dec {
    return d.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Sérialise un Decimal en chaîne à 2 décimales (ex: "100.00"). */
function fmt(d: Dec): string {
    return round2(d).toFixed(2);
}

// --- Chargement des taux -----------------------------------------------------

/** Charge les taux actifs pour les codes donnés à une date donnée. */
export async function loadTaxRates(
    codes: string[],
    at: Date = new Date()
): Promise<
    Array<{
        id: string;
        name: string;
        code: string;
        rate: Dec;
        jurisdiction: string;
    }>
> {
    if (codes.length === 0) return [];
    const rates = await prisma.taxRate.findMany({
        where: {
            code: { in: codes },
            active: true,
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gte: at } }],
        },
        select: { id: true, name: true, code: true, rate: true, jurisdiction: true },
    });
    return rates.map((r) => ({
        ...r,
        rate: new D(r.rate as unknown as Prisma.Decimal),
    }));
}

// --- Calcul TAX_INCLUDED : extraction depuis TTC ----------------------------
//
// Objectif : Total client = HT + sum(taxes). Le total client est la SOURCE
// de vérité (il ne bouge jamais). On calcule les taxes en priorité, puis on
// cale HT = Total - sum(taxes) pour préserver l'égalité au cent.

export function calculateTaxIncludedFromTotal(
    totalIncludingTax: string | number | Dec,
    rates: Array<{ id: string; name: string; code: string; rate: Dec; jurisdiction: string }>
): TaxCalculation {
    const total = new D(totalIncludingTax);
    // Somme des taux (ex: 0.05 + 0.09975 = 0.14975)
    const totalRate = rates.reduce((s, r) => s.plus(r.rate), new D(0));
    // HT non arrondi : Total / (1 + totalRate)
    const denominator = new D(1).plus(totalRate);
    const rawBeforeTax = total.dividedBy(denominator);

    // Calcul des taxes : chacune = rawHT * rate, arrondi
    const taxes = rates.map<AppliedTax>((r) => {
        const amount = round2(rawBeforeTax.times(r.rate));
        return {
            taxRateId: r.id,
            code: r.code,
            name: r.name,
            rate: r.rate.toString(),
            jurisdiction: r.jurisdiction,
            amount: amount.toFixed(2),
        };
    });

    // Somme des taxes arrondies
    const totalTax = taxes.reduce((s, t) => s.plus(new D(t.amount)), new D(0));
    // HT final : Total - somme(taxes) → garantit Total = HT + sum(taxes) exact
    const beforeTax = round2(total).minus(totalTax);

    return {
        regime: "TAX_INCLUDED",
        amountBeforeTax: beforeTax.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalIncludingTax: round2(total).toFixed(2),
        taxes,
    };
}

// --- Calcul TAX_EXCLUDED : ajout depuis HT ----------------------------------

export function calculateTaxExcludedFromBase(
    amountBeforeTax: string | number | Dec,
    rates: Array<{ id: string; name: string; code: string; rate: Dec; jurisdiction: string }>
): TaxCalculation {
    const ht = round2(new D(amountBeforeTax));

    const taxes = rates.map<AppliedTax>((r) => {
        const amount = round2(ht.times(r.rate));
        return {
            taxRateId: r.id,
            code: r.code,
            name: r.name,
            rate: r.rate.toString(),
            jurisdiction: r.jurisdiction,
            amount: amount.toFixed(2),
        };
    });

    const totalTax = taxes.reduce((s, t) => s.plus(new D(t.amount)), new D(0));
    const total = ht.plus(totalTax);

    return {
        regime: "TAX_EXCLUDED",
        amountBeforeTax: ht.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalIncludingTax: total.toFixed(2),
        taxes,
    };
}

// --- Régimes sans taxes -----------------------------------------------------

function zeroTaxResult(
    regime: TaxRegimeValue,
    amount: string | number | Dec,
    inputIsTotal: boolean
): TaxCalculation {
    const value = round2(new D(amount)).toFixed(2);
    return {
        regime,
        amountBeforeTax: value,
        totalTax: "0.00",
        totalIncludingTax: value,
        taxes: [],
    };
}

// --- API unifiée ------------------------------------------------------------

export interface CalculateInput {
    /** Régime fiscal à appliquer. */
    regime: TaxRegimeValue;
    /** Montant fourni. Si TAX_INCLUDED, c'est le TTC ; sinon, c'est le HT. */
    amount: string | number | Dec;
    /** Codes de taxes à appliquer (ex: ["GST", "QST"]). Ignoré si régime sans taxes. */
    taxRateCodes: string[];
    /** Date d'application (par défaut : maintenant). Utile pour recalcul historique. */
    at?: Date;
}

/**
 * Point d'entrée principal du service.
 *
 * @example
 *   const result = await calculateTax({
 *     regime: "TAX_INCLUDED",
 *     amount: 100,
 *     taxRateCodes: ["GST", "QST"],
 *   });
 *   // { amountBeforeTax: "86.98", totalTax: "13.02", totalIncludingTax: "100.00", taxes: [...] }
 */
export async function calculateTax(input: CalculateInput): Promise<TaxCalculation> {
    const { regime, amount, taxRateCodes, at } = input;

    if (regime === "ZERO_RATED" || regime === "TAX_EXEMPT" || regime === "OUT_OF_SCOPE") {
        return zeroTaxResult(regime, amount, true);
    }

    const rates = await loadTaxRates(taxRateCodes, at);
    if (rates.length === 0 && taxRateCodes.length > 0) {
        // Codes fournis mais aucun taux actif trouvé — cas anormal, on renvoie 0 taxes
        // et on log un avertissement. La route appelante peut décider quoi faire.
        console.warn(
            `[tax] Aucun taux actif trouvé pour codes=${JSON.stringify(taxRateCodes)} at=${(at ?? new Date()).toISOString()}`
        );
        return zeroTaxResult(regime, amount, true);
    }

    if (regime === "TAX_INCLUDED") return calculateTaxIncludedFromTotal(amount, rates);
    return calculateTaxExcludedFromBase(amount, rates);
}

// --- Moteur de détermination du régime --------------------------------------
//
// Consulte les TaxRule actives (par priorité descendante) et retourne la
// première dont tous les critères NON-NULLS correspondent au contexte.

export interface TaxDetermination {
    ruleId: string;
    ruleName: string;
    regime: TaxRegimeValue;
    taxRateCodes: string[];
    notes: string | null;
}

/** Détermine le régime fiscal à appliquer pour un contexte donné. */
export async function determineTaxTreatment(
    ctx: TaxContext
): Promise<TaxDetermination | null> {
    const rules = await prisma.taxRule.findMany({
        where: { active: true },
        orderBy: { priority: "desc" },
        select: {
            id: true,
            name: true,
            regime: true,
            taxRateCodes: true,
            notes: true,
            originCountry: true,
            destinationCountry: true,
            clientProvince: true,
            serviceType: true,
        },
    });

    for (const r of rules) {
        // Chaque critère non-null de la règle doit matcher le contexte
        if (r.originCountry && r.originCountry !== ctx.originCountry) continue;
        if (r.destinationCountry && r.destinationCountry !== ctx.destinationCountry) continue;
        if (r.clientProvince && r.clientProvince !== ctx.clientProvince) continue;
        if (r.serviceType && r.serviceType !== ctx.serviceType) continue;

        return {
            ruleId: r.id,
            ruleName: r.name,
            regime: r.regime,
            taxRateCodes: r.taxRateCodes,
            notes: r.notes,
        };
    }
    return null;
}

/** Combo : détermine + calcule. Retourne la calculation + la règle appliquée. */
export async function determineAndCalculate(
    ctx: TaxContext,
    amount: string | number | Dec,
    at?: Date
): Promise<{ calculation: TaxCalculation; determination: TaxDetermination | null }> {
    const determination = await determineTaxTreatment(ctx);
    if (!determination) {
        // Aucune règle configurée : par défaut, hors du champ (fail-safe :
        // vaut mieux ne pas ajouter de taxes qu'en ajouter à tort).
        return {
            calculation: zeroTaxResult("OUT_OF_SCOPE", amount, true),
            determination: null,
        };
    }

    const calculation = await calculateTax({
        regime: determination.regime,
        amount,
        taxRateCodes: determination.taxRateCodes,
        at,
    });
    return { calculation, determination };
}
