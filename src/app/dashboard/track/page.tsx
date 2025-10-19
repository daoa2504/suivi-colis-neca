"use client";

import { useState } from "react";

export default function TrackPage() {
    const [trackingId, setTrackingId] = useState("");
    const [data, setData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setData(null);
        setLoading(true);

        try {
            const res = await fetch(`/api/shipments/${trackingId}`);
            const json = await res.json();

            if (!res.ok || !json.ok) throw new Error(json.error || "Colis introuvable");
            setData(json.shipment);
        } catch (err: any) {
            setError(err.message || "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="max-w-3xl mx-auto mt-10 p-6 bg-white shadow-md rounded-md">
            <h1 className="text-xl font-bold mb-4">📦 Suivi d’un Colis</h1>

            <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-6">
                <input
                    type="text"
                    placeholder="Entrer le numéro de tracking..."
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value.trim())}
                    className="input flex-1"
                    required
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary whitespace-nowrap"
                >
                    {loading ? "Recherche..." : "Rechercher"}
                </button>
            </form>

            {error && <p className="text-red-600">{error}</p>}

            {data && (
                <div className="border rounded-md p-4 bg-neutral-50">
                    <h2 className="font-semibold text-lg mb-2">
                        {data.receiverName} ({data.trackingId})
                    </h2>
                    <p className="text-sm text-neutral-700 mb-1">
                        <strong>Email:</strong> {data.receiverEmail}
                    </p>
                    <p className="text-sm text-neutral-700 mb-1">
                        <strong>Statut:</strong> {data.status}
                    </p>
                    <p className="text-sm text-neutral-700 mb-1">
                        <strong>Poids:</strong> {data.weightKg ?? "—"} kg
                    </p>
                    <p className="text-sm text-neutral-700 mb-1">
                        <strong>Adresse:</strong> {data.receiverAddress ?? "—"}
                    </p>
                    <p className="text-sm text-neutral-700 mb-3">
                        <strong>Ville:</strong> {data.receiverCity ?? "—"}
                    </p>

                    {data.events?.length > 0 && (
                        <>
                            <h3 className="font-semibold mt-4 mb-2">Historique des événements</h3>
                            <ul className="list-disc pl-5 text-sm text-neutral-800">
                                {data.events.map((ev: any) => (
                                    <li key={ev.id}>
                                        <strong>{ev.type}</strong> — {ev.description}{" "}
                                        <span className="text-neutral-500">
                      ({new Date(ev.occurredAt).toLocaleString()})
                    </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </main>
    );
}