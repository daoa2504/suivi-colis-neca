"use client";

import { useState } from "react";

type Props = { trackingId: string };

const LABELS: Record<string, string> = {
    CREATED: "Créé",
    RECEIVED_IN_NIGER: "Reçu au Niger",
    RECEIVED_IN_CANADA: "Reçu au Canada",
    IN_TRANSIT: "En route",
    IN_TRANSIT_STOP: "En escale",
    IN_CUSTOMS: "À la douane",
    READY_FOR_PICKUP: "Prêt à être récupéré",
    DELIVERED: "Récupéré",
};

export default function QuickActionsForm({ trackingId }: Props) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    // champs pour l’envoi “personnalisé”
    const [type, setType] = useState<keyof typeof LABELS>("IN_TRANSIT");
    const [location, setLocation] = useState("");
    const [notes, setNotes] = useState("");

    async function postEvent(payload: {
        type: keyof typeof LABELS;
        location?: string;
        description?: string;
    }) {
        setLoading(true);
        setMsg(null);
        setErr(null);
        try {
            const res = await fetch(`/api/shipments/${trackingId}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });

            // Certaines erreurs Next renvoient du HTML → on sécurise
            const isJson = res.headers.get("content-type")?.includes("application/json");
            const data = isJson ? await res.json() : { ok: res.ok, error: await res.text() };

            if (!res.ok || !data.ok) {
                throw new Error((data as any).error || "Échec de l’opération");
            }
            setMsg("✅ Statut mis à jour et email envoyé");
        } catch (e: any) {
            setErr(`Erreur : ${e?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    // Actions rapides (boutons)
    const quick = [
        { t: "IN_TRANSIT" as const, label: LABELS.IN_TRANSIT },
        { t: "IN_CUSTOMS" as const, label: LABELS.IN_CUSTOMS },
        { t: "OUT_FOR_DELIVERY" as const, label: LABELS.OUT_FOR_DELIVERY },
        { t: "DELIVERED" as const, label: LABELS.DELIVERED },
    ];

    return (
        <section className="space-y-5">
            {/* Boutons “one-click” */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <h3 className="mb-3 font-semibold">Actions rapides</h3>
                <div className="flex flex-wrap gap-2">
                    {quick.map(({ t, label }) => (
                        <button
                            key={t}
                            disabled={loading}
                            onClick={() => postEvent({ type: t })}
                            className="px-3 py-1 rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Envoi personnalisé (type + lieu + notes) */}
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <h3 className="mb-3 font-semibold">Mise à jour personnalisée</h3>

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium mb-1">Statut</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as keyof typeof LABELS)}
                            className="input w-full"
                        >
                            {Object.entries(LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium mb-1">Lieu (optionnel)</label>
                        <input
                            className="input w-full"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="ex: Montréal, QC"
                        />
                    </div>
                </div>

                <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                    <textarea
                        className="textarea w-full"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Détails envoyés dans l’email"
                    />
                </div>

                <div className="mt-3">
                    <button
                        disabled={loading}
                        onClick={() => postEvent({ type, location: location || undefined, description: notes || undefined })}
                        className="btn-primary"
                    >
                        {loading ? "Envoi…" : "Mettre à jour & notifier"}
                    </button>
                </div>
            </div>

            {/* messages */}
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
            {err && <p className="text-sm text-red-600">{err}</p>}
        </section>
    );
}