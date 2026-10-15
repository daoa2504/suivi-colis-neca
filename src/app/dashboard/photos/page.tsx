// src/app/dashboard/photos/page.tsx
//
// Mur de photos : toutes les preuves d'un convoi, d'une ville ou d'un client
// côte à côte.
//
// La liste des colis répond à « que sais-je de ce colis ? », une ligne à la
// fois. Elle ne répond pas à « lequel de ces cartons est celui de madame
// X ? », qui demande de comparer des images entre elles. D'où cette page :
// même jeu de filtres que la liste, mais regroupé et montré en grand.

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import GalleryFilters from "./GalleryFilters";
import PhotoWall, { type PhotoEntry } from "./PhotoWall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Colis par page. Chaque colis porte jusqu'à 12 photos : au-delà, la page
 *  devient lourde même avec le chargement différé des vignettes. */
const PAGE_SIZE = 24;

type Grouping = "client" | "city" | "convoy";

function fmtDate(d: Date | null | undefined) {
    if (!d) return null;
    const date = new Date(d);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export default async function PhotosGalleryPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_NE", "AGENT_CA"].includes(role ?? "")) {
        redirect("/login");
    }

    const sp = await searchParams;
    const one = (k: string) => {
        const v = sp[k];
        return (Array.isArray(v) ? v[0] : v)?.trim() || "";
    };

    const direction = one("direction");
    const convoyId = one("convoyId");
    const city = one("city");
    const q = one("q");
    const grouping = (["client", "city", "convoy"].includes(one("group"))
        ? one("group")
        : "client") as Grouping;
    const page = Math.max(1, Number(one("page")) || 1);

    // Seuls les colis qui ont au moins une photo : une galerie ne gagne rien
    // à afficher des cadres vides.
    const filters: Prisma.ShipmentWhereInput[] = [{ photos: { some: {} } }];

    if (direction === "NE_TO_CA" || direction === "CA_TO_NE") {
        filters.push({ convoy: { direction } });
    }
    if (convoyId) filters.push({ convoyId });
    if (city) filters.push({ receiverCity: { equals: city, mode: "insensitive" } });
    if (q) {
        filters.push({
            OR: [
                { receiverName: { contains: q, mode: "insensitive" } },
                { trackingId: { contains: q, mode: "insensitive" } },
                { receiverPhone: { contains: q } },
                { receiverCity: { contains: q, mode: "insensitive" } },
                { photos: { some: { caption: { contains: q, mode: "insensitive" } } } },
            ],
        });
    }

    const where: Prisma.ShipmentWhereInput = { AND: filters };

    const [shipments, totalShipments, photoTotal] = await Promise.all([
        prisma.shipment.findMany({
            where,
            orderBy: [{ createdAt: "desc" }],
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                receiverCity: true,
                receiverPhone: true,
                convoy: { select: { date: true, direction: true } },
                photos: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        caption: true,
                        thumbKey: true,
                        createdAt: true,
                    },
                },
            },
        }),
        prisma.shipment.count({ where }),
        prisma.shipmentPhoto.count({ where: { shipment: where } }),
    ]);

    // Listes des filtres, restreintes à ce qui a effectivement des photos :
    // proposer une ville sans aucune preuve n'aide personne.
    const [citiesRaw, convoysRaw] = await Promise.all([
        prisma.shipment.findMany({
            where: { photos: { some: {} }, receiverCity: { not: null } },
            select: { receiverCity: true },
            distinct: ["receiverCity"],
        }),
        prisma.convoy.findMany({
            where: { shipments: { some: { photos: { some: {} } } } },
            orderBy: { date: "desc" },
            select: { id: true, date: true, direction: true },
        }),
    ]);

    const cities = citiesRaw
        .map((c) => c.receiverCity!)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr"));

    // Mise à plat : le visualiseur navigue d'une photo à l'autre à travers
    // tout le résultat filtré, sans se soucier des regroupements.
    const entries: PhotoEntry[] = shipments.flatMap((s) =>
        s.photos.map((p) => ({
            photoId: p.id,
            shipmentId: s.id,
            trackingId: s.trackingId,
            client: s.receiverName,
            city: s.receiverCity,
            phone: s.receiverPhone,
            convoyDate: fmtDate(s.convoy?.date),
            direction: s.convoy?.direction ?? null,
            caption: p.caption,
            hasThumb: Boolean(p.thumbKey),
            createdAt: p.createdAt.toISOString(),
        }))
    );

    // Regroupement. La clé sert d'identité, le libellé d'en-tête.
    const groupOf = (e: PhotoEntry): { key: string; label: string; sublabel: string } => {
        if (grouping === "city") {
            const label = e.city?.trim() || "Ville non renseignée";
            return { key: label.toLowerCase(), label, sublabel: "" };
        }
        if (grouping === "convoy") {
            const label = e.convoyDate ? `Convoi du ${e.convoyDate}` : "Sans convoi";
            return { key: label, label, sublabel: e.direction === "CA_TO_NE" ? "Canada → Niger" : e.direction === "NE_TO_CA" ? "Niger → Canada" : "" };
        }
        // Par client : un même client peut avoir plusieurs colis, donc le
        // numéro de suivi fait partie de l'identité du groupe.
        return {
            key: `${e.shipmentId}`,
            label: e.client,
            sublabel: [e.trackingId, e.city].filter(Boolean).join(" · "),
        };
    };

    const grouped = new Map<string, { label: string; sublabel: string; items: PhotoEntry[] }>();
    for (const e of entries) {
        const g = groupOf(e);
        const bucket = grouped.get(g.key);
        if (bucket) bucket.items.push(e);
        else grouped.set(g.key, { label: g.label, sublabel: g.sublabel, items: [e] });
    }
    const groups = Array.from(grouped.values());

    const totalPages = Math.max(1, Math.ceil(totalShipments / PAGE_SIZE));
    const pageHref = (n: number) => {
        const params = new URLSearchParams();
        if (direction) params.set("direction", direction);
        if (convoyId) params.set("convoyId", convoyId);
        if (city) params.set("city", city);
        if (q) params.set("q", q);
        params.set("group", grouping);
        if (n > 1) params.set("page", String(n));
        return `/dashboard/photos?${params.toString()}`;
    };

    const hasFilter = Boolean(direction || convoyId || city || q);

    return (
        <main className="container-page space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <h1 className="title">📷 Photos des colis</h1>
                    <p className="text-sm text-neutral-600 mt-1">
                        {photoTotal} photo{photoTotal > 1 ? "s" : ""} sur{" "}
                        {totalShipments} colis
                        {hasFilter ? " (filtré)" : ""}. Cliquez une vignette pour
                        l&apos;agrandir, puis ← et → pour parcourir.
                    </p>
                </div>
                <Link
                    href="/dashboard/shipments"
                    className="text-sm text-neutral-600 hover:text-black underline"
                >
                    ← Revenir à la liste
                </Link>
            </div>

            <GalleryFilters
                cities={cities}
                convoys={convoysRaw.map((c) => ({
                    id: c.id,
                    label: `${fmtDate(c.date)} — ${c.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"}`,
                }))}
                current={{ direction, convoyId, city, q, group: grouping }}
            />

            {entries.length === 0 ? (
                <p className="text-sm text-neutral-500 italic border rounded-lg p-6 bg-white">
                    {hasFilter
                        ? "Aucune photo ne correspond à ces filtres."
                        : "Aucune photo enregistrée pour l'instant. Elles s'ajoutent à la saisie d'un colis, ou depuis sa fiche."}
                </p>
            ) : (
                <PhotoWall groups={groups} groupedBy={grouping} />
            )}

            {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-3 text-sm">
                    {page > 1 ? (
                        <Link href={pageHref(page - 1)} className="px-3 py-1.5 border rounded hover:bg-neutral-100">
                            ← Précédent
                        </Link>
                    ) : (
                        <span className="px-3 py-1.5 border rounded text-neutral-400">← Précédent</span>
                    )}
                    <span className="text-neutral-600">
                        Page {page} sur {totalPages}
                    </span>
                    {page < totalPages ? (
                        <Link href={pageHref(page + 1)} className="px-3 py-1.5 border rounded hover:bg-neutral-100">
                            Suivant →
                        </Link>
                    ) : (
                        <span className="px-3 py-1.5 border rounded text-neutral-400">Suivant →</span>
                    )}
                </nav>
            )}
        </main>
    );
}
