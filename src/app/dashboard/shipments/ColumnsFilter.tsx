"use client";

import { useEffect, useRef, useState } from "react";

type ColumnDef = {
    id: string;
    label: string;
    required?: boolean;
};

const COLUMNS: ColumnDef[] = [
    { id: "tracking", label: "Tracking", required: true },
    { id: "convoy", label: "Convoi" },
    { id: "destinataire", label: "Destinataire", required: true },
    { id: "email", label: "Email" },
    { id: "tel", label: "Téléphone" },
    { id: "recuperateur", label: "Récupérateur (Niger)" },
    { id: "statut", label: "Statut" },
    { id: "paiement", label: "Paiement" },
    { id: "colis", label: "Colis" },
    { id: "poids", label: "Poids" },
    { id: "ville", label: "Ville" },
    { id: "cree", label: "Créé le" },
    { id: "actions", label: "Actions", required: true },
];

const DEFAULT_HIDDEN = new Set(["email", "cree"]);

export default function ColumnsFilter() {
    const [hidden, setHidden] = useState<Set<string>>(DEFAULT_HIDDEN);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Injecte le CSS qui cache les colonnes via data-col=""
    useEffect(() => {
        const STYLE_ID = "shipments-cols-toggle-css";
        let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        const hiddenIds = [...hidden].filter((id) => !COLUMNS.find((c) => c.id === id)?.required);
        const selectors = hiddenIds.map((id) => `[data-col="${id}"]`).join(", ");
        style.textContent = selectors ? `${selectors} { display: none !important; }` : "";
        return () => {
            // On laisse le style en place pour ne pas faire de "flash" au reload
        };
    }, [hidden]);

    // Fermer le dropdown au clic en dehors
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    function toggle(id: string) {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const visibleCount = COLUMNS.length - hidden.size;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
            >
                <span>⚙️ Colonnes ({visibleCount}/{COLUMNS.length})</span>
                <svg
                    className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 z-30 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                    <p className="text-xs font-semibold text-gray-500 px-2 py-1.5 uppercase tracking-wide">
                        Afficher / cacher
                    </p>
                    <div className="max-h-96 overflow-y-auto">
                        {COLUMNS.map((c) => {
                            const visible = !hidden.has(c.id);
                            return (
                                <label
                                    key={c.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${
                                        c.required
                                            ? "text-gray-400 cursor-not-allowed"
                                            : "hover:bg-gray-100"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={visible}
                                        disabled={c.required}
                                        onChange={() => !c.required && toggle(c.id)}
                                        className="rounded"
                                    />
                                    <span>{c.label}</span>
                                    {c.required && (
                                        <span className="ml-auto text-[10px] text-gray-400">requis</span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
