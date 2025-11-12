// src/app/dashboard/shipments/page.tsx
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import type { Prisma, ShipmentStatus } from "@prisma/client";
import NotifyDeliveredButton from "./NotifyDeliveredButton";

export const runtime = "nodejs";

type SearchParams = { q?: string; page?: string };
const PAGE_SIZE = 12;

const STATUS_FR: Record<ShipmentStatus, string> = {
    RECEIVED_IN_NIGER: "Reçu (Niger)",
    RECEIVED_IN_CANADA: "Reçu (Canada)",
    IN_TRANSIT: "En route",
    IN_CUSTOMS: "À la douane",
    OUT_FOR_DELIVERY: "Prêt à être livré",
    DELIVERED: "Livré",
    CREATED: "Créé",
    ARRIVED_IN_CANADA: "Arrivé au Canada",
    ARRIVED_IN_NIGER: "Arrivé au Niger",
    PICKED_UP: "Ramassé",
};

function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
    const txt = STATUS_FR[status] ?? status;
    const tone =
        status === "DELIVERED"
            ? "bg-green-100 text-green-800"
            : ["OUT_FOR_DELIVERY", "IN_CUSTOMS", "IN_TRANSIT"].includes(status)
                ? "bg-blue-100 text-blue-800"
                : ["RECEIVED_IN_NIGER", "RECEIVED_IN_CANADA"].includes(status)
                    ? "bg-neutral-100 text-neutral-800"
                    : "bg-amber-100 text-amber-900";
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tone}`}
        >
      {txt}
    </span>
    );
}

export default async function ShipmentsPage({
                                                searchParams,
                                            }: {
    searchParams: Promise<SearchParams>; // Next 15
}) {
    // --- Auth : ADMIN, AGENT_CA, AGENT_NE peuvent accéder à la page ---
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as
        | "ADMIN"
        | "AGENT_NE"
        | "AGENT_CA"
        | undefined;

    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role ?? "")) {
        redirect("/login");
    }

    // --- Query params ---
    const sp = await searchParams;
    const q = (sp.q || "").trim();
    const page = Math.max(1, Number(sp.page || 1));

    // --- Filtres ---
    const searchFilter: Prisma.ShipmentWhereInput = q
        ? {
            OR: [
                { trackingId: { contains: q, mode: "insensitive" } },
                { receiverName: { contains: q, mode: "insensitive" } },
                { receiverEmail: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};

    // Sens unique : NE -> CA
    const directionFilter: Prisma.ShipmentWhereInput = {
        convoy: { direction: "NE_TO_CA" },
    };

    // (Option de durcissement) Restreindre aux colis créés côté Niger
    const originFilter: Prisma.ShipmentWhereInput = { originCountry: "NE" };

    const where: Prisma.ShipmentWhereInput = {
        AND: [directionFilter, originFilter, searchFilter],
    };

    // --- Requête ---
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
        <main className="w-full px-6 py-6">
            <div className="w-full rounded-2xl ring-1 ring-neutral-200 bg-white shadow p-6">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-6">
                    <h1 className="text-2xl font-bold">Liste des Colis — NE → CA</h1>

                    <div className="flex gap-2">
                        {/* Création côté Niger : réservé à AGENT_NE (et éventuellement ADMIN si tu veux) */}
                        {role === "AGENT_NE" && (
                            <Link href={`/agent/ne/`} className="btn-primary">
                                Ajouter colis (NE)
                            </Link>
                        )}
                    </div>
                </div>

                {/* Recherche */}
                <form className="flex gap-2 mb-4" action="/dashboard/shipments">
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Rechercher (tracking, nom, email)"
                        className="input w-80"
                    />
                    <button className="btn-ghost">Rechercher</button>
                </form>

                {/* Tableau */}
                <table className="w-full table-auto text-sm border border-neutral-200 rounded-lg">
                    <thead className="bg-neutral-100 text-neutral-700">
                    <tr>
                        <th className="py-3 px-4 text-left w-[11%]">Tracking</th>
                        <th className="py-3 px-4 text-left w-[14%]">Destinataire</th>
                        <th className="py-3 px-4 text-left w-[18%]">Email</th>
                        <th className="py-3 px-4 text-left w-[10%]">Tél</th>
                        <th className="py-3 px-4 text-left w-[14%]">Statut</th>
                        <th className="py-3 px-4 text-left w-[7%]">Poids</th>
                        <th className="py-3 px-4 text-left w-[17%]">Adresse</th>
                        <th className="py-3 px-4 text-left w-[17%]">Ville</th>
                        <th className="py-3 px-4 text-left w-[7%]">Créé le</th>
                        <th className="py-3 px-4 text-right w-[9%]">Actions</th>
                    </tr>
                    </thead>

                    <tbody>
                    {items.map((s) => (
                        <tr
                            key={s.id}
                            className="border-t border-neutral-200 hover:bg-neutral-50"
                        >
                            <td className="py-2 px-4 font-mono">{s.trackingId}</td>
                            <td className="py-2 px-4">{s.receiverName}</td>
                            <td className="py-2 px-4">{s.receiverEmail}</td>
                            <td className="py-2 px-4">{s.receiverPhone || "—"}</td>
                            <td className="py-2 px-4">
                                <StatusBadge status={s.status} />
                            </td>
                            <td className="py-2 px-4">{s.weightKg ?? "—"}</td>
                            <td className="py-2 px-4 whitespace-pre-wrap break-words">
                                {s.receiverAddress ?? "—"}
                            </td>
                            <td className="py-2 px-4 whitespace-pre-wrap break-words">
                                {s.receiverCity ?? "—"}
                            </td>
                            <td className="py-2 px-4">{fmtDate(s.createdAt)}</td>
                            <td className="py-2 px-4">
                                <div className="flex justify-end gap-2">
                                    {/* Modifier : réservé à AGENT_NE */}
                                    {role === "AGENT_NE" && (
                                        <Link
                                            href={`/dashboard/shipments/${s.id}/edit`}
                                            className="px-2 py-1 text-sm rounded bg-neutral-900 text-white hover:bg-neutral-800"
                                        >
                                            Modifier
                                        </Link>
                                    )}

                                    {/* Remercier : visible pour ADMIN et AGENT_CA */}
                                    {["ADMIN", "AGENT_CA"].includes(role!) && (
                                        <NotifyDeliveredButton
                                            shipmentId={s.id}
                                            receiverName={s.receiverName}
                                            receiverEmail={s.receiverEmail}
                                            trackingId={s.trackingId}
                                        />
                                    )}
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

                {pages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-neutral-600">
              Page {page} / {pages} — {total} colis
            </span>
                        <div className="flex gap-2">
                            {page > 1 && (
                                <Link
                                    className="btn-ghost"
                                    href={`/dashboard/shipments?page=${
                                        page - 1
                                    }&q=${encodeURIComponent(q)}`}
                                >
                                    ← Précédent
                                </Link>
                            )}
                            {page < pages && (
                                <Link
                                    className="btn-ghost"
                                    href={`/dashboard/shipments?page=${
                                        page + 1
                                    }&q=${encodeURIComponent(q)}`}
                                >
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
