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

import { useState, useMemo } from "react";

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

export default function PaymentSection() {
    const [totalAmount, setTotalAmount] = useState("");
    const [currency, setCurrency] = useState<"CAD" | "XOF">("CAD");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
    const [amountPaid, setAmountPaid] = useState("");

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

    const symbol = currency === "CAD" ? "$" : "FCFA";
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

            {/* Total + Devise */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                    <label htmlFor="totalAmount" className="block mb-1 text-sm font-medium text-neutral-700">
                        Montant total à payer <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="totalAmount"
                        name="totalAmount"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        required
                        placeholder="ex: 100.00"
                        className="input border p-2 w-full rounded"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="currency" className="block mb-1 text-sm font-medium text-neutral-700">
                        Devise <span className="text-red-600">*</span>
                    </label>
                    <select
                        id="currency"
                        name="currency"
                        required
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as "CAD" | "XOF")}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="CAD">CAD ($)</option>
                        <option value="XOF">FCFA</option>
                    </select>
                </div>
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
