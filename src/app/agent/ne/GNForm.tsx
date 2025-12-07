'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

export default function GNForm() {
    // ⚙️ CONFIGURATION - Modifiez ces valeurs selon vos besoins
    const MIN_DIGITS = 2;        // Nombre minimum de chiffres pour déclencher la recherche
    const DEBOUNCE_DELAY = 200;  // Délai avant recherche en ms
    const MAX_RESULTS = 6;       // Nombre max de suggestions affichées

    // États pour l'autocomplete
    const [searchPhone, setSearchPhone] = useState("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // États pour le formulaire
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState("");
    const [otherCity, setOtherCity] = useState("");
    const [receiverName, setReceiverName] = useState('');

    // Fonction pour capitaliser les noms
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

    // Fonction pour formater le code postal canadien
    const formatPostalCode = (input: string) => {
        let value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
        value = value.replace(/[DFIOQU]/g, '');
        value = value.slice(0, 6);

        if (value.length > 3) {
            return value.slice(0, 3) + ' ' + value.slice(3);
        }

        return value;
    };

    // 🔍 Autocomplete avec debounce
    useEffect(() => {
        const cleaned = searchPhone.replace(/\D/g, "");

        if (cleaned.length < MIN_DIGITS) {
            setSuggestions([]);
            setShowSuggestions(false);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/users/search?q=${cleaned}`);
                const data = await res.json();

                if (data.ok && data.results.length > 0) {
                    setSuggestions(data.results.slice(0, MAX_RESULTS));
                    setShowSuggestions(true);
                    setSelectedIndex(-1);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch {
                setSuggestions([]);
                setShowSuggestions(false);
            } finally {
                setIsSearching(false);
            }
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [searchPhone]);

    // Fermer les suggestions quand on clique ailleurs
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Remplir le formulaire avec les données d'un client
    function fillFormWithClient(client: any) {
        setReceiverName(client.receiverName || "");

        const emailInput = document.getElementById("receiverEmail") as HTMLInputElement;
        if (emailInput) emailInput.value = client.receiverEmail || "";

        const phoneInput = document.getElementById("receiverPhone") as HTMLInputElement;
        if (phoneInput) phoneInput.value = client.receiverPhone || "";

        const addressInput = document.getElementById("receiverAddress") as HTMLInputElement;
        if (addressInput) addressInput.value = client.receiverAddress || "";

        setCity(client.receiverCity || "");
        setPostalCode(client.receiverPoBox || "");

        setShowSuggestions(false);
        setSearchPhone(client.receiverPhone || "");
        setMsg("✅ Client trouvé – formulaire rempli automatiquement");

        // Mettre le focus sur la date du convoi
        setTimeout(() => {
            const convoyDateInput = document.getElementById("convoyDate");
            convoyDateInput?.focus();
        }, 100);
    }

    // Gestion du clavier (flèches + Entrée + Échap)
    function handleKeyDown(e: React.KeyboardEvent) {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    fillFormWithClient(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    }

    // Soumission du formulaire
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const fd = new FormData(e.currentTarget);
            const body = Object.fromEntries(fd.entries());

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

            setMsg(`✅ Colis enregistré avec succès ! Tracking: ${data.trackingId}`);
            (e.target as HTMLFormElement).reset();
            setCity('');
            setOtherCity('');
            setPostalCode('');
            setReceiverName('');
            setSearchPhone('');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue';
            setMsg(`❌ ${message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold">Réception d'un colis (Niger)</h2>

            {/* 🔍 Recherche client existant par téléphone */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 space-y-2 relative" ref={suggestionsRef}>
                <label className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Recherche rapide par téléphone
                    <span className="text-xs text-gray-600">(min. {MIN_DIGITS} chiffres)</span>
                </label>

                <div className="relative">
                    <input
                        type="tel"
                        placeholder={`Tapez un numéro (min. ${MIN_DIGITS} chiffres)...`}
                        className="input border border-blue-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />

                    {/* Indicateur de chargement */}
                    {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                </div>

                {/* ✅ LISTE DES SUGGESTIONS */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 bg-white border border-gray-300 mt-1 w-full rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {suggestions.map((u, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-b-0 ${
                                    selectedIndex === i ? 'bg-blue-100' : ''
                                }`}
                                onClick={() => fillFormWithClient(u)}
                                onMouseEnter={() => setSelectedIndex(i)}
                            >
                                <div className="font-semibold text-gray-900">{u.receiverName}</div>
                                <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                                    <span>📞 {u.receiverPhone}</span>
                                    {u.receiverCity && (
                                        <span className="text-xs text-gray-500">• {u.receiverCity}</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Message "Aucun résultat" */}
                {showSuggestions && suggestions.length === 0 && !isSearching && searchPhone.replace(/\D/g, "").length >= MIN_DIGITS && (
                    <div className="absolute z-20 bg-white border border-gray-300 mt-1 w-full rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
                        Aucun client trouvé pour "{searchPhone.replace(/\D/g, "")}"
                    </div>
                )}
            </div>

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
                        Téléphone <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="receiverPhone"
                        name="receiverPhone"
                        required
                        type="tel"
                        autoComplete="tel"
                        placeholder="+1 (514) 123-4567"
                        pattern="\\+1\\s?\\(?\\d{3}\\)?\\s?\\d{3}-?\\d{4}"
                        title="Format: +1 (514) 123-4567"
                        className="input border p-2 w-full rounded"
                        onKeyDown={(e) => {
                            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                                return;
                            }
                            if (!/^[0-9]$/.test(e.key) && !allowedKeys.includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                        onChange={(e) => {
                            let digits = e.target.value.replace(/\D/g, '');
                            if (digits.length === 0) {
                                e.target.value = '';
                                return;
                            }
                            if (digits[0] !== '1') {
                                digits = '1' + digits;
                            }
                            digits = digits.substring(0, 11);

                            let formatted = '';
                            if (digits.length >= 1) {
                                formatted = '+' + digits[0];
                            }
                            if (digits.length > 1) {
                                formatted += ' (' + digits.substring(1, Math.min(4, digits.length));
                            }
                            if (digits.length > 4) {
                                formatted += ') ' + digits.substring(4, Math.min(7, digits.length));
                            }
                            if (digits.length > 7) {
                                formatted += '-' + digits.substring(7);
                            }

                            e.target.value = formatted;
                        }}
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
                        <label htmlFor="receiverCitySelect" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Ville <span className="text-red-600">*</span>
                        </label>

                        <select
                            id="receiverCitySelect"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="input border p-2 w-full rounded"
                            required={!isOther}
                        >
                            <option value="">-- Sélectionnez une ville --</option>
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
                            <option value="__other__">Autre ville…</option>
                        </select>

                        {isOther && (
                            <div>
                                <label htmlFor="receiverCityOther" className="block text-sm text-neutral-700 mb-1">
                                    Saisissez la ville
                                </label>
                                <input
                                    id="receiverCityOther"
                                    type="text"
                                    placeholder="Ex.: Saint-Georges, Baie-Comeau…"
                                    className="input border p-2 w-full rounded"
                                    value={otherCity}
                                    onChange={(e) => setOtherCity(e.target.value)}
                                    required
                                    minLength={2}
                                />
                            </div>
                        )}

                        <input type="hidden" name="receiverCity" value={effectiveCity} />
                    </div>

                    <div>
                        <label htmlFor="receiverPoBox" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Code postal
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
                        Poids (kg) <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="weightKg"
                        name="weightKg"
                        required
                        type="number"
                        step="0.5"
                        min="1"
                        placeholder="ex: 2.5"
                        className="input border p-2 w-full rounded"
                    />
                </div>
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
                    className="bg-black text-white px-4 py-2 rounded disabled:opacity-60 hover:bg-gray-800 transition-colors font-medium"
                >
                    {loading ? 'Enregistrement…' : 'Enregistrer le colis'}
                </button>
            </div>

            {/* Message de feedback */}
            {msg && (
                <div className={`p-3 rounded-lg ${msg.startsWith('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <p className="text-sm font-medium">{msg}</p>
                </div>
            )}
        </form>
    );
}