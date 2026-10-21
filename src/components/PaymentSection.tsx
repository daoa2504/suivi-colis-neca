"use client";

// src/components/PaymentSection.tsx
//
// Section paiement utilisée dans les 2 formulaires de création de colis
// (NE→CA et CA→NE). Contient les champs :
//   - Montant total à payer (source de vérité pour la facture)
//   - Devise (CAD ou FCFA)
//   - Statut de paiement (Payé totalité / Partiel / Non payé)
//   - Montant déjà reçu (visible et requis uniquement si Partiel)
//   - Restant à payer (calculé automatiquement)
//
// Les champs sont soumis via FormData avec les noms suivants :
//   totalAmount, currency, paymentStatus, amountPaid

import { useState, useMemo, useEffect } from "react";
import {
    currencyForDirection,
    currencySymbol,
    explainQuote,
    formatMoney,
    quote,
    type Currency,
    type Direction,
} from "@/lib/pricing";

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export type PaymentValue = {
    totalAmount: string;
    currency: "CAD" | "XOF";
    paymentStatus: PaymentStatus;
    /** Montant effectivement reçu, déjà cohérent avec le statut. */
    amountPaid: string;
};

export default function PaymentSection({
    initial,
    onChange,
    surcharge,
    direction,
    pricePerKg,
    weightKg,
}: {
    /** Valeurs de départ, pour le formulaire de modification. */
    initial?: Partial<PaymentValue>;
    /** Appelé à chaque changement, pour un parent qui construit son payload. */
    onChange?: (value: PaymentValue) => void;
    /** Supplément de ville déjà appliqué à cet envoi, en lecture seule.
     *  Affiché pour que l'agent voie le montant réellement dû, qui n'est pas
     *  celui qu'il a saisi. */
    surcharge?: { amount: number; city?: string | null } | null;
    /** Sens du convoi choisi. Détermine la devise : l'expéditeur paie chez
     *  lui, en FCFA depuis le Niger, en dollars depuis le Canada. */
    direction?: Direction | null;
    /** Tarif au kilo du convoi choisi, s'il en a un. */
    pricePerKg?: number | null;
    /** Poids total saisi dans la section « Contenu de l'envoi ». */
    weightKg?: number | null;
} = {}) {
    const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ?? "");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
        initial?.paymentStatus ?? "UNPAID"
    );
    const [amountPaid, setAmountPaid] = useState(initial?.amountPaid ?? "");

    // La devise n'est plus un choix : elle découle du sens du convoi. Tant
    // qu'aucun convoi n'est sélectionné, on garde la valeur de départ.
    const currency: Currency = direction
        ? currencyForDirection(direction)
        : ((initial?.currency ?? "CAD") as Currency);

    const computed = useMemo(
        () => quote(pricePerKg, weightKg ?? null, currency),
        [pricePerKg, weightKg, currency]
    );

    /**
     * Le montant vient du tarif du convoi, sans exception possible ici : les
     * prix sont fixés par l'administrateur, convoi par convoi. Le champ libre
     * ne réapparaît que faute de tarif ou de poids — sinon les convois sans
     * tarif deviendraient inutilisables.
     */
    const automatic = Boolean(computed);

    // Recopie du montant calculé dans le champ, pour qu'il parte avec le
    // formulaire comme n'importe quelle saisie — y compris via FormData.
    useEffect(() => {
        if (!automatic || !computed) return;
        const next = String(computed.amount);
        setTotalAmount((prev) => (prev === next ? prev : next));
    }, [automatic, computed]);

    // Restant à payer (calcul auto)
    const remaining = useMemo(() => {
        const total = parseFloat(totalAmount.replace(",", ".")) || 0;
        if (paymentStatus === "PAID") return 0;
        if (paymentStatus === "UNPAID") return total;
        const paid = parseFloat(amountPaid.replace(",", ".")) || 0;
        return Math.max(0, total - paid);
    }, [totalAmount, amountPaid, paymentStatus]);

    // Valeur envoyée pour amountPaid selon le statut :
    //   - PAID : le total complet
    //   - PARTIAL : ce que l'utilisateur a saisi
    //   - UNPAID : 0
    const effectiveAmountPaid = useMemo(() => {
        if (paymentStatus === "PAID") return totalAmount;
        if (paymentStatus === "UNPAID") return "0";
        return amountPaid;
    }, [paymentStatus, totalAmount, amountPaid]);

    // Remontée au parent contrôlé (formulaire de modification). Les formulaires
    // de création, eux, lisent les <input> par FormData et n'en ont pas besoin.
    useEffect(() => {
        onChange?.({ totalAmount, currency, paymentStatus, amountPaid: effectiveAmountPaid });
        // onChange hors dépendances : les parents passent souvent une fonction
        // recréée à chaque rendu.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalAmount, currency, paymentStatus, effectiveAmountPaid]);

    const symbol = currencySymbol(currency);
    const fmt = (n: number) =>
        n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-4 p-4 border border-emerald-200 rounded-lg bg-emerald-50/40">
            <div className="flex items-center gap-2">
                <span className="text-emerald-800 font-semibold text-sm">
                    💰 Paiement
                </span>
                <span className="text-xs text-emerald-700/70">
                    Ces informations génèrent la facture automatiquement.
                </span>
            </div>

            {surcharge && surcharge.amount > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <strong>
                        Supplément {surcharge.city ? `${surcharge.city} ` : ""}:{" "}
                        {surcharge.amount.toFixed(2)} {symbol}
                    </strong>{" "}
                    — ajouté automatiquement à la facture. Montant réellement dû :{" "}
                    <strong>
                        {(
                            (parseFloat(totalAmount.replace(",", ".")) || 0) + surcharge.amount
                        ).toFixed(2)}{" "}
                        {symbol}
                    </strong>
                    .
                </div>
            )}

            {/* Montant — calculé dès qu'un tarif et un poids sont connus */}
            <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <label htmlFor="totalAmount" className="text-sm font-medium text-neutral-700">
                        Montant total à payer <span className="text-red-600">*</span>
                    </label>
                    <span className="text-xs text-neutral-500">
                        Facturé en <strong>{currency === "XOF" ? "FCFA" : "CAD ($)"}</strong>
                        {direction
                            ? direction === "NE_TO_CA"
                                ? " — convoi Niger → Canada"
                                : " — convoi Canada → Niger"
                            : ""}
                    </span>
                </div>

                {automatic && computed ? (
                    <div className="rounded border border-emerald-300 bg-white px-3 py-2">
                        <div className="text-lg font-semibold text-emerald-900">
                            {formatMoney(computed.amount, currency)}
                        </div>
                        <div className="text-xs text-neutral-600 mt-0.5">
                            {explainQuote(computed)}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                            Calculé d&apos;après le tarif du convoi. Pour le changer,
                            corrigez le poids — ou demandez à un administrateur de
                            revoir le tarif.
                        </div>
                    </div>
                ) : (
                    <>
                        <input
                            id="totalAmount"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            required
                            placeholder={currency === "XOF" ? "ex : 25000" : "ex : 100.00"}
                            className="input border p-2 w-full rounded"
                            value={totalAmount}
                            onChange={(e) => setTotalAmount(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            {pricePerKg ? (
                                "Saisissez le poids dans « Contenu de l'envoi » : le montant se calculera tout seul."
                            ) : (
                                "Aucun tarif au kilo sur ce convoi — un administrateur peut en définir un dans Admin → Convois."
                            )}
                        </p>
                    </>
                )}

                {/* Toujours soumis, que le montant soit calculé ou saisi. */}
                <input type="hidden" name="totalAmount" value={totalAmount} />
                <input type="hidden" name="currency" value={currency} />
            </div>

            {/* Statut */}
            <div>
                <label className="block mb-2 text-sm font-medium text-neutral-700">
                    Statut du paiement <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <StatusRadio
                        value="PAID"
                        current={paymentStatus}
                        onChange={setPaymentStatus}
                        label="Payé en totalité"
                        color="green"
                    />
                    <StatusRadio
                        value="PARTIAL"
                        current={paymentStatus}
                        onChange={setPaymentStatus}
                        label="Partiellement payé"
                        color="amber"
                    />
                    <StatusRadio
                        value="UNPAID"
                        current={paymentStatus}
                        onChange={setPaymentStatus}
                        label="Non payé"
                        color="red"
                    />
                </div>
                {/* Champs cachés soumis avec le formulaire */}
                <input type="hidden" name="paymentStatus" value={paymentStatus} />
                <input type="hidden" name="amountPaid" value={effectiveAmountPaid} />
            </div>

            {/* Montant payé + restant (visible seulement si Partiel) */}
            {paymentStatus === "PARTIAL" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60">
                    <div>
                        <label htmlFor="amountPaidInput" className="block mb-1 text-sm font-medium text-neutral-700">
                            Montant déjà reçu <span className="text-red-600">*</span>
                        </label>
                        <input
                            id="amountPaidInput"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            required
                            placeholder="ex: 50.00"
                            className="input border p-2 w-full rounded"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block mb-1 text-sm font-medium text-neutral-700">
                            Restant à payer
                        </label>
                        <div className="input border p-2 w-full rounded bg-white text-neutral-700 font-medium">
                            {fmt(remaining)} {symbol}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Bouton radio stylisé --------------------------------------------------

function StatusRadio({
    value,
    current,
    onChange,
    label,
    color,
}: {
    value: PaymentStatus;
    current: PaymentStatus;
    onChange: (v: PaymentStatus) => void;
    label: string;
    color: "green" | "amber" | "red";
}) {
    const selected = current === value;
    const palette = {
        green: {
            selected: "bg-green-600 text-white border-green-600",
            idle: "bg-white text-green-800 border-green-300 hover:bg-green-50",
        },
        amber: {
            selected: "bg-amber-500 text-white border-amber-500",
            idle: "bg-white text-amber-800 border-amber-300 hover:bg-amber-50",
        },
        red: {
            selected: "bg-red-600 text-white border-red-600",
            idle: "bg-white text-red-800 border-red-300 hover:bg-red-50",
        },
    }[color];

    return (
        <button
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={selected}
            className={`text-sm px-3 py-2 rounded border transition-colors font-medium ${
                selected ? palette.selected : palette.idle
            }`}
        >
            {label}
        </button>
    );
}
