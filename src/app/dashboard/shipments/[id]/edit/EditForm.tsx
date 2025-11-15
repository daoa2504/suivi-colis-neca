// src/app/dashboard/shipments/[id]/EditForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import * as React from "react";

type Shipment = {
    id: number;
    trackingId: string;
    receiverName: string;
    receiverEmail: string;
    receiverPhone?: string | null;
    weightKg?: number | null;
    notes?: string | null;

    // 🔸 nouveaux champs "adresse au Canada"
    receiverAddress?: string | null;
    receiverCity?: string | null;
    receiverPoBox?: string | null;
};

export default function EditForm({ shipment }: { shipment: Shipment }) {
    const router = useRouter();
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState(shipment.receiverPhone || "");
    const [otherCity, setOtherCity] = useState("");
    const [city, setCity] = useState("");

    const isOther = city === "__other__";
    const effectiveCity = (isOther ? otherCity.trim() : city).trim();
    // States pour tous les champs
    const [receiverName, setReceiverName] = useState(shipment.receiverName);
    const [receiverEmail, setReceiverEmail] = useState(shipment.receiverEmail);
    const [weightKg, setWeightKg] = useState(shipment.weightKg?.toString() || "");
    const [receiverAddress, setReceiverAddress] = useState(shipment.receiverAddress || "");
    const [receiverCity, setReceiverCity] = useState(shipment.receiverCity || "");
    const [receiverPoBox, setReceiverPoBox] = useState(shipment.receiverPoBox || "");
    const [notes, setNotes] = useState(shipment.notes || "");

    // Fonction pour formater le téléphone
    const formatPhone = (value: string) => {
        let digits = value.replace(/\D/g, '');

        if (digits.length === 0) {
            return '';
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

        return formatted;
    };

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        // ⚠️ on typpe/normalise ce qui doit être nombre ou string optionnelle
        const payload = {
            receiverName: receiverName.trim(),
            receiverEmail: receiverEmail.trim(),
            receiverPhone: phone || null,
            weightKg: weightKg && weightKg.length > 0 ? Number(weightKg) : null,
            notes: notes || null,

            // 🔸 nouveaux champs
            receiverAddress: receiverAddress || null,
            receiverCity: effectiveCity  || null,
            receiverPoBox: receiverPoBox || null,
        };

        try {
            const res = await fetch(`/dashboard/shipments/${shipment.id}`, {
                method: "PUT",
                credentials: "include", // << indispensable pour que la session arrive côté serveur
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
                cache: "no-store",
            });

            const data = res.headers.get("Content-Type")?.includes("application/json")
                ? await res.json()
                : { ok: res.ok, error: await res.text() };

            if (!res.ok || !data?.ok) {
                throw new Error((data as any)?.error || "Mise à jour échouée");
            }

            setMsg("✅ Modifications enregistrées");
            setReceiverName("");
            setReceiverEmail("");
            setPhone("");
            setWeightKg("");
            setReceiverAddress("");
            setReceiverCity("");
            setReceiverPoBox("");
            setNotes("");

// Reset du formulaire HTML
            (e.target as HTMLFormElement).reset();
            // Réinitialiser le formulaire après succès
            setPhone("");
            (e.target as HTMLFormElement).reset();

            router.refresh();
        } catch (err: any) {
            setMsg(`Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-4 grid gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="label">
                        Nom du destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        name="receiverName"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        className="input"
                        required
                    />
                </div>

                <div>
                    <label className="label">
                        Email destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        name="receiverEmail"
                        type="email"
                        value={receiverEmail}
                        onChange={(e) => setReceiverEmail(e.target.value)}
                        className="input"
                        required
                    />
                </div>

                <div>
                    <label className="label">Téléphone</label>
                    <input
                        name="receiverPhone"
                        type="tel"
                        autoComplete="tel"
                        placeholder="(optionnel) +1 (514) 123-4567"
                        className="input"
                        value={phone}
                        onKeyDown={(e) => {
                            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

                            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
                                return;
                            }

                            if (e.key === '+') {
                                return;
                            }

                            if (!/^[0-9]$/.test(e.key) && !allowedKeys.includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                        onInput={(e) => {
                            const formatted = formatPhone(e.currentTarget.value);
                            setPhone(formatted);
                        }}
                    />
                </div>

                <div>
                    <label className="label">Poids (kg)</label>
                    <input
                        name="weightKg"
                        type="number"
                        step="0.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="input"
                        placeholder="ex: 2.5"
                    />
                </div>
            </div>

            <fieldset className="grid gap-4">
                <legend className="label font-semibold">Adresse au Canada</legend>

                <div>
                    <label className="label">Adresse</label>
                    <input
                        name="receiverAddress"
                        value={receiverAddress}
                        onChange={(e) => setReceiverAddress(e.target.value)}
                        className="input"
                        placeholder="N°, rue…"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Ville (Canada)</label>
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

                    </div>

                    <div>
                        <label className="label">Boîte postale</label>
                        <input
                            name="receiverPoBox"
                            value={receiverPoBox}
                            onChange={(e) => setReceiverPoBox(e.target.value)}
                            className="input"
                            placeholder="ex: CP J1K2R1"
                        />
                    </div>
                </div>
            </fieldset>

            <div>
                <label className="label">Notes</label>
                <textarea
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="textarea"
                    placeholder="(optionnel)"
                />
            </div>

            <div className="flex items-center gap-3">
                <button disabled={loading} className="btn-primary">
                    {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
                {msg && <span className="text-sm">{msg}</span>}
            </div>
        </form>
    );
}