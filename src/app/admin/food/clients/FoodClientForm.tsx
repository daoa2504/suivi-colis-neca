"use client";

// src/app/admin/food/clients/FoodClientForm.tsx
//
// Formulaire réutilisable : création + édition d'un FoodClient.
// En mode "create", accepte une section "Première commande" (facultative,
// multi-lignes) qui enregistre autant de FoodSale que de lignes remplies
// juste après la création du client (transaction séquentielle côté client).

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    country?: string | null;
    notes?: string | null;
    active?: boolean;
};

type Lot = {
    id: string;
    lotNumber: string;
    description: string;
    quantityRemaining: number | null;
};

type InitialOrder = {
    lotId: string;
    productDetails: string;
    quantityKg: string;
};

function fmtNum(n: number) {
    return n.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
}

export default function FoodClientForm({
    initial,
    mode,
    availableLots,
}: {
    initial?: Client;
    mode: "create" | "edit";
    availableLots?: Lot[];
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [form, setForm] = useState<Client>({
        name: initial?.name ?? "",
        email: initial?.email ?? "",
        phone: initial?.phone ?? "",
        address: initial?.address ?? "",
        city: initial?.city ?? "",
        province: initial?.province ?? "",
        postalCode: initial?.postalCode ?? "",
        country: initial?.country ?? "Canada",
        notes: initial?.notes ?? "",
        active: initial?.active ?? true,
    });

    // Section "Première commande" : uniquement en mode create + lots dispos
    const showInitialOrders = mode === "create" && availableLots && availableLots.length > 0;
    const [orders, setOrders] = useState<InitialOrder[]>(
        showInitialOrders ? [{ lotId: "", productDetails: "", quantityKg: "" }] : []
    );

    function addOrderRow() {
        setOrders([...orders, { lotId: "", productDetails: "", quantityKg: "" }]);
    }
    function removeOrderRow(idx: number) {
        setOrders(orders.filter((_, i) => i !== idx));
    }
    function updateOrder(idx: number, patch: Partial<InitialOrder>) {
        setOrders(orders.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);

        // Valider lignes remplies : chaque ligne doit avoir lot ET qté > 0
        const filledOrders = orders.filter(
            (o) => o.lotId.trim() !== "" || o.productDetails.trim() !== "" || o.quantityKg.trim() !== ""
        );
        for (const o of filledOrders) {
            if (!o.lotId) {
                setMsg("❌ Une commande a une marchandise/poids saisi mais pas de lot sélectionné.");
                return;
            }
            const qty = Number(o.quantityKg);
            if (!Number.isFinite(qty) || qty <= 0) {
                setMsg("❌ Une commande a un poids invalide (doit être > 0).");
                return;
            }
        }

        setLoading(true);
        try {
            const url =
                mode === "create"
                    ? "/api/food/clients"
                    : `/api/food/clients/${initial!.id}`;
            const method = mode === "create" ? "POST" : "PATCH";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");

            // Créer les ventes initiales si create + lignes remplies
            let salesCreated = 0;
            let salesFailed = 0;
            if (mode === "create" && filledOrders.length > 0) {
                for (const o of filledOrders) {
                    try {
                        const salesRes = await fetch("/api/food/sales", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                clientId: data.client.id,
                                lotId: o.lotId,
                                quantityKg: Number(o.quantityKg),
                                productDetails: o.productDetails || undefined,
                            }),
                        });
                        const salesData = await salesRes.json();
                        if (salesRes.ok && salesData.ok) salesCreated++;
                        else salesFailed++;
                    } catch {
                        salesFailed++;
                    }
                }
            }

            const salesMsg =
                salesCreated > 0
                    ? ` · ${salesCreated} vente${salesCreated > 1 ? "s" : ""} enregistrée${salesCreated > 1 ? "s" : ""}`
                    : "";
            const failMsg = salesFailed > 0 ? ` · ⚠️ ${salesFailed} vente(s) échouée(s)` : "";
            setMsg(`✅ Enregistré${salesMsg}${failMsg}`);
            setTimeout(() => {
                if (mode === "create") {
                    router.push(`/admin/food/clients/${data.client.id}`);
                } else {
                    router.refresh();
                }
            }, 500);
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
        } finally {
            setLoading(false);
        }
    }

    async function onDelete() {
        if (!initial?.id) return;
        if (!confirm("Désactiver ce client ? (soft-delete — l'historique est préservé)")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/food/clients/${initial.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            router.push("/admin/food/clients");
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
            setLoading(false);
        }
    }

    function bind<K extends keyof Client>(field: K) {
        return {
            value: (form[field] ?? "") as string,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setForm({ ...form, [field]: e.target.value } as Client),
        };
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nom / Raison sociale" required>
                    <input required minLength={2} className="input border p-2 w-full rounded" {...bind("name")} />
                </Field>
                <Field label="Email">
                    <input type="email" className="input border p-2 w-full rounded" {...bind("email")} />
                </Field>
                <Field label="Téléphone">
                    <input type="tel" className="input border p-2 w-full rounded" {...bind("phone")} />
                </Field>
                <Field label="Adresse">
                    <input className="input border p-2 w-full rounded" {...bind("address")} />
                </Field>
                <Field label="Ville">
                    <input className="input border p-2 w-full rounded" {...bind("city")} />
                </Field>
                <Field label="Province">
                    <input className="input border p-2 w-full rounded" {...bind("province")} />
                </Field>
                <Field label="Code postal">
                    <input className="input border p-2 w-full rounded" {...bind("postalCode")} />
                </Field>
                <Field label="Pays">
                    <input className="input border p-2 w-full rounded" {...bind("country")} />
                </Field>
            </div>

            <Field label="Notes internes">
                <textarea rows={3} className="input border p-2 w-full rounded" {...bind("notes")} />
            </Field>

            {mode === "edit" && (
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.active !== false}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Actif
                </label>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Section : Première commande (multi-lignes, facultative)     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {showInitialOrders && (
                <section className="p-4 border-2 border-dashed border-emerald-300 rounded-lg bg-emerald-50/30">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-emerald-800 font-semibold text-sm">
                            🛒 Première commande
                        </span>
                        <span className="text-xs text-emerald-700/70">
                            Facultatif — un client peut avoir plusieurs marchandises
                        </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                        Chaque ligne enregistre une vente distincte (lot + marchandise + poids).
                        Vous pourrez en ajouter d'autres plus tard sur la fiche du client.
                    </p>

                    <div className="space-y-3">
                        {orders.map((o, idx) => {
                            const selectedLot = availableLots?.find((l) => l.id === o.lotId);
                            return (
                                <div
                                    key={idx}
                                    className="p-3 bg-white border border-emerald-200 rounded space-y-2"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-emerald-800 font-semibold">
                                            Ligne {idx + 1}
                                        </span>
                                        {orders.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeOrderRow(idx)}
                                                className="text-xs text-red-600 hover:underline"
                                            >
                                                Supprimer
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <Field label="Lot">
                                            <select
                                                value={o.lotId}
                                                onChange={(e) => updateOrder(idx, { lotId: e.target.value })}
                                                className="input border p-2 w-full rounded bg-white"
                                            >
                                                <option value="">-- Choisir un lot --</option>
                                                {availableLots!.map((l) => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.lotNumber} — {l.description.slice(0, 40)}
                                                        {l.quantityRemaining !== null
                                                            ? ` (reste ${fmtNum(l.quantityRemaining)}kg)`
                                                            : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedLot && (
                                                <span className="block text-xs text-gray-500 mt-1 truncate">
                                                    {selectedLot.description}
                                                </span>
                                            )}
                                        </Field>
                                        <Field label="Poids (kg)">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={o.quantityKg}
                                                onChange={(e) =>
                                                    updateOrder(idx, { quantityKg: e.target.value })
                                                }
                                                placeholder="ex: 5.0"
                                                className="input border p-2 w-full rounded"
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Détails de la marchandise (facultatif)">
                                        <input
                                            value={o.productDetails}
                                            onChange={(e) =>
                                                updateOrder(idx, { productDetails: e.target.value })
                                            }
                                            placeholder="ex : riz basmati 3 kg + haricots noirs 2 kg"
                                            className="input border p-2 w-full rounded"
                                        />
                                    </Field>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={addOrderRow}
                        className="mt-3 text-sm bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded font-medium hover:bg-emerald-200"
                    >
                        + Ajouter une autre marchandise
                    </button>
                </section>
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
                            Désactiver ce client
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading
                        ? "Enregistrement…"
                        : mode === "create"
                          ? showInitialOrders && orders.some((o) => o.lotId)
                              ? "Créer le client + enregistrer les ventes"
                              : "Créer le client"
                          : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </span>
            {children}
        </label>
    );
}
