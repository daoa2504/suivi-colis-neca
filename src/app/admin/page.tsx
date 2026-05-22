import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { convert } from "@/lib/forex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("fr-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

function fmtMoney(n: number, cur = "CAD") {
    return `${n.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} ${cur}`;
}

export default async function AdminPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN") {
        redirect("/");
    }

    // === Période : mois en cours ===
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // KPI : nombre de colis ce mois
    const shipmentsThisMonth = await prisma.shipment.count({
        where: { createdAt: { gte: startOfMonth } },
    });

    // KPI : encaissé ce mois (somme paiements, conversion CAD)
    const paymentsThisMonth = await prisma.payment.findMany({
        where: { paidAt: { gte: startOfMonth } },
        select: { amount: true, currency: true },
    });
    let incomeCad = 0;
    for (const p of paymentsThisMonth) {
        if (p.currency === "CAD") incomeCad += p.amount;
        else {
            try {
                incomeCad += await convert(p.amount, p.currency as any, "CAD");
            } catch {
                /* ignore forex errors */
            }
        }
    }

    // KPI : dépensé ce mois
    const expensesThisMonth = await prisma.expense.findMany({
        where: { date: { gte: startOfMonth } },
        select: { amount: true, currency: true },
    });
    let expenseCad = 0;
    for (const e of expensesThisMonth) {
        if (e.currency === "CAD") expenseCad += e.amount;
        else {
            try {
                expenseCad += await convert(e.amount, e.currency as any, "CAD");
            } catch {
                /* ignore */
            }
        }
    }

    // Activité récente (5 derniers colis + 5 derniers paiements)
    const [recentShipments, recentPayments] = await Promise.all([
        prisma.shipment.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                createdAt: true,
                status: true,
                createdBy: { select: { username: true } },
            },
        }),
        prisma.payment.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                amount: true,
                currency: true,
                createdAt: true,
                shipment: { select: { trackingId: true, receiverName: true } },
                createdBy: { select: { username: true } },
            },
        }),
    ]);

    // Alertes
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [stuckInCustoms, stuckReady, unpaidDelivered] = await Promise.all([
        prisma.shipment.count({
            where: { status: "IN_CUSTOMS", updatedAt: { lte: sevenDaysAgo } },
        }),
        prisma.shipment.count({
            where: { status: "READY_FOR_PICKUP", readyAt: { lte: thirtyDaysAgo } },
        }),
        prisma.shipment.count({
            where: {
                status: "DELIVERED",
                paymentStatus: { not: "PAID" },
            },
        }),
    ]);

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Dashboard Admin</h1>

            {/* === KPI du mois === */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Ce mois-ci
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Nouveaux colis" value={shipmentsThisMonth.toString()} accent="text-blue-700" />
                    <Kpi label="Encaissé" value={fmtMoney(incomeCad)} accent="text-green-700" />
                    <Kpi label="Dépensé" value={fmtMoney(expenseCad)} accent="text-red-700" />
                    <Kpi
                        label="Solde"
                        value={fmtMoney(incomeCad - expenseCad)}
                        accent={incomeCad - expenseCad >= 0 ? "text-green-700" : "text-red-700"}
                    />
                </div>
            </section>

            {/* === Alertes === */}
            {(stuckInCustoms > 0 || stuckReady > 0 || unpaidDelivered > 0) && (
                <section className="mb-8">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                        🔔 Points d'attention
                    </h2>
                    <div className="space-y-2">
                        {stuckInCustoms > 0 && (
                            <Alert color="amber" href="/dashboard/shipments">
                                <strong>{stuckInCustoms}</strong> colis bloqué{stuckInCustoms > 1 ? "s" : ""} à la douane depuis plus de 7 jours
                            </Alert>
                        )}
                        {stuckReady > 0 && (
                            <Alert color="amber" href="/dashboard/shipments">
                                <strong>{stuckReady}</strong> colis prêt{stuckReady > 1 ? "s" : ""} pour récupération depuis plus de 30 jours
                            </Alert>
                        )}
                        {unpaidDelivered > 0 && (
                            <Alert color="red" href="/dashboard/shipments">
                                <strong>{unpaidDelivered}</strong> colis livré{unpaidDelivered > 1 ? "s" : ""} avec un paiement incomplet
                            </Alert>
                        )}
                    </div>
                </section>
            )}

            {/* === Activité récente (2 colonnes) === */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <h3 className="font-semibold p-4 border-b text-sm uppercase tracking-widest text-gray-500">
                        📦 Derniers colis
                    </h3>
                    {recentShipments.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">Aucun colis récent.</p>
                    ) : (
                        <ul className="divide-y">
                            {recentShipments.map((s) => (
                                <li key={s.id} className="p-3 text-sm hover:bg-gray-50">
                                    <Link href={`/dashboard/shipments/${s.id}/items`} className="block">
                                        <div className="flex justify-between items-baseline">
                                            <span className="font-mono text-xs">{s.trackingId}</span>
                                            <span className="text-xs text-gray-500">{fmt(s.createdAt)}</span>
                                        </div>
                                        <p className="font-medium">{s.receiverName}</p>
                                        <p className="text-xs text-gray-500">
                                            par {s.createdBy?.username ?? "—"}
                                        </p>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <h3 className="font-semibold p-4 border-b text-sm uppercase tracking-widest text-gray-500">
                        💳 Derniers paiements
                    </h3>
                    {recentPayments.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">Aucun paiement récent.</p>
                    ) : (
                        <ul className="divide-y">
                            {recentPayments.map((p) => (
                                <li key={p.id} className="p-3 text-sm hover:bg-gray-50">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-mono text-xs">{p.shipment?.trackingId}</span>
                                        <span className="text-xs text-gray-500">{fmt(p.createdAt)}</span>
                                    </div>
                                    <p className="font-medium">
                                        <span className="font-mono">
                                            {p.amount.toFixed(2)} {p.currency}
                                        </span>{" "}
                                        — {p.shipment?.receiverName}
                                    </p>
                                    <p className="text-xs text-gray-500">par {p.createdBy?.username ?? "—"}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {/* === Cartes de navigation === */}
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Accès rapide
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                    href="/admin/convoys"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">🚚</div>
                    <h2 className="font-semibold text-lg mb-1">Gestion des convois</h2>
                    <p className="text-sm text-gray-600">
                        Créer, lister et supprimer les convois. Les agents ne peuvent enregistrer
                        que sur des convois existants.
                    </p>
                </Link>
                <Link
                    href="/dashboard/shipments"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">📦</div>
                    <h2 className="font-semibold text-lg mb-1">Tous les colis</h2>
                    <p className="text-sm text-gray-600">
                        Voir et gérer tous les colis (NE→CA et CA→NE).
                    </p>
                </Link>
                <Link
                    href="/dashboard/notify"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">📧</div>
                    <h2 className="font-semibold text-lg mb-1">Notifications convoi</h2>
                    <p className="text-sm text-gray-600">
                        Envoyer les emails "en route", "douane", "prêt à récupérer".
                    </p>
                </Link>

                <Link
                    href="/admin/finances"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-green-400 transition-all"
                >
                    <div className="text-3xl mb-2">💰</div>
                    <h2 className="font-semibold text-lg mb-1">Trésorerie</h2>
                    <p className="text-sm text-gray-600">
                        Paiements clients, dépenses, dashboard et taux de change.
                    </p>
                </Link>

                <Link
                    href="/admin/users"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-indigo-400 transition-all"
                >
                    <div className="text-3xl mb-2">👥</div>
                    <h2 className="font-semibold text-lg mb-1">Utilisateurs</h2>
                    <p className="text-sm text-gray-600">
                        Activité de chaque agent (colis créés, paiements, notifications) et réinitialisation de mot de passe.
                    </p>
                </Link>

                <Link
                    href="/admin/clients"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-amber-400 transition-all"
                >
                    <div className="text-3xl mb-2">👤</div>
                    <h2 className="font-semibold text-lg mb-1">Clients</h2>
                    <p className="text-sm text-gray-600">
                        Liste des clients uniques et historique complet de leurs colis.
                    </p>
                </Link>
            </div>
        </main>
    );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
        </div>
    );
}

function Alert({
    color,
    href,
    children,
}: {
    color: "amber" | "red";
    href: string;
    children: React.ReactNode;
}) {
    const colorMap = {
        amber: "bg-amber-50 border-amber-300 text-amber-900",
        red: "bg-red-50 border-red-300 text-red-900",
    };
    return (
        <Link
            href={href}
            className={`block p-3 rounded-lg border-l-4 ${colorMap[color]} hover:opacity-90 transition-opacity text-sm`}
        >
            ⚠️ {children}
        </Link>
    );
}