"use client";

// src/app/dashboard/photos/PhotoWall.tsx
//
// Les vignettes, regroupées, et le visualiseur plein écran.
//
// Le visualiseur parcourt tout le résultat filtré, pas seulement le groupe
// d'où l'on est parti : quand on cherche de quel client est un carton, on
// veut enchaîner les photos jusqu'à reconnaître le bon, sans refermer et
// rouvrir à chaque fois.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type PhotoEntry = {
    photoId: string;
    shipmentId: number;
    trackingId: string;
    client: string;
    city: string | null;
    phone: string | null;
    convoyDate: string | null;
    direction: string | null;
    caption: string | null;
    hasThumb: boolean;
    createdAt: string;
};

type Group = {
    label: string;
    sublabel: string;
    items: PhotoEntry[];
};

function photoUrl(e: PhotoEntry, thumb: boolean) {
    return `/api/shipments/${e.shipmentId}/photos/${e.photoId}${thumb ? "?size=thumb" : ""}`;
}

export default function PhotoWall({
    groups,
    groupedBy,
}: {
    groups: Group[];
    groupedBy: "client" | "city" | "convoy";
}) {
    // L'ordre d'affichage est aussi l'ordre de navigation : ce que l'œil
    // suit à l'écran, les flèches le suivent aussi.
    const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
    const [openAt, setOpenAt] = useState<number | null>(null);

    const indexOf = useCallback(
        (photoId: string) => flat.findIndex((e) => e.photoId === photoId),
        [flat]
    );

    const step = useCallback(
        (delta: number) => {
            setOpenAt((at) => {
                if (at === null) return at;
                const next = at + delta;
                // On s'arrête aux extrémités plutôt que de boucler : revenir
                // à la première photo après la dernière désoriente.
                if (next < 0 || next >= flat.length) return at;
                return next;
            });
        },
        [flat.length]
    );

    useEffect(() => {
        if (openAt === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenAt(null);
            else if (e.key === "ArrowRight") step(1);
            else if (e.key === "ArrowLeft") step(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openAt, step]);

    const current = openAt === null ? null : flat[openAt] ?? null;

    return (
        <>
            <div className="space-y-6">
                {groups.map((g, gi) => (
                    <section key={`${g.label}-${gi}`} className="border rounded-lg bg-white p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                            <div>
                                <h2 className="font-semibold text-neutral-800">{g.label}</h2>
                                {g.sublabel && (
                                    <p className="text-xs text-neutral-500 font-mono mt-0.5">
                                        {g.sublabel}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-neutral-500">
                                    {g.items.length} photo{g.items.length > 1 ? "s" : ""}
                                </span>
                                {/* Depuis un groupe « client », un seul colis est
                                    concerné : le lien vers sa fiche a un sens. */}
                                {groupedBy === "client" && g.items[0] && (
                                    <Link
                                        href={`/dashboard/shipments/${g.items[0].shipmentId}/edit#photos`}
                                        className="text-xs text-neutral-600 hover:text-black underline"
                                    >
                                        Fiche du colis
                                    </Link>
                                )}
                            </div>
                        </div>

                        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 list-none p-0 m-0">
                            {g.items.map((e) => (
                                <li key={e.photoId}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenAt(indexOf(e.photoId))}
                                        className="block w-full aspect-square bg-neutral-200 rounded overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-black/40 transition-shadow"
                                        title={
                                            [e.caption, e.client, e.trackingId]
                                                .filter(Boolean)
                                                .join(" — ")
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={photoUrl(e, e.hasThumb)}
                                            alt={e.caption || `Colis ${e.trackingId} — ${e.client}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </button>
                                    {/* Hors regroupement par client, la vignette
                                        seule ne dit pas à qui elle appartient. */}
                                    {groupedBy !== "client" && (
                                        <p className="mt-1 text-[11px] leading-tight text-neutral-600 truncate" title={e.client}>
                                            {e.client}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>

            {current && openAt !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4"
                    onClick={() => setOpenAt(null)}
                >
                    <div
                        className="flex items-center gap-3 max-w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => step(-1)}
                            disabled={openAt === 0}
                            aria-label="Photo précédente"
                            className="text-white text-3xl px-2 disabled:opacity-25 hover:scale-110 transition-transform"
                        >
                            ‹
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={photoUrl(current, false)}
                            alt={current.caption || `Colis ${current.trackingId}`}
                            className="max-h-[76vh] max-w-[80vw] object-contain bg-white rounded"
                        />
                        <button
                            type="button"
                            onClick={() => step(1)}
                            disabled={openAt === flat.length - 1}
                            aria-label="Photo suivante"
                            className="text-white text-3xl px-2 disabled:opacity-25 hover:scale-110 transition-transform"
                        >
                            ›
                        </button>
                    </div>

                    <div
                        className="mt-3 text-center text-white text-sm max-w-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="font-medium">
                            {current.client}
                            {current.caption ? ` — ${current.caption}` : ""}
                        </p>
                        <p className="text-white/70 text-xs mt-1">
                            <span className="font-mono">{current.trackingId}</span>
                            {current.city ? ` · ${current.city}` : ""}
                            {current.phone ? ` · ${current.phone}` : ""}
                            {current.convoyDate ? ` · convoi du ${current.convoyDate}` : ""}
                        </p>
                        <p className="text-white/50 text-xs mt-1">
                            Photo {openAt + 1} sur {flat.length} ·{" "}
                            {new Date(current.createdAt).toLocaleString("fr-CA")}
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-4 text-xs">
                            <Link
                                href={`/dashboard/shipments/${current.shipmentId}/edit#photos`}
                                className="text-white underline hover:text-white/80"
                            >
                                Ouvrir la fiche du colis
                            </Link>
                            <button
                                type="button"
                                onClick={() => setOpenAt(null)}
                                className="text-white/60 hover:text-white"
                            >
                                Fermer (Échap)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
