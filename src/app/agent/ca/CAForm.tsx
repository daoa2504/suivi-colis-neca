// src/app/agent/ca/CAForm.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function CAForm() {
    const router = useRouter();

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
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
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

        const cityInput = document.getElementById("receiverCity") as HTMLInputElement;
        if (cityInput) cityInput.value = client.receiverCity || "";

        const poBoxInput = document.getElementById("receiverPoBox") as HTMLInputElement;
        if (poBoxInput) poBoxInput.value = client.receiverPoBox || "";

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

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        const form = e.currentTarget;
        const fd = new FormData(form);

        const payload = {
            convoyDate: String(fd.get("convoyDate") || "").trim(),
            receiverName: String(fd.get("receiverName") || "").trim(),
            receiverEmail: String(fd.get("receiverEmail") || "").trim(),
            receiverPhone: (fd.get("receiverPhone") as string) || null,
            weightKg:
                fd.get("weightKg") && String(fd.get("weightKg")).length > 0
                    ? Number(fd.get("weightKg"))
                    : null,
            receiverAddress: (fd.get("receiverAddress") as string) || null,
            receiverCity: (fd.get("receiverCity") as string) || null,
            receiverPoBox: (fd.get("receiverPoBox") as string) || null,
            notes: (fd.get("notes") as string) || null,
            direction: "CA_TO_NE",
        };

        try {
            const res = await fetch("/api/shipments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data =
                res.headers.get("content-type")?.includes("application/json")
                    ? await res.json()
                    : { ok: false, error: await res.text() };

            if (!res.ok || !(data as any).ok) {
                throw new Error((data as any).error || "Création échouée");
            }

            form.reset();
            setReceiverName('');
            setSearchPhone('');
            setMsg(`✅ Colis enregistré. Tracking: ${(data as any).trackingId}`);
            router.refresh();
        } catch (err: any) {
            setMsg(`❌ Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-6 space-y-6 max-w-2xl">
            <h2 className="text-xl font-semibold">Envoi d'un colis (Canada → Niger)</h2>

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

            {/* Date du convoi */}
            <div>
                <label htmlFor="convoyDate" className="label block mb-1 text-sm font-medium text-neutral-700">
                    Date du convoi (CA → NE) <span className="text-red-600">*</span>
                </label>
                <input
                    id="convoyDate"
                    name="convoyDate"
                    type="date"
                    className="input border p-2 w-full rounded"
                    required
                />
            </div>

            {/* Informations destinataire */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="receiverName" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Nom destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="receiverName"
                        name="receiverName"
                        className="input border p-2 w-full rounded"
                        required
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
                        className="input border p-2 w-full rounded"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="receiverPhone" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Téléphone
                    </label>
                    <input
                        id="receiverPhone"
                        name="receiverPhone"
                        className="input border p-2 w-full rounded"
                        placeholder="(optionnel)"
                    />
                </div>
                <div>
                    <label htmlFor="weightKg" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Poids (kg)
                    </label>
                    <input
                        id="weightKg"
                        name="weightKg"
                        type="number"
                        step="0.01"
                        className="input border p-2 w-full rounded"
                    />
                </div>
            </div>

            {/* Adresse (Niger) */}
            <fieldset className="space-y-4">
                <legend className="label font-semibold text-neutral-800">Adresse (Niger)</legend>
                <div>
                    <label htmlFor="receiverAddress" className="label block mb-1 text-sm font-medium text-neutral-700">
                        Adresse
                    </label>
                    <input
                        id="receiverAddress"
                        name="receiverAddress"
                        className="input border p-2 w-full rounded"
                        placeholder="quartier, rue…"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="receiverCity" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Ville
                        </label>
                        <input
                            id="receiverCity"
                            name="receiverCity"
                            className="input border p-2 w-full rounded"
                            placeholder="ex: Niamey"
                        />
                    </div>
                    <div>
                        <label htmlFor="receiverPoBox" className="label block mb-1 text-sm font-medium text-neutral-700">
                            Boîte postale
                        </label>
                        <input
                            id="receiverPoBox"
                            name="receiverPoBox"
                            className="input border p-2 w-full rounded"
                            placeholder="(optionnel)"
                        />
                    </div>
                </div>
            </fieldset>

            {/* Notes */}
            <div>
                <label htmlFor="notes" className="label block mb-1 text-sm font-medium text-neutral-700">
                    Notes
                </label>
                <textarea
                    id="notes"
                    name="notes"
                    className="textarea border p-2 w-full rounded"
                    placeholder="(optionnel)"
                    rows={3}
                />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
                <button
                    disabled={loading}
                    className="bg-black text-white px-4 py-2 rounded disabled:opacity-60 hover:bg-gray-800 transition-colors font-medium"
                >
                    {loading ? "Enregistrement…" : "Enregistrer le colis"}
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