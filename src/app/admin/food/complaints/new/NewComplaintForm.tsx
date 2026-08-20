"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; customerCode: string; name: string; email: string | null; phone: string | null };
type Lot = { id: string; lotNumber: string; description: string };

const CHANNELS = [
    { value: "PHONE", label: "Téléphone" },
    { value: "EMAIL", label: "Email" },
    { value: "IN_PERSON", label: "En personne" },
    { value: "MAIL", label: "Courrier postal" },
    { value: "OTHER", label: "Autre" },
] as const;

const CATEGORIES = [
    { value: "BIOLOGICAL", label: "Danger biologique" },
    { value: "CHEMICAL", label: "Danger chimique" },
    { value: "PHYSICAL", label: "Danger physique" },
    { value: "QUALITY", label: "Qualité" },
    { value: "OTHER", label: "Autre" },
] as const;

const RISKS = [
    { value: "HIGH", label: "Élevé" },
    { value: "MEDIUM", label: "Moyen" },
    { value: "LOW", label: "Faible" },
    { value: "NONE", label: "Aucun" },
] as const;

export default function NewComplaintForm({ clients, lots }: { clients: Client[]; lots: Lot[] }) {
    const router = useRouter();
    const [channel, setChannel] = useState<typeof CHANNELS[number]["value"]>("PHONE");
    const [clientId, setClientId] = useState("");
    const [clientName, setClientName] = useState("");
    const [clientEmail, setClientEmail] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [lotId, setLotId] = useState("");
    const [lotNumber, setLotNumber] = useState("");
    const [productDescription, setProductDescription] = useState("");
    const [category, setCategory] = useState<typeof CATEGORIES[number]["value"] | "">("");
    const [description, setDescription] = useState("");
    const [risk, setRisk] = useState<typeof RISKS[number]["value"]>("MEDIUM");
    const [isHealthRisk, setIsHealthRisk] = useState(false);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    function pickClient(id: string) {
        setClientId(id);
        const c = clients.find((x) => x.id === id);
        if (c) {
            setClientName(c.name);
            setClientEmail(c.email ?? "");
            setClientPhone(c.phone ?? "");
        }
    }

    function pickLot(id: string) {
        setLotId(id);
        const l = lots.find((x) => x.id === id);
        if (l) {
            setLotNumber(l.lotNumber);
            if (!productDescription) setProductDescription(l.description);
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!category) {
            setMsg("Sélectionnez la nature du problème");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/food/complaints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel,
                    clientId: clientId || undefined,
                    clientName,
                    clientEmail: clientEmail || undefined,
                    clientPhone: clientPhone || undefined,
                    lotId: lotId || undefined,
                    lotNumber: lotNumber || undefined,
                    productDescription: productDescription || undefined,
                    natureCategory: category,
                    natureDescription: description,
                    riskLevel: risk,
                    isHealthRisk,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            router.push(`/admin/food/complaints/${data.id}`);
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="bg-white p-6 rounded-lg border shadow-sm space-y-5">
            {/* Canal + Client */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Canal de réception" required>
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as any)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        {CHANNELS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Client existant (facultatif)" hint="Sélectionner pour pré-remplir">
                    <select
                        value={clientId}
                        onChange={(e) => pickClient(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">-- Nouveau / hors base --</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.customerCode} — {c.name}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nom du client" required>
                    <input
                        type="text"
                        required
                        minLength={2}
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Email">
                    <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Téléphone">
                    <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
            </div>

            <hr />

            {/* Lot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Lot concerné" hint="Sélectionner OU saisir manuellement le n°">
                    <select
                        value={lotId}
                        onChange={(e) => pickLot(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">-- Choisir un lot --</option>
                        {lots.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.lotNumber} — {l.description.slice(0, 40)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Ou n° de lot (saisie manuelle)">
                    <input
                        type="text"
                        value={lotNumber}
                        onChange={(e) => {
                            setLotId("");
                            setLotNumber(e.target.value.toUpperCase());
                        }}
                        className="input border p-2 w-full rounded font-mono"
                        placeholder="LOT-2026-XXXX"
                    />
                </Field>
            </div>

            <Field label="Produit concerné">
                <input
                    type="text"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    className="input border p-2 w-full rounded"
                />
            </Field>

            <hr />

            {/* Nature */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Catégorie du problème" required>
                    <select
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">-- Sélectionner --</option>
                        {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Niveau de risque">
                    <select
                        value={risk}
                        onChange={(e) => setRisk(e.target.value as any)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        {RISKS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={isHealthRisk}
                    onChange={(e) => setIsHealthRisk(e.target.checked)}
                />
                Risque pour la santé (déclenche notification ACIA potentielle)
            </label>

            <Field label="Description détaillée" required>
                <textarea
                    required
                    minLength={10}
                    maxLength={3000}
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input border p-2 w-full rounded"
                />
            </Field>

            {msg && (
                <div className="text-sm p-3 rounded bg-red-100 text-red-800">{msg}</div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-red-600 text-white px-6 py-2 rounded font-medium hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? "Création…" : "Créer la plainte"}
                </button>
            </div>
        </form>
    );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </span>
            {children}
            {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
        </label>
    );
}
