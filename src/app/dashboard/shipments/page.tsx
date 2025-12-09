// src/app/dashboard/shipments/page.tsx
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import type { Prisma, ShipmentStatus } from "@prisma/client";
import NotifyDeliveredButton from "./NotifyDeliveredButton";
import ConvoyFilter from "./ConvoyFilter";

export const runtime = "nodejs";

type SearchParams = {
    q?: string;
    page?: string;
    direction?: string;
    convoyId?: string;
};

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
    const date = new Date(d);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        <span className={`inline-block px-2 py-1 rounded text-xs ${tone}`}>
            {txt}
        </span>
    );
}

export default async function ShipmentsPage({
                                                searchParams,
                                            }: {
    searchParams: Promise<SearchParams>;
}) {
    // --- Auth ---
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as
        | "ADMIN"
        | "AGENT_NE"
        | "AGENT_CA"
        | undefined;

    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role ?? "")) {
        redirect("/login");
    }

    const userId = session.user?.id;

    // --- Query params ---
    const sp = await searchParams;
    const q = (sp.q || "").trim();
    const page = Math.max(1, Number(sp.page || 1));
    const direction = sp.direction || "NE_TO_CA";
    const convoyId = sp.convoyId || "";

    // --- Récupérer les convois disponibles pour le filtre ---
    const convoys = await prisma.convoy.findMany({
        where: { direction: direction as "NE_TO_CA" | "CA_TO_NE" },
        orderBy: { date: "desc" },
        select: { id: true, date: true },
        take: 50,
    });

    // --- Filtres de recherche ---
    const searchFilter: Prisma.ShipmentWhereInput = q
        ? {
            OR: [
                { trackingId: { contains: q, mode: "insensitive" } },
                { receiverName: { contains: q, mode: "insensitive" } },
                { receiverEmail: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};

    // --- Filtre de direction ---
    const directionFilter: Prisma.ShipmentWhereInput = {
        convoy: { direction: direction as "NE_TO_CA" | "CA_TO_NE" },
    };

    // --- Filtre de convoi ---
    const convoyFilter: Prisma.ShipmentWhereInput = convoyId ? { convoyId } : {};

    // --- Permissions basées sur le rôle (SANS createdBy) ---
    let permissionFilter: Prisma.ShipmentWhereInput = {};

    if (role === "AGENT_NE") {
        // Agent NE voit :
        // - Colis NE→CA avec originCountry="NE"
        // - TOUS les colis CA→NE
        if (direction === "NE_TO_CA") {
            permissionFilter = { originCountry: "NE" };
        }
        // Pour CA→NE, pas de filtre (voit tout)
    } else if (role === "AGENT_CA") {
        // Agent CA voit :
        // - TOUS les colis NE→CA
        // - Colis CA→NE avec originCountry="CA"
        if (direction === "CA_TO_NE") {
            permissionFilter = { originCountry: "CA" };
        }
        // Pour NE→CA, pas de filtre (voit tout)
    }
    // ADMIN voit tout, pas de filtre

    const where: Prisma.ShipmentWhereInput = {
        AND: [directionFilter, convoyFilter, searchFilter, permissionFilter],
    };

    console.log("🔍 Direction:", direction);
    console.log("🔍 Role:", role);
    console.log("🔍 Permission filter:", JSON.stringify(permissionFilter, null, 2));

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
                originCountry: true,
                thankYouEmailSent: true,
                convoy: {
                    select: {
                        date: true,
                    },
                },
            },
        }),
        prisma.shipment.count({ where }),
    ]);

    console.log("🔍 Total avec filtre permission:", total);

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // --- Déterminer qui peut modifier et qui peut remercier ---
    const canEdit = (shipment: (typeof items)[0]) => {
        if (role === "ADMIN") return true;

        // Agent CA peut modifier SEULEMENT les colis CA→NE (qu'il a créés)
        if (role === "AGENT_CA" && direction === "CA_TO_NE") {
            return shipment.originCountry === "CA";
        }

        // Agent NE peut modifier SEULEMENT les colis NE→CA (qu'il a créés)
        if (role === "AGENT_NE" && direction === "NE_TO_CA") {
            return shipment.originCountry === "NE";
        }

        return false;
    };

    const canNotify = (shipment: (typeof items)[0]) => {
        // ADMIN peut toujours notifier
        if (role === "ADMIN") return true;

        // Agent CA peut notifier SEULEMENT les colis NE→CA (pour remercier)
        if (role === "AGENT_CA" && direction === "NE_TO_CA") return true;

        // Agent NE peut notifier SEULEMENT les colis CA→NE (pour remercier)
        if (role === "AGENT_NE" && direction === "CA_TO_NE") return true;

        return false;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">
                    Liste des Colis —{" "}
                    <span className="text-blue-600">
                        {direction === "NE_TO_CA" ? "NE → CA" : "CA → NE"}
                    </span>
                </h1>
                {/* Bouton d'ajout selon le rôle et la direction */}
                {role === "AGENT_NE" && direction === "NE_TO_CA" && (
                    <Link
                        href="/dashboard/shipments/new?direction=NE_TO_CA"
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Ajouter colis (NE)
                    </Link>
                )}
                {role === "AGENT_CA" && direction === "CA_TO_NE" && (
                    <Link
                        href="/dashboard/shipments/new?direction=CA_TO_NE"
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Ajouter colis (CA)
                    </Link>
                )}
            </div>

            {/* Filtres */}
            <div className="mb-6 space-y-4">
                {/* Onglets de direction avec drapeaux locaux */}
                <div className="flex gap-2 bg-gray-100 p-1.5 rounded-lg">
                    <Link
                        href="/dashboard/shipments?direction=NE_TO_CA"
                        className={`
            flex-1 px-4 py-3 rounded-md font-medium transition-all duration-200
            flex items-center justify-center gap-3
            ${direction === "NE_TO_CA"
                            ? "bg-white text-blue-600 shadow-sm ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-100"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }
        `}
                    >
                        <img
                            src="/flags/ne.svg"
                            alt="NE"
                            className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                        />
                        <span>Niger → Canada</span>
                        <img
                            src="/flags/ca.svg"
                            alt="CA"
                            className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                        />
                    </Link>
                    <Link
                        href="/dashboard/shipments?direction=CA_TO_NE"
                        className={`
            flex-1 px-4 py-3 rounded-md font-medium transition-all duration-200
            flex items-center justify-center gap-3
            ${direction === "CA_TO_NE"
                            ? "bg-white text-blue-600 shadow-sm ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-100"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }
        `}
                    >
                        <img
                            src="/flags/ca.svg"
                            alt="CA"
                            className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                        />
                        <span>Canada → Niger</span>
                        <img
                            src="/flags/ne.svg"
                            alt="NE"
                            className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                        />
                    </Link>
                </div>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="text-left p-3">Tracking</th>
                        <th className="text-left p-3">Convoi</th>
                        <th className="text-left p-3">Destinataire</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Tél</th>
                        <th className="text-left p-3">Statut</th>
                        <th className="text-left p-3">Poids</th>
                        <th className="text-left p-3">Ville</th>
                        <th className="text-left p-3">Créé le</th>
                        <th className="text-left p-3">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {items.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-mono text-xs">{s.trackingId}</td>
                            <td className="p-3 text-xs">
                                {s.convoy ? fmtDate(s.convoy.date) : "—"}
                            </td>
                            <td className="p-3">{s.receiverName}</td>
                            <td className="p-3 text-xs">{s.receiverEmail}</td>
                            <td className="p-3 text-xs">{s.receiverPhone || "—"}</td>
                            <td className="p-3">
                                <StatusBadge status={s.status} />
                            </td>
                            <td className="p-3">{s.weightKg ?? "—"}</td>
                            <td className="p-3">{s.receiverCity ?? "—"}</td>
                            <td className="p-3 text-xs">{fmtDate(s.createdAt)}</td>
                            <td className="p-3 space-x-2">
                                {canEdit(s) && (
                                    <Link
                                        href={`/dashboard/shipments/${s.id}/edit`}
                                        className="text-blue-600 hover:underline text-xs"
                                    >
                                        Modifier
                                    </Link>
                                )}
                                {canNotify(s) && (
                                    <NotifyDeliveredButton
                                        shipmentId={s.id}
                                        receiverName={s.receiverName}
                                        receiverEmail={s.receiverEmail}
                                        trackingId={s.trackingId}
                                        thankYouEmailSent={s.thankYouEmailSent}
                                    />
                                )}
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={10} className="p-6 text-center text-gray-500">
                                Aucun colis trouvé.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Page {page} / {pages} — {total} colis
                    </p>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link
                                href={`/dashboard/shipments?direction=${direction}&page=${page - 1}${q ? `&q=${q}` : ""}${convoyId ? `&convoyId=${convoyId}` : ""}`}
                                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                            >
                                ← Précédent
                            </Link>
                        )}
                        {page < pages && (
                            <Link
                                href={`/dashboard/shipments?direction=${direction}&page=${page + 1}${q ? `&q=${q}` : ""}${convoyId ? `&convoyId=${convoyId}` : ""}`}
                                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                            >
                                Suivant →
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}