"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = "SALARY" | "CUSTOMS" | "PACKAGING" | "FUEL" | "SHIPPING" | "OTHER";
type Currency = "CAD" | "XOF";

type Expense = {
    id: string;
    category: Category;
    subcategory: string | null;
    amount: number;
    currency: Currency;
    date: string;
    convoyId: string | null;
    convoyLabel: string | null;
    notes: string | null;
};

const CATEGORY_LABELS: Record<Category, string> = {
    SALARY: "Salaire",
    CUSTOMS: "Dédouanement",
    PACKAGING: "Emballage",
    FUEL: "Carburant",
    SHIPPING: "Expédition",
    OTHER: "Autre",
};

const CATEGORY_BADGE: Record<Category, string> = {
    SALARY: "bg-blue-100 text-blue-800",
    CUSTOMS: "bg-amber-100 text-amber-800",
    PACKAGING: "bg-purple-100 text-purple-800",
    FUEL: "bg-orange-100 text-orange-800",
    SHIPPING: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-800",
};

export default function ExpensesManager({
    initialExpenses,
    convoys,
}: {
    initialExpenses: Expense[];
    convoys: { id: string; label: string }[];
}) {
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<"" | Category>("");

    // Formulaire
    const [category, setCategory] = useState<Category>("SALARY");
    const [subcategory, setSubcategory] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("CAD");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [convoyId, setConvoyId] = useState("");
    const [notes, setNotes] = useState("");

    const filtered = filterCategory
        ? expenses.filter((e) => e.category === filterCategory)
        : expenses;

    const totals = filtered.reduce(
        (acc, e) => {
            acc[e.currency] = (acc[e.currency] || 0) + e.amount;
            return acc;
        },
        {} as Record<Currency, number>
    );

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) return;
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category,
                    subcategory: subcategory.trim() || null,
                    amount: parseFloat(amount),
                    currency,
                    date,
                    convoyId: convoyId || null,
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            const convoyLabel = convoys.find((c) => c.id === convoyId)?.label ?? null;
            setExpenses((prev) =>
                [
                    {
                        id: data.expense.id,
                        category: data.expense.category,
                        subcategory: data.expense.subcategory,
                        amount: data.expense.amount,
                        currency: data.expense.currency,
                        date: new Date(data.expense.date).toISOString().slice(0, 10),
                        convoyId: data.expense.convoyId,
                        convoyLabel,
                        notes: data.expense.notes,
                    },
                    ...prev,
                ].sort((a, b) => (a.date < b.date ? 1 : -1))
            );
            setAmount("");
            setSubcategory("");
            setNotes("");
            setConvoyId("");
            setMsg("✅ Dépense ajoutée");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function onDelete(id: string) {
        if (!confirm("Supprimer cette dépense ?")) return;
        try {
            const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            setMsg("✅ Dépense supprimée");
            router.refresh();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    // État pour l'édition inline
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Expense>>({});

    function startEdit(e: Expense) {
        setEditingId(e.id);
        setEditForm({ ...e });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditForm({});
    }

    async function saveEdit() {
        if (!editingId) return;
        setMsg(null);
        try {
            const res = await fetch(`/api/expenses/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: editForm.category,
                    subcategory: editForm.subcategory || null,
                    amount: editForm.amount,
                    currency: editForm.currency,
                    date: editForm.date,
                    convoyId: editForm.convoyId || null,
                    notes: editForm.notes || null,
                }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur");
            const convoyLabel = convoys.find((c) => c.id === editForm.convoyId)?.label ?? null;
            setExpenses((prev) =>
                prev.map((e) =>
                    e.id === editingId
                        ? {
                              ...e,
                              category: data.expense.category,
                              subcategory: data.expense.subcategory,
                              amount: data.expense.amount,
                              currency: data.expense.currency,
                              date: new Date(data.expense.date).toISOString().slice(0, 10),
                              convoyId: data.expense.convoyId,
                              convoyLabel,
                              notes: data.expense.notes,
                          }
                        : e
                )
            );
            setEditingId(null);
            setEditForm({});
            setMsg("✅ Dépense modifiée");
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

            {/* Formulaire d'ajout */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">➕ Nouvelle dépense</h2>
                <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Catégorie <span className="text-red-600">*</span>
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as Category)}
                            className="border p-2 rounded w-full"
                            required
                        >
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Sous-catégorie (libellé)</label>
                        <input
                            value={subcategory}
                            onChange={(e) => setSubcategory(e.target.value)}
                            placeholder="ex: Salaire agent Sherbrooke"
                            className="border p-2 rounded w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Montant <span className="text-red-600">*</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="border p-2 rounded flex-1"
                                required
                            />
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="border p-2 rounded"
                            >
                                <option value="CAD">CAD</option>
                                <option value="XOF">XOF</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Date <span className="text-red-600">*</span>
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="border p-2 rounded w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Convoi (optionnel)</label>
                        <select
                            value={convoyId}
                            onChange={(e) => setConvoyId(e.target.value)}
                            className="border p-2 rounded w-full bg-white"
                        >
                            <option value="">— Non rattaché —</option>
                            {convoys.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="(optionnel)"
                            className="border p-2 rounded w-full"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={loading || !amount}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? "Ajout…" : "Ajouter la dépense"}
                        </button>
                    </div>
                </form>
            </section>

            {/* Filtre + totaux */}
            <section className="bg-white p-4 rounded-lg border shadow-sm flex flex-wrap items-center gap-4">
                <div>
                    <label className="text-sm font-medium mr-2">Filtrer par catégorie :</label>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value as any)}
                        className="border p-1.5 rounded text-sm"
                    >
                        <option value="">Toutes</option>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 ml-auto text-sm text-gray-700">
                    <span className="font-medium">Total {filterCategory ? `(${CATEGORY_LABELS[filterCategory]})` : ""} :</span>
                    {Object.entries(totals).length === 0 && <span className="text-gray-400">—</span>}
                    {Object.entries(totals).map(([cur, total]) => (
                        <span
                            key={cur}
                            className="px-2 py-1 bg-red-50 text-red-800 rounded font-mono"
                        >
                            {total.toFixed(2)} {cur}
                        </span>
                    ))}
                </div>
            </section>

            {/* Liste */}
            <section className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">
                        Liste des dépenses ({filtered.length})
                    </h2>
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Catégorie</th>
                        <th className="text-left p-3">Libellé</th>
                        <th className="text-left p-3">Montant</th>
                        <th className="text-left p-3">Convoi</th>
                        <th className="text-left p-3">Notes</th>
                        <th className="text-left p-3 w-12"></th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((e) =>
                        editingId === e.id ? (
                            <tr key={e.id} className="border-b bg-blue-50">
                                <td className="p-2">
                                    <input
                                        type="date"
                                        value={editForm.date ?? ""}
                                        onChange={(ev) =>
                                            setEditForm({ ...editForm, date: ev.target.value })
                                        }
                                        className="border p-1 rounded text-xs w-full"
                                    />
                                </td>
                                <td className="p-2">
                                    <select
                                        value={editForm.category ?? "OTHER"}
                                        onChange={(ev) =>
                                            setEditForm({
                                                ...editForm,
                                                category: ev.target.value as Category,
                                            })
                                        }
                                        className="border p-1 rounded text-xs w-full"
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <input
                                        value={editForm.subcategory ?? ""}
                                        onChange={(ev) =>
                                            setEditForm({
                                                ...editForm,
                                                subcategory: ev.target.value,
                                            })
                                        }
                                        className="border p-1 rounded text-sm w-full"
                                        placeholder="Libellé"
                                    />
                                </td>
                                <td className="p-2">
                                    <div className="flex gap-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.amount ?? 0}
                                            onChange={(ev) =>
                                                setEditForm({
                                                    ...editForm,
                                                    amount: parseFloat(ev.target.value) || 0,
                                                })
                                            }
                                            className="border p-1 rounded text-xs w-20"
                                        />
                                        <select
                                            value={editForm.currency ?? "CAD"}
                                            onChange={(ev) =>
                                                setEditForm({
                                                    ...editForm,
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
                                        value={editForm.convoyId ?? ""}
                                        onChange={(ev) =>
                                            setEditForm({ ...editForm, convoyId: ev.target.value })
                                        }
                                        className="border p-1 rounded text-xs w-full"
                                    >
                                        <option value="">—</option>
                                        {convoys.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <input
                                        value={editForm.notes ?? ""}
                                        onChange={(ev) =>
                                            setEditForm({ ...editForm, notes: ev.target.value })
                                        }
                                        className="border p-1 rounded text-xs w-full"
                                    />
                                </td>
                                <td className="p-2 space-x-1 whitespace-nowrap">
                                    <button
                                        onClick={saveEdit}
                                        className="text-green-600 hover:scale-110 transition-transform"
                                        title="Enregistrer"
                                    >
                                        💾
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="text-gray-500 hover:scale-110 transition-transform"
                                        title="Annuler"
                                    >
                                        ❌
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            <tr key={e.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 text-xs font-mono">{e.date}</td>
                                <td className="p-3">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_BADGE[e.category]}`}
                                    >
                                        {CATEGORY_LABELS[e.category]}
                                    </span>
                                </td>
                                <td className="p-3 text-sm">{e.subcategory || "—"}</td>
                                <td className="p-3 font-mono font-medium">
                                    {e.amount.toFixed(2)} {e.currency}
                                </td>
                                <td className="p-3 text-xs text-gray-600">{e.convoyLabel || "—"}</td>
                                <td
                                    className="p-3 text-xs text-gray-600 max-w-[200px] truncate"
                                    title={e.notes ?? ""}
                                >
                                    {e.notes || "—"}
                                </td>
                                <td className="p-3 space-x-2 whitespace-nowrap">
                                    <button
                                        onClick={() => startEdit(e)}
                                        className="hover:scale-110 transition-transform"
                                        title="Modifier"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => onDelete(e.id)}
                                        className="hover:scale-110 transition-transform"
                                        title="Supprimer"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        )
                    )}
                    {filtered.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-6 text-center text-gray-500">
                                Aucune dépense.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
