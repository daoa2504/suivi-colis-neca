"use client";

import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
} from "recharts";

type Summary = {
    currency: "CAD" | "XOF";
    totals: { income: number; expense: number; balance: number };
    monthly: { label: string; income: number; expense: number; balance: number }[];
    byConvoy: {
        convoyId: string;
        label: string;
        date: string;
        income: number;
        expense: number;
        balance: number;
    }[];
    byCategory: { category: string; total: number }[];
};

const CATEGORY_LABELS: Record<string, string> = {
    SALARY: "Salaire",
    CUSTOMS: "Dédouanement",
    PACKAGING: "Emballage",
    FUEL: "Carburant",
    SHIPPING: "Expédition",
    OTHER: "Autre",
};

const CATEGORY_COLORS: Record<string, string> = {
    SALARY: "#3b82f6",
    CUSTOMS: "#f59e0b",
    PACKAGING: "#a855f7",
    FUEL: "#f97316",
    SHIPPING: "#06b6d4",
    OTHER: "#6b7280",
};

function formatMoney(n: number, currency: string) {
    return `${n.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} ${currency}`;
}

export default function FinanceDashboard() {
    const [currency, setCurrency] = useState<"CAD" | "XOF">("CAD");
    const [view, setView] = useState<"monthly" | "convoy">("monthly");
    const [data, setData] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setErr(null);
        fetch(`/api/admin/finance-summary?currency=${currency}`)
            .then((r) => r.json())
            .then((d) => {
                if (!d.ok) throw new Error(d.error || "Erreur");
                setData(d);
            })
            .catch((e) => setErr(e.message))
            .finally(() => setLoading(false));
    }, [currency]);

    if (loading) return <p className="text-sm text-gray-500 italic">Chargement…</p>;
    if (err)
        return (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded">
                {err}
            </p>
        );
    if (!data) return null;

    const chartData = view === "monthly" ? data.monthly : data.byConvoy;
    const xKey = view === "monthly" ? "label" : "label";

    return (
        <div className="space-y-6">
            {/* Sélecteur de devise + vue */}
            <div className="flex flex-wrap gap-4 items-center">
                <div>
                    <label className="text-sm font-medium mr-2">Devise :</label>
                    <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as any)}
                        className="border p-1.5 rounded text-sm bg-white"
                    >
                        <option value="CAD">CAD</option>
                        <option value="XOF">XOF (FCFA)</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium mr-2">Vue :</label>
                    <div className="inline-flex rounded-md shadow-sm border">
                        <button
                            type="button"
                            onClick={() => setView("monthly")}
                            className={`px-3 py-1.5 text-sm ${
                                view === "monthly"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            Mensuel
                        </button>
                        <button
                            type="button"
                            onClick={() => setView("convoy")}
                            className={`px-3 py-1.5 text-sm border-l ${
                                view === "convoy"
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                        >
                            Par convoi
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-lg border shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Total encaissé</div>
                    <div className="text-2xl font-bold text-green-700 mt-1">
                        {formatMoney(data.totals.income, currency)}
                    </div>
                </div>
                <div className="bg-white p-5 rounded-lg border shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Total dépensé</div>
                    <div className="text-2xl font-bold text-red-600 mt-1">
                        {formatMoney(data.totals.expense, currency)}
                    </div>
                </div>
                <div className="bg-white p-5 rounded-lg border shadow-sm">
                    <div className="text-xs text-gray-500 uppercase font-semibold">Solde</div>
                    <div
                        className={`text-2xl font-bold mt-1 ${
                            data.totals.balance >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                    >
                        {formatMoney(data.totals.balance, currency)}
                    </div>
                </div>
            </div>

            {/* Bar chart entrées vs sorties */}
            <section className="bg-white p-4 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">
                    Entrées vs Sorties — {view === "monthly" ? "12 derniers mois" : "Par convoi"}
                </h2>
                <div className="w-full h-80">
                    <ResponsiveContainer>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(v: any) => formatMoney(Number(v), currency)}
                            />
                            <Legend />
                            <Bar dataKey="income" name="Entrées" fill="#16a34a" />
                            <Bar dataKey="expense" name="Sorties" fill="#dc2626" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>

            {/* Line chart solde cumulé (mensuel uniquement) */}
            {view === "monthly" && (
                <section className="bg-white p-4 rounded-lg border shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Solde mensuel</h2>
                    <div className="w-full h-64">
                        <ResponsiveContainer>
                            <LineChart data={data.monthly}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip
                                    formatter={(v: any) => formatMoney(Number(v), currency)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="balance"
                                    name="Solde"
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* Pie chart par catégorie */}
            {data.byCategory.length > 0 && (
                <section className="bg-white p-4 rounded-lg border shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Répartition des dépenses</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="w-full h-72">
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={data.byCategory.map((c) => ({
                                            name: CATEGORY_LABELS[c.category] ?? c.category,
                                            value: c.total,
                                            key: c.category,
                                        }))}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={90}
                                        label={({ name, percent }) =>
                                            `${name} ${(percent! * 100).toFixed(0)}%`
                                        }
                                    >
                                        {data.byCategory.map((c) => (
                                            <Cell
                                                key={c.category}
                                                fill={CATEGORY_COLORS[c.category] ?? "#888"}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v: any) => formatMoney(Number(v), currency)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left p-2">Catégorie</th>
                                    <th className="text-right p-2">Montant</th>
                                    <th className="text-right p-2">%</th>
                                </tr>
                                </thead>
                                <tbody>
                                {data.byCategory
                                    .sort((a, b) => b.total - a.total)
                                    .map((c) => {
                                        const pct =
                                            data.totals.expense > 0
                                                ? (c.total / data.totals.expense) * 100
                                                : 0;
                                        return (
                                            <tr key={c.category} className="border-b">
                                                <td className="p-2 flex items-center gap-2">
                                                        <span
                                                            className="w-3 h-3 rounded-sm inline-block"
                                                            style={{
                                                                background:
                                                                    CATEGORY_COLORS[c.category] ?? "#888",
                                                            }}
                                                        />
                                                    {CATEGORY_LABELS[c.category] ?? c.category}
                                                </td>
                                                <td className="p-2 text-right font-mono">
                                                    {formatMoney(c.total, currency)}
                                                </td>
                                                <td className="p-2 text-right text-gray-600">
                                                    {pct.toFixed(1)}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
