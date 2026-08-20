// src/app/admin/food/complaints/page.tsx
// Liste des plaintes food + filtres + KPI.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { ComplaintStatus, ComplaintRiskLevel, HealthRiskCategory } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ComplaintStatus, { label: string; color: string }> = {
    RECEIVED: { label: "Reçue", color: "bg-blue-100 text-blue-800" },
    INVESTIGATION: { label: "Enquête", color: "bg-amber-100 text-amber-800" },
    SUPPLIER_CONTACTED: { label: "Fournisseur contacté", color: "bg-purple-100 text-purple-800" },
    RESPONDED: { label: "Client informé", color: "bg-cyan-100 text-cyan-800" },
    RESOLVED: { label: "Résolue", color: "bg-green-100 text-green-800" },
    CLOSED: { label: "Fermée", color: "bg-gray-200 text-gray-700" },
};

const RISK_LABEL: Record<ComplaintRiskLevel, { label: string; color: string }> = {
    HIGH: { label: "Élevé", color: "bg-red-100 text-red-800" },
    MEDIUM: { label: "Moyen", color: "bg-amber-100 text-amber-800" },
    LOW: { label: "Faible", color: "bg-gray-100 text-gray-700" },
    NONE: { label: "Aucun", color: "bg-gray-100 text-gray-500" },
};

const CATEGORY_LABEL: Record<HealthRiskCategory, string> = {
    BIOLOGICAL: "Biologique",
    CHEMICAL: "Chimique",
    PHYSICAL: "Physique",
    QUALITY: "Qualité",
    OTHER: "Autre",
    NONE: "—",
};

function fmt(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ComplaintsListPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; riskLevel?: string; q?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const status = sp.status?.toUpperCase();
    const riskLevel = sp.riskLevel?.toUpperCase();
    const q = (sp.q ?? "").trim();

    const where: any = {};
    if (status && Object.keys(STATUS_LABEL).includes(status)) where.status = status;
    if (riskLevel && Object.keys(RISK_LABEL).includes(riskLevel)) where.riskLevel = riskLevel;
    if (q) {
        where.OR = [
            { complaintNumber: { contains: q, mode: "insensitive" } },
            { clientNameSnapshot: { contains: q, mode: "insensitive" } },
            { lotNumberSnapshot: { contains: q, mode: "insensitive" } },
            { natureDescription: { contains: q, mode: "insensitive" } },
        ];
    }

    const [complaints, kpi] = await Promise.all([
        prisma.foodComplaint.findMany({
            where,
            include: {
                lot: { select: { lotNumber: true } },
            },
            orderBy: { receivedAt: "desc" },
            take: 500,
        }),
        prisma.foodComplaint.groupBy({
            by: ["status"],
            _count: true,
        }),
    ]);

    const openCount = kpi
        .filter((k) => !["RESOLVED", "CLOSED"].includes(k.status))
        .reduce((s, k) => s + k._count, 0);
    const closedCount = kpi
        .filter((k) => ["RESOLVED", "CLOSED"].includes(k.status))
        .reduce((s, k) => s + k._count, 0);

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <span className="text-gray-900">Plaintes</span>
            </div>

            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        ⚠️ Plaintes alimentaires
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Registre Article 82 RSAC — conservation min. 2 ans.
                    </p>
                </div>
                <Link
                    href="/admin/food/complaints/new"
                    className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700"
                >
                    + Nouvelle plainte (saisie manuelle)
                </Link>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Kpi label="Total" value={(openCount + closedCount).toString()} />
                <Kpi label="Ouvertes" value={openCount.toString()} accent="text-red-700" />
                <Kpi label="Résolues" value={closedCount.toString()} accent="text-green-700" />
                <Kpi
                    label="Risque élevé"
                    value={complaints.filter((c) => c.riskLevel === "HIGH" && !["RESOLVED", "CLOSED"].includes(c.status)).length.toString()}
                    accent="text-red-800"
                />
            </div>

            {/* Filtres */}
            <form className="mb-4 flex gap-2 flex-wrap" method="get">
                <input
                    name="q"
                    defaultValue={q}
                    placeholder="Rechercher n°, client, lot, description…"
                    className="border rounded px-3 py-2 flex-1 min-w-[240px]"
                />
                <select name="status" defaultValue={status ?? ""} className="border rounded px-3 py-2 bg-white">
                    <option value="">Tous statuts</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <select name="riskLevel" defaultValue={riskLevel ?? ""} className="border rounded px-3 py-2 bg-white">
                    <option value="">Tous risques</option>
                    {Object.entries(RISK_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>Risque {v.label}</option>
                    ))}
                </select>
                <button className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900">
                    Filtrer
                </button>
                {(q || status || riskLevel) && (
                    <Link href="/admin/food/complaints" className="px-3 py-2 text-sm text-gray-600 underline">
                        Réinitialiser
                    </Link>
                )}
            </form>

            {/* Table */}
            <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                            <th className="p-3">Référence</th>
                            <th className="p-3">Reçue le</th>
                            <th className="p-3">Client</th>
                            <th className="p-3">Lot</th>
                            <th className="p-3">Nature</th>
                            <th className="p-3">Risque</th>
                            <th className="p-3">Statut</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {complaints.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">
                                    Aucune plainte trouvée.
                                </td>
                            </tr>
                        )}
                        {complaints.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs font-semibold text-red-800">
                                    {c.complaintNumber}
                                </td>
                                <td className="p-3 text-xs">{fmt(c.receivedAt)}</td>
                                <td className="p-3">{c.clientNameSnapshot}</td>
                                <td className="p-3 font-mono text-xs">
                                    {c.lotNumberSnapshot ?? <span className="text-gray-400">—</span>}
                                </td>
                                <td className="p-3 text-xs">{CATEGORY_LABEL[c.natureCategory]}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_LABEL[c.riskLevel].color}`}>
                                        {RISK_LABEL[c.riskLevel].label}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_LABEL[c.status].color}`}>
                                        {STATUS_LABEL[c.status].label}
                                    </span>
                                </td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/admin/food/complaints/${c.id}`}
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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="bg-white p-3 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
        </div>
    );
}
