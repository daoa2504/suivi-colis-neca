// src/app/admin/convoys/SurchargesEditor.tsx
//
// Suppléments de ville d'un convoi. Le montant saisi ici s'ajoute en ligne
// distincte sur la facture des seuls clients de cette ville.
//
// Repliable : la plupart des convois n'en ont aucun, la liste des convois
// resterait illisible si chaque ligne dépliait un formulaire.

"use client";

import { useState } from "react";

type Surcharge = {
    id: string;
    city: string;
    amount: number;
    currency: "CAD" | "XOF";
    label: string | null;
};

// Villes canadiennes desservies, reprises du formulaire de saisie des colis.
const CITIES = [
    "Montréal", "Québec", "Laval", "Gatineau", "Longueuil",
    "Sherbrooke", "Saguenay", "Lévis", "Trois-Rivières",
    "Terrebonne", "Drummondville", "Saint-Jérôme", "Rimouski",
];

export default function SurchargesEditor({ convoyId }: { convoyId: string }) {
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [rows, setRows] = useState<Surcharge[]>([]);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const [city, setCity] = useState("Québec");
    const [otherCity, setOtherCity] = useState("");
    const [amount, setAmount] = useState("");

    const effectiveCity = city === "__other__" ? otherCity.trim() : city;

    async function load() {
        try {
            const res = await fetch(`/api/convoys/${convoyId}/surcharges`);
            const data = await res.json();
            if (data.ok) setRows(data.surcharges);
        } catch {
            // silencieux : le panneau s'ouvre vide, l'ajout reste possible
        } finally {
            setLoaded(true);
        }
    }

    function toggle() {
        const next = !open;
        setOpen(next);
        if (next && !loaded) load();
    }

    async function add(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!effectiveCity) {
            setMsg("❌ Précisez la ville");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch(`/api/convoys/${convoyId}/surcharges`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city: effectiveCity, amount, currency: "CAD" }),
            });
            const data = await res.json();
            if (!data.ok) {
                const e = data.error;
                setMsg(`❌ ${typeof e === "string" ? e : "Montant ou ville invalide"}`);
                return;
            }
            setRows((prev) => {
                const without = prev.filter((r) => r.id !== data.surcharge.id);
                return [...without, data.surcharge].sort((a, b) => a.city.localeCompare(b.city));
            });
            setAmount("");
            setOtherCity("");
            setMsg("✅ Supplément enregistré");
        } catch (err: any) {
            setMsg(`❌ ${err.message}`);
        } finally {
            setBusy(false);
        }
    }

    async function remove(id: string) {
        setBusy(true);
        try {
            const res = await fetch(
                `/api/convoys/${convoyId}/surcharges?surchargeId=${id}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            if (data.ok) setRows((prev) => prev.filter((r) => r.id !== id));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="mt-2">
            <button
                type="button"
                onClick={toggle}
                className="text-xs text-neutral-600 hover:text-neutral-900 hover:underline"
            >
                {open ? "▾" : "▸"} Suppléments par ville
                {rows.length > 0 && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-1.5 text-[10px] font-semibold">
                        {rows.length}
                    </span>
                )}
            </button>

            {open && (
                <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-3">
                    <p className="text-[11px] text-neutral-500 leading-snug">
                        Tarif <strong>au kilo</strong>, ajouté en ligne distincte sur la facture des clients de cette ville — 3 $/kg sur 2 kg donne 6 $.
                        S'applique aux factures générées ensuite ; celles déjà émises ne
                        changent pas.
                    </p>

                    {!loaded ? (
                        <p className="text-xs text-neutral-400">Chargement…</p>
                    ) : rows.length === 0 ? (
                        <p className="text-xs text-neutral-400">Aucun supplément.</p>
                    ) : (
                        <ul className="space-y-1">
                            {rows.map((r) => (
                                <li
                                    key={r.id}
                                    className="flex items-center justify-between gap-2 text-xs bg-white border border-neutral-200 rounded px-2 py-1"
                                >
                                    <span>
                                        <strong>{r.city}</strong> — {r.amount.toFixed(2)}{" "}
                                        / kg
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => remove(r.id)}
                                        disabled={busy}
                                        className="text-red-600 hover:underline disabled:text-neutral-400"
                                    >
                                        Retirer
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <form onSubmit={add} className="flex flex-wrap items-end gap-2">
                        <div>
                            <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">
                                Ville
                            </label>
                            <select
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="border rounded px-2 py-1 text-xs bg-white"
                            >
                                {CITIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                                <option value="__other__">Autre…</option>
                            </select>
                        </div>

                        {city === "__other__" && (
                            <div>
                                <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">
                                    Préciser
                                </label>
                                <input
                                    value={otherCity}
                                    onChange={(e) => setOtherCity(e.target.value)}
                                    className="border rounded px-2 py-1 text-xs w-32"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-medium text-neutral-600 mb-0.5">
                                Tarif ($ CAD / kg)
                            </label>
                            <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="3"
                                className="border rounded px-2 py-1 text-xs w-24"
                            />
                        </div>

                        <button
                            disabled={busy}
                            className="px-3 py-1 rounded bg-neutral-900 text-white text-xs hover:bg-neutral-700 disabled:opacity-60"
                        >
                            {busy ? "…" : "Enregistrer"}
                        </button>
                    </form>

                    {msg && <p className="text-xs text-neutral-600">{msg}</p>}
                </div>
            )}
        </div>
    );
}
