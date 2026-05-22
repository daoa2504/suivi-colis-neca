"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Client = {
    key: string;
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    shipmentsCount: number;
    totalWeight: number;
    lastShipmentDate: string;
    unpaidCount: number;
    directions: string[];
};

function fmtDate(s: string) {
    return new Date(s).toLocaleDateString("fr-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Montreal",
    });
}

export default function ClientsTable({ clients }: { clients: Client[] }) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"recent" | "count" | "weight" | "unpaid">("recent");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = clients;
        if (q) {
            list = list.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    (c.phone || "").toLowerCase().includes(q) ||
                    (c.email || "").toLowerCase().includes(q) ||
                    (c.city || "").toLowerCase().includes(q)
            );
        }
        switch (sort) {
            case "count":
                return [...list].sort((a, b) => b.shipmentsCount - a.shipmentsCount);
            case "weight":
                return [...list].sort((a, b) => b.totalWeight - a.totalWeight);
            case "unpaid":
                return [...list].sort((a, b) => b.unpaidCount - a.unpaidCount);
            case "recent":
            default:
                return [...list].sort((a, b) => (a.lastShipmentDate < b.lastShipmentDate ? 1 : -1));
        }
    }, [clients, query, sort]);

    return (
        <div className="space-y-4">
            {/* Barre de recherche + tri + compteur */}
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher (nom, téléphone, email, ville)..."
                    className="flex-1 min-w-[260px] border p-2 rounded-lg text-sm"
                />
                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="border p-2 rounded-lg text-sm bg-white"
                >
                    <option value="recent">Trier : Plus récents</option>
                    <option value="count">Trier : Plus de colis</option>
                    <option value="weight">Trier : Plus de poids</option>
                    <option value="unpaid">Trier : Plus d'impayés</option>
                </select>
                <span className="text-sm text-gray-600 ml-auto">
                    {filtered.length} client{filtered.length > 1 ? "s" : ""}
                </span>
            </div>

            <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-3">Nom</th>
                            <th className="text-left p-3">Téléphone</th>
                            <th className="text-left p-3">Email</th>
                            <th className="text-left p-3">Ville</th>
                            <th className="text-center p-3">Nb colis</th>
                            <th className="text-center p-3">Poids total</th>
                            <th className="text-center p-3">Impayés</th>
                            <th className="text-left p-3">Dernier colis</th>
                            <th className="text-right p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((c) => (
                            <tr key={c.key} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                    <Link
                                        href={`/admin/clients/${encodeURIComponent(c.key)}`}
                                        className="text-blue-700 hover:underline"
                                    >
                                        {c.name || "—"}
                                    </Link>
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {c.directions.map((d) => (
                                            <span
                                                key={d}
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    d === "CA_TO_NE"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-green-100 text-green-700"
                                                }`}
                                            >
                                                {d === "CA_TO_NE" ? "CA→NE" : "NE→CA"}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-3 text-xs font-mono">{c.phone || "—"}</td>
                                <td className="p-3 text-xs">{c.email || "—"}</td>
                                <td className="p-3 text-xs">{c.city || "—"}</td>
                                <td className="p-3 text-center font-mono">{c.shipmentsCount}</td>
                                <td className="p-3 text-center font-mono">{c.totalWeight} kg</td>
                                <td className="p-3 text-center">
                                    {c.unpaidCount > 0 ? (
                                        <span className="inline-block px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                            {c.unpaidCount}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </td>
                                <td className="p-3 text-xs text-gray-600">{fmtDate(c.lastShipmentDate)}</td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/admin/clients/${encodeURIComponent(c.key)}`}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Voir
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-6 text-center text-gray-500">
                                    Aucun client trouvé.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
