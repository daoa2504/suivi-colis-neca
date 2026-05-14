"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
    id: string;
    label: string;
    quantity: number;
    weightKg: number | null;
};

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
    PAID: "Payé en totalité",
    PARTIAL: "Partiellement payé",
    UNPAID: "Non payé",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
    PAID: "bg-green-100 text-green-800 border-green-300",
    PARTIAL: "bg-amber-100 text-amber-800 border-amber-300",
    UNPAID: "bg-red-100 text-red-800 border-red-300",
};

export default function ItemsManager({
    shipmentId,
    initialItems,
    initialPayment,
}: {
    shipmentId: number;
    initialItems: Item[];
    initialPayment: { status: PaymentStatus; amountPaid: number | null };
}) {
    const router = useRouter();
    const [items, setItems] = useState<Item[]>(initialItems);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialPayment.status);
    const [amountPaid, setAmountPaid] = useState(initialPayment.amountPaid?.toString() ?? "");
    const [msg, setMsg] = useState<string | null>(null);

    // Formulaire d'ajout
    const [label, setLabel] = useState("");
    const [quantity, setQuantity] = useState("1");
    const [weight, setWeight] = useState("");
    const [adding, setAdding] = useState(false);

    const totalWeight = items.reduce((acc, i) => acc + (i.weightKg ?? 0), 0);
    const totalCount = items.reduce((acc, i) => acc + i.quantity, 0);

    async function addItem(e: React.FormEvent) {
        e.preventDefault();
        if (!label.trim()) return;
        setAdding(true);
        setMsg(null);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    label: label.trim(),
                    quantity: parseInt(quantity, 10) || 1,
                    weightKg: weight ? parseFloat(weight) : null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setItems((prev) => [...prev, data.item]);
            setLabel("");
            setQuantity("1");
            setWeight("");
            setMsg("✅ Colis ajouté");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setAdding(false);
        }
    }

    async function updateItem(id: string, patch: Partial<Item>) {
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data.item } : i)));
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    async function deleteItem(id: string) {
        if (!confirm("Supprimer ce colis ?")) return;
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/items/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setItems((prev) => prev.filter((i) => i.id !== id));
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    async function savePayment() {
        setMsg(null);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/payment`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentStatus,
                    amountPaid: amountPaid ? parseFloat(amountPaid) : null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setMsg("✅ Paiement mis à jour");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    return (
        <div className="space-y-6">
            {msg && (
                <div
                    className={`p-3 rounded text-sm ${
                        msg.startsWith("✅")
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                    {msg}
                </div>
            )}

            {/* Paiement */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">💰 Paiement</h2>
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">État</label>
                        <select
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                            className="border p-2 rounded"
                        >
                            <option value="UNPAID">{PAYMENT_LABELS.UNPAID}</option>
                            <option value="PARTIAL">{PAYMENT_LABELS.PARTIAL}</option>
                            <option value="PAID">{PAYMENT_LABELS.PAID}</option>
                        </select>
                    </div>
                    {paymentStatus === "PARTIAL" && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Montant payé</label>
                            <input
                                type="number"
                                step="0.01"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(e.target.value)}
                                className="border p-2 rounded w-32"
                                placeholder="0.00"
                            />
                        </div>
                    )}
                    <button
                        onClick={savePayment}
                        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                    >
                        Enregistrer
                    </button>
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${PAYMENT_BADGE[paymentStatus]}`}
                    >
                        {PAYMENT_LABELS[paymentStatus]}
                    </span>
                </div>
            </section>

            {/* Formulaire d'ajout */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">➕ Ajouter un colis</h2>
                <form onSubmit={addItem} className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium mb-1">
                            Libellé <span className="text-red-600">*</span>
                        </label>
                        <input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="ex: Piment rouge, Sachet criquet…"
                            className="border p-2 rounded w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Quantité</label>
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="border p-2 rounded w-20"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Poids (kg)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="border p-2 rounded w-24"
                            placeholder="0.00"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={adding || !label.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {adding ? "Ajout…" : "Ajouter"}
                    </button>
                </form>
            </section>

            {/* Liste des colis */}
            <section className="bg-white rounded-lg border shadow-sm">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">📦 Colis ({items.length})</h2>
                    <div className="text-sm text-gray-600">
                        Total : <strong>{totalCount}</strong> unité(s) ·{" "}
                        <strong>{totalWeight.toFixed(2)}</strong> kg
                    </div>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="text-left p-3">Libellé</th>
                        <th className="text-left p-3 w-24">Quantité</th>
                        <th className="text-left p-3 w-24">Poids (kg)</th>
                        <th className="text-left p-3 w-24">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((it) => (
                        <ItemRow
                            key={it.id}
                            item={it}
                            onUpdate={(patch) => updateItem(it.id, patch)}
                            onDelete={() => deleteItem(it.id)}
                        />
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-6 text-center text-gray-500">
                                Aucun colis. Ajoutez-en un ci-dessus.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

function ItemRow({
    item,
    onUpdate,
    onDelete,
}: {
    item: Item;
    onUpdate: (patch: Partial<Item>) => void;
    onDelete: () => void;
}) {
    const [label, setLabel] = useState(item.label);
    const [quantity, setQuantity] = useState(item.quantity.toString());
    const [weight, setWeight] = useState(item.weightKg?.toString() ?? "");

    const dirty =
        label !== item.label ||
        quantity !== item.quantity.toString() ||
        weight !== (item.weightKg?.toString() ?? "");

    return (
        <tr className="border-b hover:bg-gray-50">
            <td className="p-2">
                <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="border p-1 rounded w-full"
                />
            </td>
            <td className="p-2">
                <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="border p-1 rounded w-full"
                />
            </td>
            <td className="p-2">
                <input
                    type="number"
                    step="0.01"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="border p-1 rounded w-full"
                />
            </td>
            <td className="p-2 space-x-2 whitespace-nowrap">
                {dirty && (
                    <button
                        onClick={() =>
                            onUpdate({
                                label: label.trim(),
                                quantity: parseInt(quantity, 10) || 1,
                                weightKg: weight ? parseFloat(weight) : null,
                            })
                        }
                        className="text-blue-600 hover:underline text-xs"
                    >
                        💾
                    </button>
                )}
                <button onClick={onDelete} className="text-red-600 hover:underline text-xs">
                    🗑️
                </button>
            </td>
        </tr>
    );
}
