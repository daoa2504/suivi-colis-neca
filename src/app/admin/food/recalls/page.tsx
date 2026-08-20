// src/app/admin/food/recalls/page.tsx
// Liste des rappels + KPI + filtres.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { RecallStatus, RecallType, RecallClassification } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<RecallStatus, { label: string; color: string }> = {
    DRAFT: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
    ACTIVE: { label: "Actif", color: "bg-red-100 text-red-800" },
    MONITORING: { label: "Récupération", color: "bg-amber-100 text-amber-800" },
    COMPLETED: { label: "Terminé", color: "bg-blue-100 text-blue-800" },
    CLOSED: { label: "Clôturé", color: "bg-green-100 text-green-800" },
};

const CLASS_LABEL: Record<RecallClassification, { label: string; color: string }> = {
    CLASS_I: { label: "Classe I", color: "bg-red-100 text-red-800" },
    CLASS_II: { label: "Classe II", color: "bg-amber-100 text-amber-800" },
    CLASS_III: { label: "Classe III", color: "bg-gray-100 text-gray-700" },
};

function fmt(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function RecallsListPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; type?: string; q?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const status = sp.status?.toUpperCase() as RecallStatus | undefined;
    const type = sp.type?.toUpperCase() as RecallType | undefined;
    const q = (sp.q ?? "").trim();

    const where: any = {};
    if (status && Object.keys(STATUS_LABEL).includes(status)) where.status = status;
    if (type && ["REAL", "SIMULATION"].includes(type)) where.type = type;
    if (q) {
        where.OR = [
            { recallNumber: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { lot: { lotNumber: { contains: q, mode: "insensitive" } } },
        ];
    }

    const [recalls, byStatus, lastSim] = await Promise.all([
        prisma.foodRecall.findMany({
            where,
            include: {
                lot: { select: { lotNumber: true } },
                _count: { select: { contacts: true } },
            },
            orderBy: { initiatedAt: "desc" },
            take: 500,
        }),
        prisma.foodRecall.groupBy({ by: ["status"], _count: true }),
        prisma.foodRecall.findFirst({
            where: { type: "SIMULATION" },
            orderBy: { initiatedAt: "desc" },
            select: { initiatedAt: true, recallNumber: true },
        }),
    ]);

    const activeCount = byStatus
        .filter((k) => ["ACTIVE", "MONITORING"].includes(k.status))
        .reduce((s, k) => s + k._count, 0);
    const closedCount = byStatus
        .filter((k) => ["COMPLETED", "CLOSED"].includes(k.status))
        .reduce((s, k) => s + k._count, 0);

    const daysSinceLastSim = lastSim
        ? Math.floor((Date.now() - new Date(lastSim.initiatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <span className="text-gray-900">Rappels</span>
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        🔔 Rappels alimentaires
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Retrouvez en secondes tous les clients affectés. Registre 2 ans (Article 7).
                    </p>
                </div>
                <Link
                    href="/admin/food/recalls/new"
                    className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700"
                >
                    + Initier un rappel
                </Link>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Kpi label="Total" value={(activeCount + closedCount).toString()} />
                <Kpi label="Actifs" value={activeCount.toString()} accent="text-red-700" />
                <Kpi label="Terminés / Clôturés" value={closedCount.toString()} accent="text-green-700" />
                <Kpi
                    label="Dernière simulation"
                    value={lastSim
                        ? `Il y a ${daysSinceLastSim}j`
                        : "— (à faire)"
                    }
                    accent={
                        !lastSim || (daysSinceLastSim !== null && daysSinceLastSim > 365)
                            ? "text-red-700"
                            : "text-gray-900"
                    }
                    hint={lastSim ? lastSim.recallNumber : undefined}
                />
            </div>

            {/* Filtres */}
            <form className="mb-4 flex gap-2 flex-wrap" method="get">
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Rechercher n°, lot, description…"
                    className="border rounded px-3 py-2 flex-1 min-w-[240px]"
                />
                <select name="status" defaultValue={status ?? ""} className="border rounded px-3 py-2 bg-white">
                    <option value="">Tous statuts</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select name="type" defaultValue={type ?? ""} className="border rounded px-3 py-2 bg-white">
                    <option value="">Réel + Simulation</option>
                    <option value="REAL">Réel uniquement</option>
                    <option value="SIMULATION">Simulation uniquement</option>
                </select>
                <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">Filtrer</button>
                {(q || status || type) && (
                    <Link href="/admin/food/recalls" className="px-3 py-2 text-sm text-gray-600 underline">
                        Réinitialiser
                    </Link>
                )}
            </form>

            <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Référence</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Lot</th>
                            <th className="p-3">Initié le</th>
                            <th className="p-3">Classe</th>
                            <th className="p-3 text-center">Clients affectés</th>
                            <th className="p-3">Statut</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {recalls.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">
                                    Aucun rappel enregistré.
                                </td>
                            </tr>
                        )}
                        {recalls.map((r) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs font-semibold text-red-800">
                                    {r.recallNumber}
                                </td>
                                <td className="p-3">
                                    {r.type === "SIMULATION" ? (
                                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 font-medium">
                                            Simulation
                                        </span>
                                    ) : (
                                        <span className="text-xs text-red-700 font-semibold">RÉEL</span>
                                    )}
                                </td>
                                <td className="p-3 font-mono text-xs">{r.lot.lotNumber}</td>
                                <td className="p-3 text-xs">{fmt(r.initiatedAt)}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${CLASS_LABEL[r.classification].color}`}>
                                        {CLASS_LABEL[r.classification].label}
                                    </span>
                                </td>
                                <td className="p-3 text-center font-semibold">
                                    {r._count.contacts}
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_LABEL[r.status].color}`}>
                                        {STATUS_LABEL[r.status].label}
                                    </span>
                                </td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/admin/food/recalls/${r.id}`}
                                        className="text-red-700 hover:underline text-sm"
                                    >
                                        Ouvrir →
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

function Kpi({ label, value, accent, hint }: { label: string; value: string; accent?: string; hint?: string }) {
    return (
        <div className="bg-white p-3 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
            {hint && <p className="text-xs text-gray-400 mt-0.5 font-mono">{hint}</p>}
        </div>
    );
}
