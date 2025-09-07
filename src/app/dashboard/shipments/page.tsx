import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import DeleteShipmentButton from "./DeleteShipmentButton";

export const runtime = "nodejs";

type SearchParams = { q?: string; page?: string };

const PAGE_SIZE = 12;

export default async function ShipmentsPage({
                                                searchParams,
                                            }: { searchParams: SearchParams }) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_GN"].includes(role || "")) {
        redirect("/login");
    }

    const q = (searchParams.q || "").trim();
    const page = Math.max(1, Number(searchParams.page || 1));

    const where = q
        ? {
            OR: [
                { trackingId: { contains: q, mode: "insensitive" } },
                { receiverName: { contains: q, mode: "insensitive" } },
                { receiverEmail: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};

    const [items, total] = await Promise.all([
        prisma.shipment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                receiverEmail: true,
                receiverPhone: true,
                status: true,
                weightKg: true,
                price: true,
                createdAt: true,
            },
        }),
        prisma.shipment.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <main className="container-page">
            <div className="card">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="title">Colis</h1>
                    <form className="flex gap-2">
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Rechercher (tracking, nom, email)"
                            className="input w-72"
                        />
                        <button className="btn-ghost">Rechercher</button>
                    </form>
                </div>

                <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left text-neutral-600">
                            <th className="py-2 pr-4">Tracking</th>
                            <th className="py-2 pr-4">Destinataire</th>
                            <th className="py-2 pr-4">Email</th>
                            <th className="py-2 pr-4">Tél</th>
                            <th className="py-2 pr-4">Statut</th>
                            <th className="py-2 pr-4">Poids</th>
                            <th className="py-2 pr-4">Prix</th>
                            <th className="py-2 pr-4">Créé le</th>
                            <th className="py-2 pr-0 text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((s) => (
                            <tr key={s.id} className="border-t border-neutral-200">
                                <td className="py-2 pr-4 font-mono">{s.trackingId}</td>
                                <td className="py-2 pr-4">{s.receiverName}</td>
                                <td className="py-2 pr-4">{s.receiverEmail}</td>
                                <td className="py-2 pr-4">{s.receiverPhone || "—"}</td>
                                <td className="py-2 pr-4">{s.status}</td>
                                <td className="py-2 pr-4">{s.weightKg ?? "—"}</td>
                                <td className="py-2 pr-4">{s.price ?? "—"}</td>
                                <td className="py-2 pr-4">
                                    {new Date(s.createdAt).toLocaleDateString("fr-CA")}
                                </td>
                                <td className="py-2 pr-0">
                                    <div className="flex justify-end gap-2">
                                        <Link
                                            href={`/dashboard/shipments/${s.id}/edit`}
                                            className="btn-ghost"
                                        >
                                            Modifier
                                        </Link>
                                        <DeleteShipmentButton id={s.id} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={9} className="py-8 text-center text-neutral-500">
                                    Aucun colis trouvé.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-neutral-600">
              Page {page} / {pages} — {total} colis
            </span>
                        <div className="flex gap-2">
                            {page > 1 && (
                                <Link className="btn-ghost" href={`/dashboard/shipments?page=${page - 1}&q=${q}`}>
                                    ← Précédent
                                </Link>
                            )}
                            {page < pages && (
                                <Link className="btn-ghost" href={`/dashboard/shipments?page=${page + 1}&q=${q}`}>
                                    Suivant →
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}