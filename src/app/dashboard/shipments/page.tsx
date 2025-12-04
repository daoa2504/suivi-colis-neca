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
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
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
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
        >
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
        select: {
            id: true,
            date: true,
        },
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
    const convoyFilter: Prisma.ShipmentWhereInput = convoyId
        ? { convoyId }
        : {};

    // --- Permissions basées sur le rôle ---
    let permissionFilter: Prisma.ShipmentWhereInput = {};

    if (role === "AGENT_NE") {
        // Agent NE peut voir :
        // - Ses propres colis NE→CA (origine Niger)
        // - Tous les colis CA→NE (pour envoyer remerciements)
        if (direction === "NE_TO_CA") {
            permissionFilter = { originCountry: "NE" };
        }
        // Pour CA→NE, pas de filtre supplémentaire (peut tout voir)
    } else if (role === "AGENT_CA") {
        // Agent CA peut voir :
        // - Tous les colis NE→CA (pour envoyer remerciements)
        // - Ses propres colis CA→NE (origine Canada)
        if (direction === "CA_TO_NE") {
            permissionFilter = { originCountry: "CA" };
        }
        // Pour NE→CA, pas de filtre supplémentaire (peut tout voir)
    }
    // ADMIN peut tout voir, pas de filtre

    const where: Prisma.ShipmentWhereInput = {
        AND: [directionFilter, convoyFilter, searchFilter, permissionFilter],
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

    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // --- Déterminer qui peut modifier et qui peut remercier ---
    const canEdit = (shipment: (typeof items)[0]) => {
        if (role === "ADMIN") return true;
        // Agent NE peut modifier les colis d'origine NE (direction NE→CA)
        if (role === "AGENT_NE" && direction === "NE_TO_CA") {
            return shipment.originCountry === "NE";
        }
        // Agent CA peut modifier les colis d'origine CA (direction CA→NE)
        if (role === "AGENT_CA" && direction === "CA_TO_NE") {
            return shipment.originCountry === "CA";
        }
        return false;
    };

    const canNotify = (shipment: (typeof items)[0]) => {
        // Agent CA peut remercier pour les colis NE→CA
        if (role === "AGENT_CA" && direction === "NE_TO_CA") return true;
        // Agent NE peut remercier pour les colis CA→NE
        if (role === "AGENT_NE" && direction === "CA_TO_NE") return true;
        // ADMIN peut toujours
        if (role === "ADMIN") return true;
        return false;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">
                    Liste des Colis —{" "}
                    {direction === "NE_TO_CA" ? "NE → CA" : "CA → NE"}
                </h1>

                {/* Bouton d'ajout selon le rôle et la direction */}
                {role === "AGENT_NE" && direction === "NE_TO_CA" && (
                    <Link
                        href="/dashboard/shipments/new"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Ajouter colis (NE)
                    </Link>
                )}
                {role === "AGENT_CA" && direction === "CA_TO_NE" && (
                    <Link
                        href="/dashboard/shipments/new"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Ajouter colis (CA)
                    </Link>
                )}
            </div>

            {/* Filtres */}
            <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
                {/* Onglets de direction */}
                <div className="flex gap-2 border-b pb-2">
                    <Link
                        href={`/dashboard/shipments?direction=NE_TO_CA`}
                        className={`px-4 py-2 rounded-t-lg font-medium ${
                            direction === "NE_TO_CA"
                                ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-700"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        Niger → Canada
                    </Link>
                    <Link
                        href={`/dashboard/shipments?direction=CA_TO_NE`}
                        className={`px-4 py-2 rounded-t-lg font-medium ${
                            direction === "CA_TO_NE"
                                ? "bg-indigo-100 text-indigo-700 border-b-2 border-indigo-700"
                                : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        Canada → Niger
                    </Link>
                </div>

                {/* Recherche et filtre par convoi */}
                <div className="flex gap-4">
                    <form className="flex-1 flex gap-2">
                        <input type="hidden" name="direction" value={direction} />
                        {convoyId && <input type="hidden" name="convoyId" value={convoyId} />}
                        <input
                            type="text"
                            name="q"
                            defaultValue={q}
                            placeholder="Rechercher (tracking, nom, email)..."
                            className="flex-1 rounded-md border px-3 py-2 text-sm"
                        />
                        <button
                            type="submit"
                            className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        >
                            Rechercher
                        </button>
                    </form>

                    {/* Filtre par convoi */}
                    <ConvoyFilter
                        convoys={convoys}
                        currentConvoyId={convoyId}
                        direction={direction}
                        searchQuery={q}
                    />
                </div>
            </div>

            {/* Tableau */}
            <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Tracking
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Convoi
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Destinataire
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Tél
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Statut
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Poids
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Ville
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Créé le
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Actions
                        </th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                    {items.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                {s.trackingId}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {s.convoy ? fmtDate(s.convoy.date) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                {s.receiverName}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {s.receiverEmail}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {s.receiverPhone || "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                                <StatusBadge status={s.status} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {s.weightKg ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {s.receiverCity ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                                {fmtDate(s.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm space-x-2">
                                {canEdit(s) && (
                                    <Link
                                        href={`/dashboard/shipments/${s.id}/edit`}
                                        className="text-indigo-600 hover:text-indigo-900"
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
                            <td
                                colSpan={10}
                                className="px-4 py-8 text-center text-sm text-gray-500"
                            >
                                Aucun colis trouvé.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-sm text-gray-700">
                        Page {page} / {pages} — {total} colis
                    </p>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link
                                href={`?q=${q}&page=${page - 1}&direction=${direction}${convoyId ? `&convoyId=${convoyId}` : ""}`}
                                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                            >
                                ← Précédent
                            </Link>
                        )}
                        {page < pages && (
                            <Link
                                href={`?q=${q}&page=${page + 1}&direction=${direction}${convoyId ? `&convoyId=${convoyId}` : ""}`}
                                className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
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