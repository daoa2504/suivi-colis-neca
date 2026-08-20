// src/app/admin/food/lots/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { FoodLotStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<FoodLotStatus, { label: string; color: string }> = {
    IN_TRANSIT: { label: "En transit", color: "bg-amber-100 text-amber-800" },
    DELIVERED: { label: "Livré", color: "bg-green-100 text-green-800" },
    RECALLED: { label: "Rappelé", color: "bg-red-100 text-red-800" },
};

function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

export default async function FoodLotsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const q = (sp.q ?? "").trim();
    const status = (sp.status?.toUpperCase() as FoodLotStatus) || null;

    const where: any = { active: true };
    if (status && Object.keys(STATUS_LABEL).includes(status)) where.status = status;
    if (q) {
        where.OR = [
            { lotNumber: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { awbNumber: { contains: q, mode: "insensitive" } },
            { supplier: { contains: q, mode: "insensitive" } },
        ];
    }

    const lots = await prisma.foodLot.findMany({
        where,
        orderBy: { importDate: "desc" },
        take: 500,
    });

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <span className="text-gray-900">Lots</span>
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    📦 Lots importés
                </h1>
                <Link
                    href="/admin/food/lots/new"
                    className="bg-emerald-600 text-white px-4 py-2 rounded font-medium hover:bg-emerald-700"
                >
                    + Nouveau lot
                </Link>
            </div>

            {/* Recherche */}
            <form className="mb-4 flex gap-2 flex-wrap" method="get">
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Rechercher lot, produit, AWB, fournisseur…"
                    className="border rounded px-3 py-2 flex-1 min-w-[240px]"
                />
                <select name="status" defaultValue={status ?? ""} className="border rounded px-3 py-2 bg-white">
                    <option value="">Tous les statuts</option>
                    <option value="IN_TRANSIT">En transit</option>
                    <option value="DELIVERED">Livré</option>
                    <option value="RECALLED">Rappelé</option>
                </select>
                <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">
                    Filtrer
                </button>
                {(q || status) && (
                    <Link href="/admin/food/lots" className="px-3 py-2 text-sm text-gray-600 underline">
                        Réinitialiser
                    </Link>
                )}
            </form>

            <div className="text-sm text-gray-600 mb-3">
                {lots.length} lot{lots.length > 1 ? "s" : ""}
            </div>

            <div className="bg-white border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Lot</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Fournisseur</th>
                            <th className="p-3">Import</th>
                            <th className="p-3 text-right">Quantité (kg)</th>
                            <th className="p-3">Statut</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {lots.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-6 text-center text-gray-500">
                                    Aucun lot trouvé.
                                </td>
                            </tr>
                        )}
                        {lots.map((lot) => (
                            <tr key={lot.id} className="hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs font-semibold">{lot.lotNumber}</td>
                                <td className="p-3 max-w-[280px] truncate" title={lot.description}>
                                    {lot.description}
                                </td>
                                <td className="p-3 text-sm">
                                    {lot.supplier ?? "—"}
                                    {lot.supplierCity && (
                                        <div className="text-xs text-gray-500">{lot.supplierCity}</div>
                                    )}
                                </td>
                                <td className="p-3 text-xs">{fmtDate(lot.importDate)}</td>
                                <td className="p-3 text-right font-mono">
                                    {lot.quantityKg.toLocaleString("fr-CA", { maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_LABEL[lot.status].color}`}>
                                        {STATUS_LABEL[lot.status].label}
                                    </span>
                                </td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/admin/food/lots/${lot.id}`}
                                        className="text-emerald-700 hover:underline text-sm"
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
