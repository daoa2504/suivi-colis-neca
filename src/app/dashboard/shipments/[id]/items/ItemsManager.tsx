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
type Currency = "CAD" | "XOF";
type PaymentMethod = "CASH" | "TRANSFER" | "MOBILE_MONEY" | "OTHER";

type PaymentEntry = {
    id: string;
    amount: number;
    currency: Currency;
    method: PaymentMethod;
    paidAt: string;
    notes: string | null;
};

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

const METHOD_LABELS: Record<PaymentMethod, string> = {
    CASH: "Cash",
    TRANSFER: "Virement",
    MOBILE_MONEY: "Mobile money",
    OTHER: "Autre",
};

export default function ItemsManager({
    shipmentId,
    initialItems,
    initialPayment,
    initialPayments,
}: {
    shipmentId: number;
    initialItems: Item[];
    initialPayment: { status: PaymentStatus; amountPaid: number | null };
    initialPayments: PaymentEntry[];
}) {
    const router = useRouter();
    const [items, setItems] = useState<Item[]>(initialItems);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(initialPayment.status);
    const [amountPaid, setAmountPaid] = useState(initialPayment.amountPaid?.toString() ?? "");
    const [payments, setPayments] = useState<PaymentEntry[]>(initialPayments);
    const [msg, setMsg] = useState<string | null>(null);

    // Formulaire d'ajout d'un paiement
    const [payAmount, setPayAmount] = useState("");
    const [payCurrency, setPayCurrency] = useState<Currency>("CAD");
    const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
    const [payNotes, setPayNotes] = useState("");
    const [payAdding, setPayAdding] = useState(false);

    // Totaux par devise (somme des paiements)
    const totalsByCurrency = payments.reduce(
        (acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + p.amount;
            return acc;
        },
        {} as Record<Currency, number>
    );

    async function addPayment(e: React.FormEvent) {
        e.preventDefault();
        if (!payAmount || parseFloat(payAmount) <= 0) return;
        setPayAdding(true);
        setMsg(null);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: parseFloat(payAmount),
                    currency: payCurrency,
                    method: payMethod,
                    paidAt: payDate,
                    notes: payNotes || null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setPayments((prev) => [data.payment, ...prev]);
            setPayAmount("");
            setPayNotes("");
            setMsg("✅ Paiement ajouté");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setPayAdding(false);
        }
    }

    async function deletePayment(id: string) {
        if (!confirm("Supprimer ce paiement ?")) return;
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/payments/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setPayments((prev) => prev.filter((p) => p.id !== id));
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    // Édition d'un paiement
    const [editPayId, setEditPayId] = useState<string | null>(null);
    const [editPay, setEditPay] = useState<Partial<PaymentEntry>>({});

    function startEditPayment(p: PaymentEntry) {
        setEditPayId(p.id);
        setEditPay({ ...p });
    }

    function cancelEditPayment() {
        setEditPayId(null);
        setEditPay({});
    }

    async function saveEditPayment() {
        if (!editPayId) return;
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/payments/${editPayId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: editPay.amount,
                    currency: editPay.currency,
                    method: editPay.method,
                    paidAt: editPay.paidAt,
                    notes: editPay.notes || null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setPayments((prev) =>
                prev.map((p) =>
                    p.id === editPayId
                        ? {
                              ...p,
                              amount: data.payment.amount,
                              currency: data.payment.currency,
                              method: data.payment.method,
                              paidAt: new Date(data.payment.paidAt).toISOString(),
                              notes: data.payment.notes,
                          }
                        : p
                )
            );
            setEditPayId(null);
            setEditPay({});
            setMsg("✅ Paiement modifié");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

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

            {/* Paiement — état global */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">💰 État du paiement</h2>
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

                {/* Totaux par devise */}
                {payments.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-3 text-sm text-gray-700">
                        <span className="font-medium">Total encaissé :</span>
                        {Object.entries(totalsByCurrency).map(([cur, total]) => (
                            <span
                                key={cur}
                                className="px-2 py-1 bg-green-50 text-green-800 rounded font-mono"
                            >
                                {total.toFixed(2)} {cur}
                            </span>
                        ))}
                    </div>
                )}
            </section>

            {/* Historique des paiements */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">💳 Historique des paiements</h2>

                <form onSubmit={addPayment} className="flex flex-wrap gap-3 items-end mb-4 pb-4 border-b">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Montant <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="0.00"
                            className="border p-2 rounded w-28"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Devise</label>
                        <select
                            value={payCurrency}
                            onChange={(e) => setPayCurrency(e.target.value as Currency)}
                            className="border p-2 rounded"
                        >
                            <option value="CAD">CAD</option>
                            <option value="XOF">XOF (FCFA)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Méthode</label>
                        <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                            className="border p-2 rounded"
                        >
                            <option value="CASH">Cash</option>
                            <option value="TRANSFER">Virement</option>
                            <option value="MOBILE_MONEY">Mobile money</option>
                            <option value="OTHER">Autre</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input
                            type="date"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            className="border p-2 rounded"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <input
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            placeholder="(optionnel)"
                            className="border p-2 rounded w-full"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={payAdding || !payAmount}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                        {payAdding ? "…" : "Ajouter"}
                    </button>
                </form>

                {payments.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Aucun paiement enregistré.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Montant</th>
                            <th className="text-left p-2">Méthode</th>
                            <th className="text-left p-2">Notes</th>
                            <th className="text-left p-2 w-12"></th>
                        </tr>
                        </thead>
                        <tbody>
                        {payments.map((p) =>
                            editPayId === p.id ? (
                                <tr key={p.id} className="border-b bg-blue-50">
                                    <td className="p-2">
                                        <input
                                            type="date"
                                            value={(editPay.paidAt ?? p.paidAt).slice(0, 10)}
                                            onChange={(ev) =>
                                                setEditPay({ ...editPay, paidAt: ev.target.value })
                                            }
                                            className="border p-1 rounded text-xs"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <div className="flex gap-1">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editPay.amount ?? p.amount}
                                                onChange={(ev) =>
                                                    setEditPay({
                                                        ...editPay,
                                                        amount: parseFloat(ev.target.value) || 0,
                                                    })
                                                }
                                                className="border p-1 rounded text-xs w-20"
                                            />
                                            <select
                                                value={editPay.currency ?? p.currency}
                                                onChange={(ev) =>
                                                    setEditPay({
                                                        ...editPay,
                                                        currency: ev.target.value as Currency,
                                                    })
                                                }
                                                className="border p-1 rounded text-xs"
                                            >
                                                <option value="CAD">CAD</option>
                                                <option value="XOF">XOF</option>
                                            </select>
                                        </div>
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={editPay.method ?? p.method}
                                            onChange={(ev) =>
                                                setEditPay({
                                                    ...editPay,
                                                    method: ev.target.value as PaymentMethod,
                                                })
                                            }
                                            className="border p-1 rounded text-xs"
                                        >
                                            <option value="CASH">Cash</option>
                                            <option value="TRANSFER">Virement</option>
                                            <option value="MOBILE_MONEY">Mobile money</option>
                                            <option value="OTHER">Autre</option>
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input
                                            value={editPay.notes ?? p.notes ?? ""}
                                            onChange={(ev) =>
                                                setEditPay({ ...editPay, notes: ev.target.value })
                                            }
                                            className="border p-1 rounded text-xs w-full"
                                        />
                                    </td>
                                    <td className="p-2 space-x-1 whitespace-nowrap">
                                        <button
                                            onClick={saveEditPayment}
                                            className="hover:scale-110 transition-transform"
                                            title="Enregistrer"
                                        >
                                            💾
                                        </button>
                                        <button
                                            onClick={cancelEditPayment}
                                            className="hover:scale-110 transition-transform"
                                            title="Annuler"
                                        >
                                            ❌
                                        </button>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 text-xs">{new Date(p.paidAt).toISOString().slice(0, 10)}</td>
                                    <td className="p-2 font-mono font-medium">
                                        {p.amount.toFixed(2)} {p.currency}
                                    </td>
                                    <td className="p-2 text-xs">{METHOD_LABELS[p.method]}</td>
                                    <td className="p-2 text-xs text-gray-600">{p.notes || "—"}</td>
                                    <td className="p-2 space-x-2 whitespace-nowrap">
                                        <button
                                            onClick={() => startEditPayment(p)}
                                            className="hover:scale-110 transition-transform"
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => deletePayment(p.id)}
                                            className="hover:scale-110 transition-transform"
                                            title="Supprimer"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            )
                        )}
                        </tbody>
                    </table>
                )}
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
