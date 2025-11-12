'use client';

import * as React from 'react';
import { useState } from 'react';
export default function GNForm() {
    const [loading, setLoading] = React.useState(false);
    const [msg, setMsg] = React.useState<string | null>(null);
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState("");
    const [otherCity, setOtherCity] = useState("");
    const [receiverName, setReceiverName] = useState('');
    const capitalizeNames = (input: string) => {
        return input
            .split(' ')
            .map(word => {
                if (word.length === 0) return word;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    };
    const isOther = city === "__other__";
    const effectiveCity = isOther ? otherCity.trim() : city;
    const formatPostalCode = (input: string) => {
        // Retirer tout sauf lettres et chiffres
        let value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');

        // Retirer lettres interdites
        value = value.replace(/[DFIOQU]/g, '');

        // Limiter à 6 caractères
        value = value.slice(0, 6);

        // Ajouter l'espace après le 3ème caractère
        if (value.length > 3) {
            return value.slice(0, 3) + ' ' + value.slice(3);
        }

        return value;
    };
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
            setCity('');
            setOtherCity('');
            setPostalCode('');
            setReceiverName('');
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
            <h2 className="text-xl font-semibold">Réception d’un colis (Niger)</h2>

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
                        value={receiverName}
                        onChange={(e) => setReceiverName(capitalizeNames(e.target.value))}
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
                        placeholder="N°, rue…"
                        className="input border p-2 w-full rounded"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label
                            htmlFor="receiverCitySelect"
                            className="label block mb-1 text-sm font-medium text-neutral-700"
                        >
                            Ville (Québec)
                        </label>

                        {/* Sélect court */}
                        <select
                            id="receiverCitySelect"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="input border p-2 w-full rounded"
                            required={!isOther} // requis si pas "Autre"
                        >
                            <option value="">-- Sélectionnez une ville --</option>

                            {/* Liste courte des plus connues */}
                            <option value="Montréal">Montréal</option>
                            <option value="Québec">Québec</option>
                            <option value="Laval">Laval</option>
                            <option value="Gatineau">Gatineau</option>
                            <option value="Longueuil">Longueuil</option>
                            <option value="Sherbrooke">Sherbrooke</option>
                            <option value="Saguenay">Saguenay</option>
                            <option value="Lévis">Lévis</option>
                            <option value="Trois-Rivières">Trois-Rivières</option>
                            <option value="Terrebonne">Terrebonne</option>
                            <option value="Drummondville">Drummondville</option>
                            <option value="Saint-Jérôme">Saint-Jérôme</option>
                            <option value="Rimouski">Rimouski</option>

                            {/* Option pour saisir une autre ville */}
                            <option value="__other__">Autre ville…</option>
                        </select>

                        {/* Champ libre affiché seulement si "Autre ville" */}
                        {isOther && (
                            <div>
                                <label
                                    htmlFor="receiverCityOther"
                                    className="block text-sm text-neutral-700 mb-1"
                                >
                                    Saisissez la ville
                                </label>
                                <input
                                    id="receiverCityOther"
                                    type="text"
                                    placeholder="Ex.: Saint-Georges, Baie-Comeau…"
                                    className="input border p-2 w-full rounded"
                                    value={otherCity}
                                    onChange={(e) => setOtherCity(e.target.value)}
                                    required // requis quand "Autre"
                                    minLength={2}
                                />
                            </div>
                        )}

                        {/* Le vrai champ envoyé au serveur */}
                        <input
                            type="hidden"
                            name="receiverCity"
                            value={effectiveCity}
                        />
                    </div>
                    <div>
                        <label htmlFor="receiverPoBox" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Boîte postale
                        </label>
                        <input
                            id="receiverPoBox"
                            name="receiverPoBox"
                            value={postalCode}
                            autoComplete="off"
                            placeholder="ex: A1B 2C3"
                            maxLength={7}
                            className="input border p-2 w-full rounded uppercase"
                            pattern="[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] [0-9][ABCEGHJ-NPRSTV-Z][0-9]"
                            title="Format requis: A1B 2C3"
                            onChange={(e) => setPostalCode(formatPostalCode(e.target.value))}
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
                        required
                        type="number"
                        step="0.5"
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