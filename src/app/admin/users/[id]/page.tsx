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
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            shipmentsCreated: {
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                    id: true,
                    trackingId: true,
                    receiverName: true,
                    status: true,
                    createdAt: true,
                    convoy: { select: { date: true, direction: true } },
                },
            },
            paymentsCreated: {
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    method: true,
                    createdAt: true,
                    shipment: { select: { trackingId: true, receiverName: true } },
                },
            },
            expensesCreated: {
                orderBy: { createdAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    category: true,
                    subcategory: true,
                    amount: true,
                    currency: true,
                    date: true,
                    createdAt: true,
                },
            },
            notificationsSent: {
                orderBy: { createdAt: "desc" },
                take: 100,
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

    // Récupérer les dates des convois liés aux notifs
    const convoyIds = Array.from(
        new Set(user.notificationsSent.map((n) => n.convoyId).filter(Boolean) as string[])
    );
    const convoys = convoyIds.length
        ? await prisma.convoy.findMany({
              where: { id: { in: convoyIds } },
              select: { id: true, date: true, direction: true },
          })
        : [];
    const convoyMap = new Map(convoys.map((c) => [c.id, c]));

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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <Stat label="Colis créés"      value={user.shipmentsCreated.length} />
                <Stat label="Paiements"        value={user.paymentsCreated.length} />
                <Stat label="Dépenses"         value={user.expensesCreated.length} />
                <Stat label="Notifications"    value={user.notificationsSent.length} />
            </div>

            {/* Colis */}
            <Section title="📦 Colis créés">
                {user.shipmentsCreated.length === 0 ? (
                    <Empty>Aucun colis créé.</Empty>
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
                            {user.shipmentsCreated.map((s) => (
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
                {user.paymentsCreated.length === 0 ? (
                    <Empty>Aucun paiement enregistré.</Empty>
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
                            {user.paymentsCreated.map((p) => (
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
                {user.notificationsSent.length === 0 ? (
                    <Empty>Aucune notification envoyée.</Empty>
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
                            {user.notificationsSent.map((n) => {
                                const convoy = n.convoyId ? convoyMap.get(n.convoyId) : null;
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
            {user.expensesCreated.length > 0 && (
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
                            {user.expensesCreated.map((e) => (
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
