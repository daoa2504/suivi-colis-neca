"use client";

// src/components/PhotoPicker.tsx
//
// Choix des photos pendant la saisie d'un nouveau colis, avant qu'il existe
// en base. Les images sont réduites tout de suite mais gardées en mémoire :
// le formulaire les envoie une fois le colis créé et son numéro connu.
//
// Demander à l'agent de revenir sur la fiche après coup pour ajouter les
// photos, c'est garantir qu'elles manqueront : la photo se prend au moment
// où le carton est devant soi.

import { useRef, useState } from "react";
import * as React from "react";
import { formatBytes, preparePhoto, type PreparedPhoto } from "@/lib/photoClient";

export default function PhotoPicker({
    value,
    onChange,
    max = 12,
}: {
    value: PreparedPhoto[];
    onChange: (next: PreparedPhoto[]) => void;
    max?: number;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (files.length === 0) return;

        const room = max - value.length;
        if (room <= 0) {
            setError(`Maximum ${max} photos par colis.`);
            return;
        }

        setBusy(true);
        setError(null);
        const added: PreparedPhoto[] = [];
        const failures: string[] = [];

        for (const file of files.slice(0, room)) {
            try {
                added.push(await preparePhoto(file));
            } catch (err: any) {
                failures.push(err?.message || "Image illisible");
            }
        }

        if (files.length > room) {
            failures.push(`${files.length - room} photo(s) ignorée(s) : limite de ${max}.`);
        }

        setBusy(false);
        if (failures.length > 0) setError(failures.join(" · "));
        if (added.length > 0) onChange([...value, ...added]);
    }

    function remove(localId: string) {
        const gone = value.find((p) => p.localId === localId);
        if (gone) URL.revokeObjectURL(gone.previewUrl);
        onChange(value.filter((p) => p.localId !== localId));
    }

    function setCaption(localId: string, caption: string) {
        onChange(value.map((p) => (p.localId === localId ? { ...p, caption } : p)));
    }

    return (
        <div className="border rounded-lg p-4 bg-neutral-50">
            <h3 className="font-semibold text-neutral-800 mb-1">
                📷 Photos du colis
                <span className="ml-2 text-sm font-normal text-neutral-500">
                    (optionnel)
                </span>
            </h3>
            <p className="text-sm text-neutral-600 mb-3">
                Preuve de l&apos;état du colis à la prise en charge. Elles seront
                envoyées dès l&apos;enregistrement.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-3">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={busy || value.length >= max}
                    className="border border-neutral-400 bg-white px-3 py-2 rounded text-sm font-medium disabled:opacity-60 hover:bg-neutral-100 transition-colors"
                >
                    {busy ? "Préparation…" : "Choisir ou prendre des photos"}
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
                    {value.length}/{max} — réduites automatiquement avant l&apos;envoi.
                </span>
            </div>

            {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">
                    {error}
                </p>
            )}

            {value.length > 0 && (
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 list-none p-0 m-0">
                    {value.map((p) => (
                        <li key={p.localId} className="border rounded overflow-hidden bg-white">
                            <div className="aspect-square bg-neutral-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={p.previewUrl}
                                    alt={p.caption || p.originalName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-2 space-y-1">
                                <input
                                    value={p.caption}
                                    placeholder="Légende…"
                                    maxLength={200}
                                    onChange={(e) => setCaption(p.localId, e.target.value)}
                                    className="w-full text-xs border rounded px-1.5 py-1"
                                />
                                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                                    <span title={p.originalName}>
                                        {formatBytes(p.full.size)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(p.localId)}
                                        className="text-red-600 hover:underline"
                                    >
                                        Retirer
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
