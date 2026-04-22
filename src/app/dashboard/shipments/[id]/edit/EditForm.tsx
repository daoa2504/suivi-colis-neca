"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as React from "react";

type Shipment = {
    id: number;
    trackingId: string;
    receiverName: string;
    receiverEmail: string;
    receiverPhone?: string | null;
    weightKg?: number | null;
    notes?: string | null;
    receiverAddress?: string | null;
    receiverCity?: string | null;
    receiverPoBox?: string | null;
    pickupLastName?: string | null;
    pickupFirstName?: string | null;
    pickupQuartier?: string | null;
    pickupPhone?: string | null;
    convoyId?: string | null;
    convoy?: { id: string; date: Date | string; direction: "CA_TO_NE" | "NE_TO_CA" } | null;
};

type Direction = "CA_TO_NE" | "NE_TO_CA";

function capitalizeNames(input: string) {
    return input
        .split(" ")
        .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");
}

function dateToISO(d: Date | string | null | undefined) {
    if (!d) return "";
    return new Date(d).toISOString().slice(0, 10);
}

export default function EditForm({
    shipment,
    direction,
}: {
    shipment: Shipment;
    direction: Direction;
}) {
    const router = useRouter();
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Champs communs
    const [receiverName, setReceiverName] = useState(shipment.receiverName || "");
    const [receiverEmail, setReceiverEmail] = useState(shipment.receiverEmail || "");
    const [phone, setPhone] = useState(shipment.receiverPhone || "");
    const [weightKg, setWeightKg] = useState(shipment.weightKg?.toString() || "");
    const [receiverAddress, setReceiverAddress] = useState(shipment.receiverAddress || "");
    const [receiverPoBox, setReceiverPoBox] = useState(shipment.receiverPoBox || "");
    const [notes, setNotes] = useState(shipment.notes || "");

    // Ville : dropdown canadien (NE→CA) ou champ libre (CA→NE)
    const CANADIAN_CITIES = [
        "Montréal", "Québec", "Laval", "Gatineau", "Longueuil",
        "Sherbrooke", "Saguenay", "Lévis", "Trois-Rivières",
        "Terrebonne", "Drummondville", "Saint-Jérôme", "Rimouski",
    ];
    const initCity = shipment.receiverCity || "";
    const initCityIsKnown = CANADIAN_CITIES.includes(initCity);
    const [city, setCity] = useState(
        direction === "NE_TO_CA"
            ? initCityIsKnown ? initCity : initCity ? "__other__" : ""
            : initCity
    );
    const [otherCity, setOtherCity] = useState(
        direction === "NE_TO_CA" && !initCityIsKnown ? initCity : ""
    );
    const isOther = city === "__other__";
    const effectiveCity = direction === "NE_TO_CA"
        ? (isOther ? otherCity.trim() : city)
        : city.trim();

    // Récupérateur au Niger (CA→NE uniquement)
    const [pickupLastName, setPickupLastName] = useState(shipment.pickupLastName || "");
    const [pickupFirstName, setPickupFirstName] = useState(shipment.pickupFirstName || "");
    const [pickupQuartier, setPickupQuartier] = useState(shipment.pickupQuartier || "");
    const [pickupPhone, setPickupPhone] = useState(shipment.pickupPhone || "");

    // Convoi — on permet de changer pour un autre convoi à venir
    const [selectedConvoyId, setSelectedConvoyId] = useState(shipment.convoyId || "");
    const [availableConvoys, setAvailableConvoys] = useState<
        { id: string; date: string }[]
    >([]);
    const currentConvoyLabel = shipment.convoy
        ? `${dateToISO(shipment.convoy.date)} (${direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"})`
        : "";

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/convoys/list?direction=${direction}&upcomingOnly=true`);
                const data = await res.json();
                if (!data.ok) return;
                const list = (data.convoys as any[])
                    .map((c) => ({ id: c.id, date: dateToISO(c.date) }))
                    .sort((a, b) => (a.date < b.date ? 1 : -1));
                // S'assurer que le convoi courant est dans la liste (même s'il est passé)
                if (shipment.convoy && !list.find((c) => c.id === shipment.convoy!.id)) {
                    list.unshift({ id: shipment.convoy.id, date: dateToISO(shipment.convoy.date) });
                }
                setAvailableConvoys(list);
            } catch {
                // silent
            }
        })();
    }, [direction, shipment.convoy]);

    // Formatage téléphone canadien (NE→CA)
    const formatPhoneCA = (value: string) => {
        let digits = value.replace(/\D/g, "");
        if (digits.length === 0) return "";
        if (digits[0] !== "1") digits = "1" + digits;
        digits = digits.substring(0, 11);
        let f = "";
        if (digits.length >= 1) f = "+" + digits[0];
        if (digits.length > 1) f += " (" + digits.substring(1, Math.min(4, digits.length));
        if (digits.length > 4) f += ") " + digits.substring(4, Math.min(7, digits.length));
        if (digits.length > 7) f += "-" + digits.substring(7);
        return f;
    };

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        const payload: Record<string, any> = {
            receiverName: receiverName.trim(),
            receiverEmail: receiverEmail.trim(),
            receiverPhone: phone || null,
            weightKg: weightKg && weightKg.length > 0 ? Number(weightKg) : null,
            notes: notes || null,
            receiverAddress: receiverAddress || null,
            receiverCity: effectiveCity || null,
            receiverPoBox: receiverPoBox || null,
            convoyId: selectedConvoyId || null,
        };

        if (direction === "CA_TO_NE") {
            payload.pickupLastName = pickupLastName.trim() || null;
            payload.pickupFirstName = pickupFirstName.trim() || null;
            payload.pickupQuartier = pickupQuartier.trim() || null;
            payload.pickupPhone = pickupPhone.trim() || null;
        }

        try {
            const res = await fetch(`/dashboard/shipments/${shipment.id}`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
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
            router.refresh();
        } catch (err: any) {
            setMsg(`❌ Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    const dirLabel = direction === "CA_TO_NE" ? "Canada → Niger" : "Niger → Canada";

    return (
        <form onSubmit={onSubmit} className="mt-6 space-y-6 max-w-2xl">
            <h2 className="text-xl font-semibold">
                Modification du colis ({dirLabel})
            </h2>

            {/* Convoi */}
            <div>
                <label htmlFor="convoyId" className="label block mb-1 text-sm font-medium text-neutral-700">
                    Convoi ({direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"}){" "}
                    <span className="text-red-600">*</span>
                </label>
                <select
                    id="convoyId"
                    value={selectedConvoyId}
                    onChange={(e) => setSelectedConvoyId(e.target.value)}
                    required
                    className="input border p-2 w-full rounded bg-white"
                >
                    {availableConvoys.length === 0 && (
                        <option value={selectedConvoyId}>{currentConvoyLabel || "—"}</option>
                    )}
                    {availableConvoys.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.date} ({direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"})
                        </option>
                    ))}
                </select>
            </div>

            {direction === "CA_TO_NE" ? (
                <>
                    {/* Expéditeur au Canada */}
                    <fieldset className="space-y-4 bg-red-50 p-4 rounded-lg border border-red-200">
                        <legend className="label font-semibold text-red-900 px-2 flex items-center gap-2">
                            <img src="/flags/ca.svg" alt="CA" className="w-5 h-3.5 rounded-sm border border-gray-200" />
                            Expéditeur au Canada
                        </legend>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Nom destinataire <span className="text-red-600">*</span>
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    required
                                    value={receiverName}
                                    onChange={(e) => setReceiverName(capitalizeNames(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Email destinataire <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="email"
                                    className="input border p-2 w-full rounded"
                                    required
                                    value={receiverEmail}
                                    onChange={(e) => setReceiverEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Téléphone
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    placeholder="(optionnel)"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Poids (kg)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input border p-2 w-full rounded"
                                    value={weightKg}
                                    onChange={(e) => setWeightKg(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">Adresse</label>
                            <input
                                className="input border p-2 w-full rounded"
                                placeholder="quartier, rue…"
                                value={receiverAddress}
                                onChange={(e) => setReceiverAddress(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">Ville</label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    placeholder="ex: Montréal"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Boîte postale
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    placeholder="(optionnel)"
                                    value={receiverPoBox}
                                    onChange={(e) => setReceiverPoBox(e.target.value)}
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Récupérateur au Niger */}
                    <fieldset className="space-y-4 bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <legend className="label font-semibold text-amber-900 px-2 flex items-center gap-2">
                            <img src="/flags/ne.svg" alt="NE" className="w-5 h-3.5 rounded-sm border border-gray-200" />
                            Récupérateur au Niger
                        </legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Nom <span className="text-red-600">*</span>
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    required
                                    value={pickupLastName}
                                    onChange={(e) => setPickupLastName(capitalizeNames(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Prénoms <span className="text-red-600">*</span>
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    required
                                    value={pickupFirstName}
                                    onChange={(e) => setPickupFirstName(capitalizeNames(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Quartier
                                </label>
                                <input
                                    className="input border p-2 w-full rounded"
                                    placeholder="ex: Banifandou (optionnel)"
                                    value={pickupQuartier}
                                    onChange={(e) => setPickupQuartier(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Téléphone <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="tel"
                                    className="input border p-2 w-full rounded"
                                    placeholder="+227 ..."
                                    required
                                    value={pickupPhone}
                                    onChange={(e) => setPickupPhone(e.target.value)}
                                />
                            </div>
                        </div>
                    </fieldset>
                </>
            ) : (
                <>
                    {/* Destinataire (NE→CA) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                Nom du destinataire <span className="text-red-600">*</span>
                            </label>
                            <input
                                className="input border p-2 w-full rounded"
                                required
                                value={receiverName}
                                onChange={(e) => setReceiverName(capitalizeNames(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                Email destinataire <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="email"
                                className="input border p-2 w-full rounded"
                                required
                                value={receiverEmail}
                                onChange={(e) => setReceiverEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                Téléphone <span className="text-red-600">*</span>
                            </label>
                            <input
                                type="tel"
                                className="input border p-2 w-full rounded"
                                placeholder="+1 (514) 123-4567"
                                required
                                value={phone}
                                onChange={(e) => setPhone(formatPhoneCA(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">Poids (kg)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="input border p-2 w-full rounded"
                                value={weightKg}
                                onChange={(e) => setWeightKg(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Adresse au Canada */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-neutral-800">Adresse au Canada</h3>
                        <div>
                            <label className="label block mb-1 text-sm font-medium text-neutral-700">Adresse</label>
                            <input
                                className="input border p-2 w-full rounded"
                                placeholder="N°, rue…"
                                value={receiverAddress}
                                onChange={(e) => setReceiverAddress(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">
                                    Ville <span className="text-red-600">*</span>
                                </label>
                                <select
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="input border p-2 w-full rounded"
                                    required={!isOther}
                                >
                                    <option value="">-- Sélectionnez une ville --</option>
                                    {CANADIAN_CITIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                    <option value="__other__">Autre ville…</option>
                                </select>
                                {isOther && (
                                    <input
                                        type="text"
                                        placeholder="Ex.: Saint-Georges, Baie-Comeau…"
                                        className="input border p-2 w-full rounded"
                                        value={otherCity}
                                        onChange={(e) => setOtherCity(e.target.value)}
                                        required
                                        minLength={2}
                                    />
                                )}
                            </div>
                            <div>
                                <label className="label block mb-1 text-sm font-medium text-neutral-700">Code postal</label>
                                <input
                                    className="input border p-2 w-full rounded uppercase"
                                    placeholder="ex: A1B 2C3"
                                    maxLength={7}
                                    value={receiverPoBox}
                                    onChange={(e) => setReceiverPoBox(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Notes */}
            <div>
                <label className="label block mb-1 text-sm font-medium text-neutral-700">Notes</label>
                <textarea
                    className="textarea border p-2 w-full rounded"
                    placeholder="(optionnel)"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
                <button
                    disabled={loading}
                    className="bg-black text-white px-4 py-2 rounded disabled:opacity-60 hover:bg-gray-800 transition-colors font-medium"
                >
                    {loading ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
            </div>

            {msg && (
                <div
                    className={`p-3 rounded-lg ${
                        msg.startsWith("✅")
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                    <p className="text-sm font-medium">{msg}</p>
                </div>
            )}
        </form>
    );
}
