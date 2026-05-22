// src/app/admin/clients/[key]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePhone(p: string | null): string {
    if (!p) return "";
    return p.replace(/\D/g, "");
}

function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
}

const STATUS_FR: Record<string, string> = {
    CREATED: "Créé",
    RECEIVED_IN_NIGER: "Reçu au Niger",
    RECEIVED_IN_CANADA: "Reçu au Canada",
    IN_TRANSIT: "En route",
    IN_TRANSIT_STOP: "En escale",
    IN_CUSTOMS: "À la douane",
    READY_FOR_PICKUP: "Prêt",
    DELIVERED: "Récupéré",
};

export default async function ClientDetailPage({
    params,
}: {
    params: Promise<{ key: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const { key: rawKey } = await params;
    const key = decodeURIComponent(rawKey);

    // Cherche tous les shipments dont le téléphone normalisé OU l'email correspond
    const allShipments = await prisma.shipment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            convoy: { select: { date: true, direction: true } },
            payments: { select: { amount: true, currency: true, paidAt: true } },
        },
    });

    const isPhoneKey = /^\d+$/.test(key);
    const shipments = allShipments.filter((s) => {
        if (isPhoneKey) {
            return normalizePhone(s.receiverPhone) === key;
        }
        return (s.receiverEmail?.toLowerCase().trim() ?? "") === key;
    });

    if (shipments.length === 0) {
        return (
            <main className="p-6 max-w-4xl mx-auto">
                <Link href="/admin/clients" className="text-sm text-blue-600 hover:underline">
                    ← Retour à la liste
                </Link>
                <p className="mt-6 text-gray-600">Aucun colis trouvé pour ce client.</p>
            </main>
        );
    }

    // Info client (depuis le shipment le plus récent)
    const latest = shipments[0];
    const totalWeight = shipments.reduce((s, x) => s + (x.weightKg ?? 0), 0);
    const totalsByCurrency = shipments
        .flatMap((s) => s.payments)
        .reduce<Record<string, number>>((acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + p.amount;
            return acc;
        }, {});

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/clients" className="text-sm text-blue-600 hover:underline">
                    ← Retour à la liste des clients
                </Link>
                <h1 className="text-2xl font-bold mt-2">👤 {latest.receiverName}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                    {latest.receiverPhone && <span>📞 {latest.receiverPhone}</span>}
                    {latest.receiverEmail && <span>✉️ {latest.receiverEmail}</span>}
                    {latest.receiverCity && <span>📍 {latest.receiverCity}</span>}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Stat label="Total colis" value={shipments.length.toString()} />
                <Stat label="Poids total" value={`${totalWeight.toFixed(2)} kg`} />
                <Stat
                    label="Encaissé"
                    value={
                        Object.entries(totalsByCurrency).length > 0
                            ? Object.entries(totalsByCurrency)
                                  .map(([c, t]) => `${t.toFixed(2)} ${c}`)
                                  .join(" · ")
                            : "—"
                    }
                />
                <Stat
                    label="Premier colis"
                    value={fmtDate(shipments[shipments.length - 1].createdAt)}
                />
            </div>

            {/* Tableau historique */}
            <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <h2 className="text-lg font-semibold p-4 border-b">📦 Historique des colis</h2>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-3">Tracking</th>
                            <th className="text-left p-3">Convoi</th>
                            <th className="text-left p-3">Statut</th>
                            <th className="text-left p-3">Poids</th>
                            <th className="text-left p-3">Paiement</th>
                            <th className="text-left p-3">Créé le</th>
                            <th className="text-right p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shipments.map((s) => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-mono text-xs">{s.trackingId}</td>
                                <td className="p-3 text-xs text-gray-600">
                                    {s.convoy
                                        ? `${fmtDate(s.convoy.date)} (${
                                              s.convoy.direction === "CA_TO_NE" ? "CA→NE" : "NE→CA"
                                          })`
                                        : "—"}
                                </td>
                                <td className="p-3 text-xs">
                                    <span className="inline-block px-2 py-1 rounded bg-gray-100 text-gray-700">
                                        {STATUS_FR[s.status] ?? s.status}
                                    </span>
                                </td>
                                <td className="p-3 font-mono text-xs">
                                    {s.weightKg ?? "—"} kg
                                </td>
                                <td className="p-3 text-xs">
                                    <span
                                        className={`px-2 py-1 rounded text-xs ${
                                            s.paymentStatus === "PAID"
                                                ? "bg-green-100 text-green-800"
                                                : s.paymentStatus === "PARTIAL"
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-red-100 text-red-800"
                                        }`}
                                    >
                                        {s.paymentStatus === "PAID"
                                            ? "Payé"
                                            : s.paymentStatus === "PARTIAL"
                                            ? "Partiel"
                                            : "Non payé"}
                                    </span>
                                </td>
                                <td className="p-3 text-xs text-gray-600">{fmtDate(s.createdAt)}</td>
                                <td className="p-3 text-right">
                                    <Link
                                        href={`/dashboard/shipments/${s.id}/items`}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Détails
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </main>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );
}
