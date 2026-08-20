"use client";

// src/app/admin/food/lots/FoodLotForm.tsx
// Formulaire création + édition d'un FoodLot. lotNumber : auto-généré à la
// création (LOT-YYYY-NNNN), IMMUABLE ensuite.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Lot = {
    id?: string;
    lotNumber?: string | null;
    description?: string | null;
    awbNumber?: string | null;
    supplier?: string | null;
    supplierCity?: string | null;
    importDate?: string | Date | null;
    quantityKg?: number | string | null;
    quantityRemaining?: number | string | null;
    status?: "IN_TRANSIT" | "DELIVERED" | "RECALLED";
    notes?: string | null;
    active?: boolean;
};

function toDateInput(d: string | Date | null | undefined): string {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
}

export default function FoodLotForm({
    initial,
    mode,
}: {
    initial?: Lot;
    mode: "create" | "edit";
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const [lotNumber, setLotNumber] = useState<string>(initial?.lotNumber ?? "");
    const [description, setDescription] = useState<string>(initial?.description ?? "");
    const [awbNumber, setAwbNumber] = useState<string>(initial?.awbNumber ?? "");
    const [supplier, setSupplier] = useState<string>(initial?.supplier ?? "");
    const [supplierCity, setSupplierCity] = useState<string>(initial?.supplierCity ?? "");
    const [importDate, setImportDate] = useState<string>(toDateInput(initial?.importDate));
    const [quantityKg, setQuantityKg] = useState<string>(String(initial?.quantityKg ?? ""));
    const [quantityRemaining, setQuantityRemaining] = useState<string>(
        String(initial?.quantityRemaining ?? "")
    );
    const [status, setStatus] = useState<Lot["status"]>(initial?.status ?? "IN_TRANSIT");
    const [notes, setNotes] = useState<string>(initial?.notes ?? "");
    const [active, setActive] = useState<boolean>(initial?.active ?? true);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);
        try {
            const payload: any = {
                description,
                awbNumber: awbNumber || null,
                supplier: supplier || null,
                supplierCity: supplierCity || null,
                importDate,
                quantityKg: Number(quantityKg),
                status,
                notes: notes || null,
            };
            if (mode === "create") {
                if (lotNumber) payload.lotNumber = lotNumber;
            } else {
                payload.quantityRemaining = quantityRemaining === "" ? null : Number(quantityRemaining);
                payload.active = active;
            }

            const url = mode === "create" ? "/api/food/lots" : `/api/food/lots/${initial!.id}`;
            const method = mode === "create" ? "POST" : "PATCH";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");

            setMsg("✅ Enregistré");
            setTimeout(() => {
                if (mode === "create") router.push(`/admin/food/lots/${data.lot.id}`);
                else router.refresh();
            }, 400);
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
        } finally {
            setLoading(false);
        }
    }

    async function onDelete() {
        if (!initial?.id) return;
        if (!confirm("Désactiver ce lot ? (soft-delete)")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/food/lots/${initial.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            router.push("/admin/food/lots");
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="N° de lot" hint={mode === "create" ? "Auto : LOT-AAAA-NNNN (laisser vide)" : "Immuable"}>
                    <input
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                        placeholder={mode === "create" ? "auto" : ""}
                        disabled={mode === "edit"}
                        className="input border p-2 w-full rounded font-mono disabled:bg-gray-100"
                    />
                </Field>
                <Field label="Date d'importation" required>
                    <input
                        type="date"
                        required
                        value={importDate}
                        onChange={(e) => setImportDate(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
            </div>

            <Field label="Description des produits" required hint="Ex : riz basmati 25 kg + haricots noirs 10 kg + épices">
                <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input border p-2 w-full rounded"
                />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="N° AWB (transport aérien)">
                    <input
                        value={awbNumber}
                        onChange={(e) => setAwbNumber(e.target.value)}
                        placeholder="ex: 020-12345678"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Fournisseur au Niger">
                    <input
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Ville du fournisseur">
                    <input
                        value={supplierCity}
                        onChange={(e) => setSupplierCity(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Quantité importée (kg)" required>
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
                {mode === "edit" && (
                    <Field label="Quantité restante (kg)" hint="Se déduit des ventes à partir de la Phase 3.2">
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantityRemaining}
                            onChange={(e) => setQuantityRemaining(e.target.value)}
                            className="input border p-2 w-full rounded"
                        />
                    </Field>
                )}
                <Field label="Statut" required>
                    <select
                        required
                        value={status}
                        onChange={(e) => setStatus(e.target.value as Lot["status"])}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="IN_TRANSIT">En transit</option>
                        <option value="DELIVERED">Livré</option>
                        <option value="RECALLED">Rappelé</option>
                    </select>
                </Field>
            </div>

            <Field label="Notes">
                <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input border p-2 w-full rounded"
                />
            </Field>

            {mode === "edit" && (
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                    />
                    Actif
                </label>
            )}

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    {mode === "edit" && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="text-sm text-red-600 hover:underline"
                            disabled={loading}
                        >
                            Désactiver ce lot
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                    {loading ? "Enregistrement…" : mode === "create" ? "Créer le lot" : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

function Field({
    label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
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
