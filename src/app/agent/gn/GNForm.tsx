'use client';

import * as React from 'react';

export default function GNForm() {
    const [loading, setLoading] = React.useState(false);
    const [msg, setMsg] = React.useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const fd = new FormData(e.currentTarget);
            const body = Object.fromEntries(fd.entries());

            // Envoi API
            const res = await fetch('/api/shipments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok || !data?.ok) {
                throw new Error(
                    (data && (data.error?.message || data.error)) ||
                    'Erreur lors de la création du colis'
                );
            }

            setMsg('✅ Colis enregistré avec succès !');
            (e.target as HTMLFormElement).reset();
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Erreur inconnue';
            setMsg(`❌ ${message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold">Réception d’un colis (Guinée)</h2>

            {/* Destinataire */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="receiverName" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Nom du destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="receiverName"
                        name="receiverName"
                        required
                        placeholder="Nom du destinataire"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                <div>
                    <label htmlFor="receiverEmail" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Email destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="receiverEmail"
                        name="receiverEmail"
                        type="email"
                        required
                        placeholder="ex: nom@domaine.com"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                <div>
                    <label htmlFor="receiverPhone" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Téléphone
                    </label>
                    <input
                        id="receiverPhone"
                        name="receiverPhone"
                        placeholder="(optionnel)"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                <div>
                    <label htmlFor="convoyDate" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Date du convoi <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="convoyDate"
                        name="convoyDate"
                        type="date"
                        required
                        className="input border p-2 w-full rounded"
                    />
                </div>
            </div>

            {/* Adresse au Canada */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-800">Adresse au Canada</h3>
                <div>
                    <label htmlFor="receiverAddress" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Adresse
                    </label>
                    <input
                        id="receiverAddress"
                        name="receiverAddress"
                        placeholder="N°, rue…"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="receiverCity" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Ville (Canada)
                        </label>
                        <input
                            id="receiverCity"
                            name="receiverCity"
                            placeholder="ex: Montréal, Toronto…"
                            className="input border p-2 w-full rounded"
                        />
                    </div>
                    <div>
                        <label htmlFor="receiverPoBox" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Boîte postale
                        </label>
                        <input
                            id="receiverPoBox"
                            name="receiverPoBox"
                            placeholder="ex: CP J1K2R1"
                            className="input border p-2 w-full rounded"
                        />
                    </div>
                </div>
            </div>

            {/* Métadonnées colis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="weightKg" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Poids (kg)
                    </label>
                    <input
                        id="weightKg"
                        name="weightKg"
                        type="number"
                        step="0.01"
                        placeholder="ex: 2.5"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                {/* Ancien champ prix supprimé */}
            </div>

            {/* Notes */}
            <div>
                <label htmlFor="notes" className="label block mb-1 text-sm font-medium text-neutral-700">
                    Notes
                </label>
                <textarea
                    id="notes"
                    name="notes"
                    placeholder="(optionnel)"
                    className="textarea border p-2 w-full rounded"
                    rows={3}
                />
            </div>

            {/* Submit */}
            <div>
                <button
                    disabled={loading}
                    className="bg-black text-white px-4 py-2 rounded disabled:opacity-60"
                >
                    {loading ? 'Enregistrement…' : 'Enregistrer le colis'}
                </button>
            </div>

            {msg && <p className="mt-2 text-sm">{msg}</p>}
        </form>
    );
}