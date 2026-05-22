// src/app/admin/payments/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { Prisma, PaymentStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
    PAID: "Payé",
    PARTIAL: "Partiellement payé",
    UNPAID: "Non payé",
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
    PAID: "bg-green-100 text-green-800",
    PARTIAL: "bg-amber-100 text-amber-800",
    UNPAID: "bg-red-100 text-red-800",
};

function fmtDate(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "America/Montreal",
    });
}

type SearchParams = { status?: string; direction?: string };

export default async function AdminPaymentsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const statusFilter = (sp.status || "").toUpperCase();
    const directionFilter = sp.direction || "";

    const where: Prisma.ShipmentWhereInput = {};
    if (["PAID", "PARTIAL", "UNPAID"].includes(statusFilter)) {
        where.paymentStatus = statusFilter as PaymentStatus;
    }
    if (directionFilter === "NE_TO_CA" || directionFilter === "CA_TO_NE") {
        where.convoy = { direction: directionFilter };
    }

    const shipments = await prisma.shipment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
            convoy: { select: { date: true, direction: true } },
            payments: { select: { amount: true, currency: true } },
        },
    });

    // Compteurs globaux pour les chips
    const counts = await prisma.shipment.groupBy({
        by: ["paymentStatus"],
        _count: { paymentStatus: true },
    });
    const countMap: Record<string, number> = {};
    counts.forEach((c) => {
        countMap[c.paymentStatus] = c._count.paymentStatus;
    });
    const totalAll = (countMap.PAID || 0) + (countMap.PARTIAL || 0) + (countMap.UNPAID || 0);

    function buildHref(opts: { status?: string; direction?: string }) {
        const params = new URLSearchParams();
        const s = opts.status ?? statusFilter;
        const d = opts.direction ?? directionFilter;
        if (s) params.set("status", s);
        if (d) params.set("direction", d);
        const qs = params.toString();
        return `/admin/payments${qs ? "?" + qs : ""}`;
    }

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← Retour au dashboard admin
                </Link>
                <h1 className="text-2xl font-bold mt-2">💳 État des paiements</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Visualiser et filtrer rapidement les colis selon leur état de paiement.
                </p>
            </div>

            {/* Filtres par statut (chips) */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm font-medium text-gray-700 mr-2">État :</span>
                <Chip href={buildHref({ status: "" })} active={!statusFilter}>
                    Tous ({totalAll})
                </Chip>
                <Chip
                    href={buildHref({ status: "PAID" })}
                    active={statusFilter === "PAID"}
                    color="green"
                >
                    Payés ({countMap.PAID || 0})
                </Chip>
                <Chip
                    href={buildHref({ status: "PARTIAL" })}
                    active={statusFilter === "PARTIAL"}
                    color="amber"
                >
                    Partiels ({countMap.PARTIAL || 0})
                </Chip>
                <Chip
                    href={buildHref({ status: "UNPAID" })}
                    active={statusFilter === "UNPAID"}
                    color="red"
                >
                    Non payés ({countMap.UNPAID || 0})
                </Chip>
            </div>

            {/* Filtres par direction */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="text-sm font-medium text-gray-700 mr-2">Direction :</span>
                <Chip href={buildHref({ direction: "" })} active={!directionFilter}>
                    Toutes
                </Chip>
                <Chip
                    href={buildHref({ direction: "NE_TO_CA" })}
                    active={directionFilter === "NE_TO_CA"}
                >
                    NE → CA
                </Chip>
                <Chip
                    href={buildHref({ direction: "CA_TO_NE" })}
                    active={directionFilter === "CA_TO_NE"}
                >
                    CA → NE
                </Chip>
            </div>

            {/* Tableau */}
            <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b text-sm text-gray-600">
                    <strong>{shipments.length}</strong> colis affiché{shipments.length > 1 ? "s" : ""}
                </div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-3">Tracking</th>
                            <th className="text-left p-3">Client</th>
                            <th className="text-left p-3">Téléphone</th>
                            <th className="text-left p-3">Convoi</th>
                            <th className="text-left p-3">Ville</th>
                            <th className="text-left p-3">État</th>
                            <th className="text-left p-3">Montant encaissé</th>
                            <th className="text-left p-3">Créé le</th>
                            <th className="text-right p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shipments.map((s) => {
                            const totals = s.payments.reduce<Record<string, number>>(
                                (acc, p) => {
                                    acc[p.currency] = (acc[p.currency] || 0) + p.amount;
                                    return acc;
                                },
                                {}
                            );
                            const totalsStr = Object.entries(totals)
                                .map(([cur, t]) => `${t.toFixed(2)} ${cur}`)
                                .join(" · ");
                            return (
                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-mono text-xs">{s.trackingId}</td>
                                    <td className="p-3">{s.receiverName}</td>
                                    <td className="p-3 text-xs font-mono">{s.receiverPhone || "—"}</td>
                                    <td className="p-3 text-xs text-gray-600">
                                        {s.convoy
                                            ? `${fmtDate(s.convoy.date)} (${
                                                  s.convoy.direction === "CA_TO_NE" ? "CA→NE" : "NE→CA"
                                              })`
                                            : "—"}
                                    </td>
                                    <td className="p-3 text-xs">{s.receiverCity || "—"}</td>
                                    <td className="p-3">
                                        <span
                                            className={`inline-block px-2 py-1 rounded text-xs ${PAYMENT_BADGE[s.paymentStatus]}`}
                                        >
                                            {PAYMENT_LABEL[s.paymentStatus]}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-xs">{totalsStr || "—"}</td>
                                    <td className="p-3 text-xs text-gray-600">{fmtDate(s.createdAt)}</td>
                                    <td className="p-3 text-right">
                                        <Link
                                            href={`/dashboard/shipments/${s.id}/items`}
                                            className="text-xs text-blue-600 hover:underline"
                                        >
                                            Modifier
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {shipments.length === 0 && (
                            <tr>
                                <td colSpan={9} className="p-6 text-center text-gray-500">
                                    Aucun colis avec ces filtres.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </main>
    );
}

function Chip({
    href,
    active,
    color,
    children,
}: {
    href: string;
    active: boolean;
    color?: "green" | "amber" | "red";
    children: React.ReactNode;
}) {
    const activeClass = color
        ? color === "green"
            ? "bg-green-600 text-white"
            : color === "amber"
            ? "bg-amber-600 text-white"
            : "bg-red-600 text-white"
        : "bg-slate-800 text-white";
    const inactiveClass = "bg-gray-100 text-gray-700 hover:bg-gray-200";
    return (
        <Link
            href={href}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active ? activeClass : inactiveClass
            }`}
        >
            {children}
        </Link>
    );
}
