"use client";

// src/app/admin/food/clients/[id]/FoodSaleSection.tsx
// Historique des ventes d'un client + formulaire d'ajout rapide.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Lot = {
    id: string;
    lotNumber: string;
    description: string;
    quantityRemaining: number | null;
};

type Sale = {
    id: string;
    lotId: string;
    lot: { id: string; lotNumber: string; description: string };
    quantityKg: number;
    productDetails: string | null;
    saleDate: Date | string;
    price: number | null;
    currency: string;
    notes: string | null;
};

function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(n: number) {
    return n.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
}

export default function FoodSaleSection({
    clientId,
    clientCode,
    availableLots,
    initialSales,
}: {
    clientId: string;
    clientCode: string;
    availableLots: Lot[];
    initialSales: Sale[];
}) {
    const router = useRouter();
    const [sales, setSales] = useState<Sale[]>(initialSales);
    const [showForm, setShowForm] = useState(false);

    const [lotId, setLotId] = useState("");
    const [quantityKg, setQuantityKg] = useState("");
    const [productDetails, setProductDetails] = useState("");
    const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState<"CAD" | "XOF">("CAD");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const selectedLot = availableLots.find((l) => l.id === lotId);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!lotId) {
            setMsg("Sélectionnez un lot");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/food/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    lotId,
                    quantityKg: Number(quantityKg),
                    productDetails: productDetails || undefined,
                    saleDate,
                    price: price ? Number(price) : undefined,
                    currency,
                    notes: notes || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");

            setSales([data.sale, ...sales]);
            setLotId("");
            setQuantityKg("");
            setProductDetails("");
            setPrice("");
            setNotes("");
            setSaleDate(new Date().toISOString().slice(0, 10));
            setShowForm(false);
            setMsg("✅ Vente enregistrée");
            router.refresh();
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            {/* Bandeau + bouton */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-700">
                    {sales.length === 0
                        ? "Aucune vente enregistrée pour ce client."
                        : `${sales.length} vente${sales.length > 1 ? "s" : ""} enregistrée${sales.length > 1 ? "s" : ""} pour ${clientCode}.`}
                </p>
                <button
                    type="button"
                    onClick={() => setShowForm((s) => !s)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm font-medium"
                >
                    {showForm ? "Annuler" : "+ Nouvelle vente"}
                </button>
            </div>

            {/* Formulaire ajout */}
            {showForm && (
                <form onSubmit={onSubmit} className="p-5 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Lot vendu" required>
                            <select
                                required
                                value={lotId}
                                onChange={(e) => setLotId(e.target.value)}
                                className="input border p-2 w-full rounded bg-white"
                            >
                                <option value="">-- Choisir un lot --</option>
                                {availableLots.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.lotNumber} — {l.description.slice(0, 50)}
                                        {l.quantityRemaining !== null ? ` (reste ${fmtNum(l.quantityRemaining)}kg)` : ""}
                                    </option>
                                ))}
                            </select>
                            {selectedLot && (
                                <p className="text-xs text-gray-600 mt-1">
                                    {selectedLot.description}
                                </p>
                            )}
                        </Field>
                        <Field label="Quantité vendue (kg)" required>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={quantityKg}
                                onChange={(e) => setQuantityKg(e.target.value)}
                                className="input border p-2 w-full rounded"
                            />
                        </Field>
                    </div>

                    <Field label="Détails de la marchandise vendue" hint="Ex : riz basmati 3 kg + haricots noirs 2 kg + épices">
                        <textarea
                            rows={2}
                            value={productDetails}
                            onChange={(e) => setProductDetails(e.target.value)}
                            className="input border p-2 w-full rounded"
                        />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Date de vente">
                            <input
                                type="date"
                                value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                                className="input border p-2 w-full rounded"
                            />
                        </Field>
                        <Field label="Prix (facultatif)">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="input border p-2 w-full rounded"
                            />
                        </Field>
                        <Field label="Devise">
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as "CAD" | "XOF")}
                                className="input border p-2 w-full rounded bg-white"
                            >
                                <option value="CAD">CAD ($)</option>
                                <option value="XOF">FCFA</option>
                            </select>
                        </Field>
                    </div>

                    <Field label="Notes">
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="input border p-2 w-full rounded"
                        />
                    </Field>

                    {msg && (
                        <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {msg}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
                        >
                            {loading ? "Enregistrement…" : "Enregistrer la vente"}
                        </button>
                    </div>
                </form>
            )}

            {/* Historique */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Lot</th>
                            <th className="p-3">Marchandise</th>
                            <th className="p-3 text-right">Quantité (kg)</th>
                            <th className="p-3 text-right">Prix</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sales.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-gray-500">
                                    Aucune vente pour l'instant.
                                </td>
                            </tr>
                        )}
                        {sales.map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50">
                                <td className="p-3 text-xs">{fmtDate(s.saleDate)}</td>
                                <td className="p-3 font-mono text-xs font-semibold text-emerald-800">
                                    {s.lot.lotNumber}
                                    <div className="text-xs text-gray-500 font-normal truncate max-w-[180px]">
                                        {s.lot.description}
                                    </div>
                                </td>
                                <td className="p-3 max-w-[240px]">
                                    {s.productDetails ?? <span className="text-gray-400">—</span>}
                                </td>
                                <td className="p-3 text-right font-mono">{fmtNum(s.quantityKg)}</td>
                                <td className="p-3 text-right font-mono">
                                    {s.price !== null
                                        ? `${fmtNum(s.price)} ${s.currency === "XOF" ? "FCFA" : "$"}`
                                        : <span className="text-gray-400">—</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </span>
            {children}
            {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
        </label>
    );
}
