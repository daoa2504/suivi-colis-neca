// src/app/admin/users/[id]/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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
        timeZone: "America/Montreal",
    });
}

const ROLE_LABEL: Record<string, string> = {
    ADMIN: "Admin",
    AGENT_CA: "Agent Canada",
    AGENT_NE: "Agent Niger",
};

const TEMPLATE_LABEL: Record<string, string> = {
    EN_ROUTE: "En route",
    IN_CUSTOMS: "À la douane",
    OUT_FOR_DELIVERY: "Prêt pour récupération",
    DELIVERED: "Remerciement (livré)",
};

export default async function UserDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ convoyId?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const filterConvoyId = sp.convoyId || "";

    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            shipmentsCreated: {
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                    id: true,
                    trackingId: true,
                    receiverName: true,
                    status: true,
                    createdAt: true,
                    convoyId: true,
                    convoy: { select: { date: true, direction: true } },
                },
            },
            paymentsCreated: {
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    method: true,
                    createdAt: true,
                    shipment: {
                        select: {
                            trackingId: true,
                            receiverName: true,
                            convoyId: true,
                        },
                    },
                },
            },
            expensesCreated: {
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                    id: true,
                    category: true,
                    subcategory: true,
                    amount: true,
                    currency: true,
                    date: true,
                    convoyId: true,
                    createdAt: true,
                },
            },
            notificationsSent: {
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                    id: true,
                    type: true,
                    template: true,
                    sentCount: true,
                    failedCount: true,
                    notes: true,
                    convoyId: true,
                    shipmentId: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!user) return notFound();

    // === Convois sur lesquels cet utilisateur a une activité ===
    const userConvoyIds = new Set<string>();
    user.shipmentsCreated.forEach((s) => s.convoyId && userConvoyIds.add(s.convoyId));
    user.paymentsCreated.forEach((p) => p.shipment?.convoyId && userConvoyIds.add(p.shipment.convoyId));
    user.expensesCreated.forEach((e) => e.convoyId && userConvoyIds.add(e.convoyId));
    user.notificationsSent.forEach((n) => n.convoyId && userConvoyIds.add(n.convoyId));

    // Pour les notifs DELIVERED rattachées à un shipmentId : retrouver le convoyId via shipment
    const orphanShipmentIds = user.notificationsSent
        .filter((n) => !n.convoyId && n.shipmentId)
        .map((n) => n.shipmentId!) as number[];
    let shipmentToConvoy: Record<number, string | null> = {};
    if (orphanShipmentIds.length > 0) {
        const orphanShipments = await prisma.shipment.findMany({
            where: { id: { in: orphanShipmentIds } },
            select: { id: true, convoyId: true },
        });
        shipmentToConvoy = Object.fromEntries(
            orphanShipments.map((s) => [s.id, s.convoyId])
        );
        orphanShipments.forEach((s) => s.convoyId && userConvoyIds.add(s.convoyId));
    }

    const convoys = userConvoyIds.size
        ? await prisma.convoy.findMany({
              where: { id: { in: Array.from(userConvoyIds) } },
              orderBy: { date: "desc" },
              select: { id: true, date: true, direction: true },
          })
        : [];
    const convoyMap = new Map(convoys.map((c) => [c.id, c]));

    // === Filtrage par convoi (côté serveur) ===
    const matchConvoy = (cid: string | null | undefined) =>
        !filterConvoyId || cid === filterConvoyId;

    const filteredShipments = user.shipmentsCreated.filter((s) =>
        matchConvoy(s.convoyId)
    );
    const filteredPayments = user.paymentsCreated.filter((p) =>
        matchConvoy(p.shipment?.convoyId ?? null)
    );
    const filteredExpenses = user.expensesCreated.filter((e) =>
        matchConvoy(e.convoyId)
    );
    const filteredNotifications = user.notificationsSent.filter((n) => {
        const cid = n.convoyId ?? (n.shipmentId ? shipmentToConvoy[n.shipmentId] : null);
        return matchConvoy(cid);
    });

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
                    ← Retour à la liste des utilisateurs
                </Link>
                <h1 className="text-2xl font-bold mt-2">👤 {user.username}</h1>
                <p className="text-sm text-gray-600">
                    {ROLE_LABEL[user.role] ?? user.role}
                    {user.email ? ` · ${user.email}` : ""}
                </p>
            </div>

            {/* === Filtre par convoi === */}
            {convoys.length > 0 && (
                <div className="mb-6 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">Filtrer par convoi :</span>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={`/admin/users/${user.id}`}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                !filterConvoyId
                                    ? "bg-slate-800 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Tous les convois
                        </Link>
                        {convoys.map((c) => {
                            const label = `${new Date(c.date).toISOString().slice(0, 10)} (${
                                c.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"
                            })`;
                            const active = filterConvoyId === c.id;
                            return (
                                <Link
                                    key={c.id}
                                    href={`/admin/users/${user.id}?convoyId=${c.id}`}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        active
                                            ? "bg-slate-800 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <Stat label="Colis créés"      value={filteredShipments.length} />
                <Stat label="Paiements"        value={filteredPayments.length} />
                <Stat label="Dépenses"         value={filteredExpenses.length} />
                <Stat label="Notifications"    value={filteredNotifications.length} />
            </div>

            {/* Colis */}
            <Section title="📦 Colis créés">
                {filteredShipments.length === 0 ? (
                    <Empty>Aucun colis créé{filterConvoyId ? " pour ce convoi" : ""}.</Empty>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-2">Tracking</th>
                                <th className="text-left p-2">Destinataire</th>
                                <th className="text-left p-2">Convoi</th>
                                <th className="text-left p-2">Statut</th>
                                <th className="text-left p-2">Créé le</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredShipments.map((s) => (
                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 font-mono text-xs">{s.trackingId}</td>
                                    <td className="p-2">{s.receiverName}</td>
                                    <td className="p-2 text-xs text-gray-600">
                                        {s.convoy
                                            ? `${new Date(s.convoy.date).toISOString().slice(0, 10)} (${
                                                  s.convoy.direction === "CA_TO_NE" ? "CA→NE" : "NE→CA"
                                              })`
                                            : "—"}
                                    </td>
                                    <td className="p-2 text-xs">{s.status}</td>
                                    <td className="p-2 text-xs text-gray-600">{fmt(s.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Section>

            {/* Paiements */}
            <Section title="💳 Paiements enregistrés">
                {filteredPayments.length === 0 ? (
                    <Empty>Aucun paiement enregistré{filterConvoyId ? " pour ce convoi" : ""}.</Empty>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-2">Colis</th>
                                <th className="text-left p-2">Client</th>
                                <th className="text-left p-2">Montant</th>
                                <th className="text-left p-2">Méthode</th>
                                <th className="text-left p-2">Créé le</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map((p) => (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 font-mono text-xs">{p.shipment?.trackingId ?? "—"}</td>
                                    <td className="p-2">{p.shipment?.receiverName ?? "—"}</td>
                                    <td className="p-2 font-mono">
                                        {p.amount.toFixed(2)} {p.currency}
                                    </td>
                                    <td className="p-2 text-xs">{p.method}</td>
                                    <td className="p-2 text-xs text-gray-600">{fmt(p.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Section>

            {/* Notifications */}
            <Section title="📧 Notifications envoyées">
                {filteredNotifications.length === 0 ? (
                    <Empty>Aucune notification envoyée{filterConvoyId ? " pour ce convoi" : ""}.</Empty>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-2">Type</th>
                                <th className="text-left p-2">Convoi</th>
                                <th className="text-left p-2">Envoyées</th>
                                <th className="text-left p-2">Échecs</th>
                                <th className="text-left p-2">Notes</th>
                                <th className="text-left p-2">Envoyé le</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredNotifications.map((n) => {
                                const resolvedConvoyId =
                                    n.convoyId ?? (n.shipmentId ? shipmentToConvoy[n.shipmentId] : null);
                                const convoy = resolvedConvoyId ? convoyMap.get(resolvedConvoyId) : null;
                                return (
                                    <tr key={n.id} className="border-b hover:bg-gray-50">
                                        <td className="p-2 text-xs font-medium">
                                            {TEMPLATE_LABEL[n.template ?? ""] ?? n.type}
                                        </td>
                                        <td className="p-2 text-xs text-gray-600">
                                            {convoy
                                                ? `${new Date(convoy.date).toISOString().slice(0, 10)} (${
                                                      convoy.direction === "CA_TO_NE" ? "CA→NE" : "NE→CA"
                                                  })`
                                                : n.shipmentId
                                                ? `Colis #${n.shipmentId}`
                                                : "—"}
                                        </td>
                                        <td className="p-2 font-mono text-green-700">{n.sentCount}</td>
                                        <td className="p-2 font-mono text-red-600">{n.failedCount}</td>
                                        <td className="p-2 text-xs text-gray-600 max-w-[200px] truncate" title={n.notes ?? ""}>
                                            {n.notes ?? "—"}
                                        </td>
                                        <td className="p-2 text-xs text-gray-600">{fmt(n.createdAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </Section>

            {/* Dépenses */}
            {filteredExpenses.length > 0 && (
                <Section title="💸 Dépenses enregistrées">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left p-2">Catégorie</th>
                                <th className="text-left p-2">Libellé</th>
                                <th className="text-left p-2">Montant</th>
                                <th className="text-left p-2">Date</th>
                                <th className="text-left p-2">Créé le</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((e) => (
                                <tr key={e.id} className="border-b hover:bg-gray-50">
                                    <td className="p-2 text-xs">{e.category}</td>
                                    <td className="p-2 text-sm">{e.subcategory ?? "—"}</td>
                                    <td className="p-2 font-mono">
                                        {e.amount.toFixed(2)} {e.currency}
                                    </td>
                                    <td className="p-2 text-xs text-gray-600">{fmt(e.date)}</td>
                                    <td className="p-2 text-xs text-gray-600">{fmt(e.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>
            )}
        </main>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="bg-white rounded-lg border shadow-sm overflow-hidden mb-6">
            <h2 className="text-lg font-semibold p-4 border-b">{title}</h2>
            {children}
        </section>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="p-6 text-center text-gray-500 text-sm">{children}</p>;
}
