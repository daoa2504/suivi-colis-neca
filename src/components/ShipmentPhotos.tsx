"use client";

// src/components/ShipmentPhotos.tsx
//
// Galerie photo d'un colis déjà enregistré : consultation, ajout, légende,
// suppression. Les colis se ressemblent et se mélangent ; c'est la photo,
// rattachée au numéro de suivi et au nom du client, qui tranche.

import { useCallback, useEffect, useRef, useState } from "react";
import * as React from "react";
import { formatBytes, preparePhoto, uploadPreparedPhoto } from "@/lib/photoClient";

type Photo = {
    id: string;
    caption: string | null;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    createdAt: string;
    hasThumb: boolean;
    takenBy: string | null;
};

export default function ShipmentPhotos({
    shipmentId,
    trackingId,
    receiverName,
}: {
    shipmentId: number;
    trackingId: string;
    receiverName?: string;
}) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [zoomed, setZoomed] = useState<Photo | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const src = (p: Photo, thumb: boolean) =>
        `/api/shipments/${shipmentId}/photos/${p.id}${thumb ? "?size=thumb" : ""}`;

    const reload = useCallback(async () => {
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/photos`, { cache: "no-store" });
            const json = await res.json();
            if (!json?.ok) throw new Error(json?.error || "Chargement impossible");
            setPhotos(json.photos);
            setError(null);
        } catch (e: any) {
            setError(e?.message || "Chargement impossible");
        } finally {
            setLoading(false);
        }
    }, [shipmentId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    // Fermer l'agrandissement à l'Échap : le réflexe attendu.
    useEffect(() => {
        if (!zoomed) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setZoomed(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [zoomed]);

    async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ""; // réautorise le même fichier plus tard
        if (files.length === 0) return;

        setError(null);
        const failures: string[] = [];

        for (let i = 0; i < files.length; i++) {
            setBusy(`Envoi ${i + 1}/${files.length}…`);
            try {
                const prepared = await preparePhoto(files[i]);
                const sent = await uploadPreparedPhoto(shipmentId, prepared);
                URL.revokeObjectURL(prepared.previewUrl);
                if (!sent.ok) failures.push(sent.error);
            } catch (err: any) {
                failures.push(err?.message || "Échec de l'envoi");
            }
        }

        setBusy(null);
        if (failures.length > 0) setError(failures.join(" · "));
        await reload();
    }

    async function saveCaption(photo: Photo, caption: string) {
        const next = caption.trim();
        if (next === (photo.caption ?? "")) return;
        setPhotos((prev) =>
            prev.map((p) => (p.id === photo.id ? { ...p, caption: next || null } : p))
        );
        const res = await fetch(`/api/shipments/${shipmentId}/photos/${photo.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caption: next }),
        });
        if (!res.ok) {
            setError("La légende n'a pas pu être enregistrée");
            await reload();
        }
    }

    async function remove(photo: Photo) {
        const label = photo.caption ? `« ${photo.caption} »` : "cette photo";
        if (!confirm(`Supprimer ${label} ? Cette action est définitive.`)) return;

        setBusy("Suppression…");
        const res = await fetch(`/api/shipments/${shipmentId}/photos/${photo.id}`, {
            method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        setBusy(null);
        if (!res.ok || !json?.ok) {
            setError(json?.error || "Suppression impossible");
            return;
        }
        if (zoomed?.id === photo.id) setZoomed(null);
        await reload();
    }

    return (
        <section id="photos" className="border rounded-lg p-4 bg-white scroll-mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className="font-semibold text-neutral-800">
                    📷 Photos du colis
                    {photos.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-neutral-500">
                            {photos.length} enregistrée{photos.length > 1 ? "s" : ""}
                        </span>
                    )}
                </h2>
                <span className="text-xs text-neutral-500 font-mono">{trackingId}</span>
            </div>
            <p className="text-sm text-neutral-600 mb-3">
                Preuve de l&apos;état du colis à la prise en charge
                {receiverName ? ` — ${receiverName}` : ""}. Nommez chaque photo
                (« carton 1/3 », « étiquette ») pour les retrouver quand plusieurs
                colis se ressemblent.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-3">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={Boolean(busy)}
                    className="bg-black text-white px-3 py-2 rounded text-sm font-medium disabled:opacity-60 hover:bg-gray-800 transition-colors"
                >
                    {busy ?? "Ajouter des photos"}
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    multiple
                    className="hidden"
                    onChange={onPick}
                />
                <span className="text-xs text-neutral-500">
                    Réduites automatiquement avant l&apos;envoi — 12 photos maximum.
                </span>
            </div>

            {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">
                    {error}
                </p>
            )}

            {loading ? (
                <p className="text-sm text-neutral-500">Chargement…</p>
            ) : photos.length === 0 ? (
                <p className="text-sm text-neutral-500 italic">Aucune photo pour ce colis.</p>
            ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 list-none p-0 m-0">
                    {photos.map((p) => (
                        <li key={p.id} className="border rounded overflow-hidden bg-neutral-50">
                            <button
                                type="button"
                                onClick={() => setZoomed(p)}
                                className="block w-full aspect-square bg-neutral-200 cursor-zoom-in"
                                title="Agrandir"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={src(p, p.hasThumb)}
                                    alt={p.caption || `Photo du colis ${trackingId}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                            </button>
                            <div className="p-2 space-y-1">
                                <input
                                    defaultValue={p.caption ?? ""}
                                    placeholder="Légende…"
                                    maxLength={200}
                                    onBlur={(e) => void saveCaption(p, e.target.value)}
                                    className="w-full text-xs border rounded px-1.5 py-1"
                                />
                                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                    <span title={new Date(p.createdAt).toLocaleString("fr-CA")}>
                                        {formatBytes(p.byteSize)}
                                        {p.takenBy ? ` · ${p.takenBy}` : ""}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void remove(p)}
                                        className="text-red-600 hover:underline"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {zoomed && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
                    onClick={() => setZoomed(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src(zoomed, false)}
                        alt={zoomed.caption || `Photo du colis ${trackingId}`}
                        className="max-h-[80vh] max-w-full object-contain bg-white"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="mt-3 text-center text-white text-sm">
                        <p className="font-medium">{zoomed.caption || "Sans légende"}</p>
                        <p className="text-white/70 text-xs mt-1">
                            {trackingId}
                            {receiverName ? ` — ${receiverName}` : ""} ·{" "}
                            {new Date(zoomed.createdAt).toLocaleString("fr-CA")}
                        </p>
                        <p className="text-white/50 text-xs mt-2">
                            Cliquez n&apos;importe où, ou Échap, pour fermer
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}
