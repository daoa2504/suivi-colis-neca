// src/app/admin/food/clients/page.tsx
// Liste des clients food + recherche + lien vers création / édition.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FoodClientsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; showInactive?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const q = (sp.q ?? "").trim();
    const showInactive = sp.showInactive === "1";

    const where: any = {};
    if (!showInactive) where.active = true;
    if (q) {
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { city: { contains: q, mode: "insensitive" } },
        ];
    }

    const clients = await prisma.foodClient.findMany({
        where,
        orderBy: { name: "asc" },
        take: 500,
    });

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <span className="text-gray-900">Clients</span>
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    👥 Clients food
                </h1>
                <Link
                    href="/admin/food/clients/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
                >
                    + Nouveau client
                </Link>
            </div>

            {/* Recherche */}
            <form className="mb-4 flex gap-2 flex-wrap" method="get">
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Rechercher nom, email, téléphone, ville…"
                    className="border rounded px-3 py-2 flex-1 min-w-[240px]"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700 px-2">
                    <input
                        type="checkbox"
                        name="showInactive"
                        value="1"
                        defaultChecked={showInactive}
                    />
                    Voir aussi désactivés
                </label>
                <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">
                    Filtrer
                </button>
                {(q || showInactive) && (
                    <Link href="/admin/food/clients" className="px-3 py-2 text-sm text-gray-600 underline">
                        Réinitialiser
                    </Link>
                )}
            </form>

            <div className="text-sm text-gray-600 mb-3">
                {clients.length} client{clients.length > 1 ? "s" : ""}
                {clients.length === 500 ? " (limité à 500 — affinez la recherche)" : ""}
            </div>

            {/* Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Code</th>
                            <th className="p-3">Nom</th>
                            <th className="p-3">Contact</th>
                            <th className="p-3">Ville</th>
                            <th className="p-3">Statut</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {clients.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-6 text-center text-gray-500">
                                    Aucun client trouvé.
                                </td>
                            </tr>
                        )}
                        {clients.map((c) => (
                            <tr key={c.id} className={`hover:bg-gray-50 ${!c.active ? "opacity-60" : ""}`}>
                                <td className="p-3 font-mono text-xs font-semibold text-blue-800">
                                    {c.customerCode}
                                </td>
                                <td className="p-3 font-medium">{c.name}</td>
                                <td className="p-3 text-xs text-gray-700">
                                    {c.email && <div>{c.email}</div>}
                                    {c.phone && <div>{c.phone}</div>}
                                    {!c.email && !c.phone && <span className="text-gray-400">—</span>}
                                </td>
                                <td className="p-3">
                                    {c.city ?? "—"}
                                    {c.province ? `, ${c.province}` : ""}
                                </td>
                                <td className="p-3">
                                    {c.active ? (
                                        <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                            Actif
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">
                                            Désactivé
                                        </span>
                                    )}
                                </td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/admin/food/clients/${c.id}`}
                                        className="text-blue-600 hover:underline text-sm"
                                    >
                                        Voir / Modifier
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
