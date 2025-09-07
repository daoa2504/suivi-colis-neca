// src/app/dashboard/shipments/page.tsx
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import DeleteShipmentButton from "./DeleteShipmentButton";

export const runtime = "nodejs";

type SearchParams = { q?: string; page?: string };
const PAGE_SIZE = 12;

export default async function ShipmentsPage(
    // ✅ Next 15: searchParams est une Promise
    { searchParams }: { searchParams: Promise<SearchParams> }
) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_GN"].includes(role || "")) {
        redirect("/login");
    }

    // ✅ on attend la Promise
    const sp = await searchParams;
    const q = (sp.q || "").trim();
    const page = Math.max(1, Number(sp.page || 1));

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
                receiverCity: true,
                receiverAddress: true,
                receiverPoBox: true,
                createdAt: true,
            },
        }),
        prisma.shipment.count({ where }),
    ]);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));


    return (
        // CHANGED: conteneur pleine largeur
        <main className="w-full px-6 py-6">
            {/* CHANGED: carte pleine largeur qui englobe recherche + table */}
            <div className="w-full rounded-2xl ring-1 ring-neutral-200 bg-white shadow p-6">

                <div className="flex items-center justify-between gap-3 mb-6">
                    <h1 className="text-2xl font-bold">Liste des Colis</h1>

                    <form className="flex gap-2">
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Rechercher (tracking, nom, email)"
                            className="input w-80"
                        />
                        <button className="btn-ghost">Rechercher</button>
                    </form>
                </div>

                {/* CHANGED: plus d'overflow externe; la table prend toute la largeur */}
                <table className="w-full table-auto text-sm border border-neutral-200 rounded-lg">
                    <thead className="bg-neutral-100 text-neutral-700">
                    <tr>
                        <th className="py-3 px-4 text-left w-[11%]">Tracking</th>
                        <th className="py-3 px-4 text-left w-[14%]">Destinataire</th>
                        <th className="py-3 px-4 text-left w-[18%]">Email</th>
                        <th className="py-3 px-4 text-left w-[10%]">Tél</th>
                        <th className="py-3 px-4 text-left w-[12%]">Statut</th>
                        <th className="py-3 px-4 text-left w-[7%]">Poids</th>
                        <th className="py-3 px-4 text-left w-[18%]">Adresse</th>
                        <th className="py-3 px-4 text-left w-[7%]">Créé le</th>
                        <th className="py-3 px-4 text-right w-[9%]">Actions</th>
                    </tr>
                    </thead>

                    <tbody>
                    {items.map((s) => (
                        <tr key={s.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                            <td className="py-2 px-4 font-mono">{s.trackingId}</td>
                            <td className="py-2 px-4">{s.receiverName}</td>
                            <td className="py-2 px-4">{s.receiverEmail}</td>
                            <td className="py-2 px-4">{s.receiverPhone || "—"}</td>
                            <td className="py-2 px-4">{s.status}</td>
                            <td className="py-2 px-4">{s.weightKg ?? "—"}</td>

                            {/* wrap propre des adresses longues */}
                            <td className="py-2 px-4 whitespace-pre-wrap break-words">
                                {s.receiverAddress ?? "—"}
                            </td>

                            <td className="py-2 px-4">
                                {new Date(s.createdAt).toLocaleDateString("fr-CA")}
                            </td>
                            <td className="py-2 px-4">
                                <div className="flex justify-end gap-2">
                                    <Link
                                        href={`/dashboard/shipments/${s.id}/edit`}
                                        className="px-2 py-1 text-sm rounded bg-neutral-200 hover:bg-neutral-300"
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