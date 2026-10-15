"use client";

// src/app/dashboard/photos/GalleryFilters.tsx
//
// Mêmes filtres que la liste des colis — direction, convoi, ville, recherche
// — plus le choix du regroupement. Changer un filtre renvoie à la page 1 :
// rester page 4 d'un autre résultat n'aurait aucun sens.

import { useRouter } from "next/navigation";
import * as React from "react";

type Props = {
    cities: string[];
    convoys: { id: string; label: string }[];
    current: {
        direction: string;
        convoyId: string;
        city: string;
        q: string;
        group: string;
    };
};

export default function GalleryFilters({ cities, convoys, current }: Props) {
    const router = useRouter();

    function push(next: Partial<Props["current"]>) {
        const merged = { ...current, ...next };
        const params = new URLSearchParams();
        if (merged.direction) params.set("direction", merged.direction);
        if (merged.convoyId) params.set("convoyId", merged.convoyId);
        if (merged.city) params.set("city", merged.city);
        if (merged.q) params.set("q", merged.q);
        params.set("group", merged.group || "client");
        router.push(`/dashboard/photos?${params.toString()}`);
    }

    function onSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q");
        push({ q: String(value ?? "").trim() });
    }

    const select = "rounded-md border px-3 py-2 text-sm bg-white";

    return (
        <div className="border rounded-lg p-4 bg-white space-y-3">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-700">Regrouper par</span>
                    <select
                        value={current.group}
                        onChange={(e) => push({ group: e.target.value })}
                        className={select}
                    >
                        <option value="client">Client</option>
                        <option value="city">Ville</option>
                        <option value="convoy">Convoi</option>
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-700">Sens</span>
                    <select
                        value={current.direction}
                        onChange={(e) => push({ direction: e.target.value })}
                        className={select}
                    >
                        <option value="">Les deux sens</option>
                        <option value="NE_TO_CA">Niger → Canada</option>
                        <option value="CA_TO_NE">Canada → Niger</option>
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-700">Convoi</span>
                    <select
                        value={current.convoyId}
                        onChange={(e) => push({ convoyId: e.target.value })}
                        className={select}
                    >
                        <option value="">Tous les convois</option>
                        {convoys.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-700">Ville</span>
                    <select
                        value={current.city}
                        onChange={(e) => push({ city: e.target.value })}
                        className={select}
                    >
                        <option value="">Toutes les villes</option>
                        {cities.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>

                <form onSubmit={onSearch} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-700">
                        Client, suivi, téléphone, légende
                    </span>
                    <div className="flex gap-2">
                        <input
                            name="q"
                            defaultValue={current.q}
                            placeholder="ex. Aïcha, NECA-128, « carton 2 »"
                            className="rounded-md border px-3 py-2 text-sm w-64"
                        />
                        <button
                            type="submit"
                            className="bg-black text-white px-3 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                            Chercher
                        </button>
                    </div>
                </form>
            </div>

            {(current.direction || current.convoyId || current.city || current.q) && (
                <button
                    type="button"
                    onClick={() =>
                        push({ direction: "", convoyId: "", city: "", q: "" })
                    }
                    className="text-xs text-neutral-600 hover:text-black underline"
                >
                    Effacer les filtres
                </button>
            )}
        </div>
    );
}
