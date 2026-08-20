"use client";

// src/components/ClientSupportForms.tsx
//
// Deux formulaires client-facing sur la page de suivi publique :
//   1. Signaler un problème (plainte)
//   2. Demander un rappel téléphonique
//
// Les 2 sont dépliables (accordéon) et masqués par défaut pour ne pas
// alourdir la page. Le colis (trackingId) est pré-rempli.
// Envoie vers /api/track/[trackingId]/claim et /callback.

import { useState } from "react";

interface Props {
    trackingId: string;
    /** Pré-remplissage suggéré (nom du destinataire depuis le colis). */
    suggestedName?: string;
    suggestedEmail?: string;
    suggestedPhone?: string;
}

type ClaimType = "DAMAGED" | "MISSING" | "LATE" | "WRONG_ITEM" | "BILLING" | "OTHER";
type CallbackReason = "DELIVERY_INFO" | "PAYMENT" | "ADDRESS_CHANGE" | "URGENT" | "OTHER";

const CLAIM_TYPES: { value: ClaimType; label: string }[] = [
    { value: "DAMAGED", label: "Colis endommagé" },
    { value: "MISSING", label: "Colis perdu / non reçu" },
    { value: "LATE", label: "Retard important" },
    { value: "WRONG_ITEM", label: "Mauvais contenu" },
    { value: "BILLING", label: "Problème de facturation" },
    { value: "OTHER", label: "Autre" },
];

const CALLBACK_REASONS: { value: CallbackReason; label: string }[] = [
    { value: "DELIVERY_INFO", label: "Question sur la livraison" },
    { value: "PAYMENT", label: "Question sur le paiement / la facture" },
    { value: "ADDRESS_CHANGE", label: "Modification de l'adresse" },
    { value: "URGENT", label: "Urgent" },
    { value: "OTHER", label: "Autre" },
];

export default function ClientSupportForms({
    trackingId,
    suggestedName,
    suggestedEmail,
    suggestedPhone,
}: Props) {
    const [openTab, setOpenTab] = useState<"none" | "claim" | "callback">("none");

    return (
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <header className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                    Un problème ou une question ?
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                    Choisissez comment nous contacter pour ce colis <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{trackingId}</code>
                </p>
            </header>

            {/* Toggles — les 2 boutons séparent visuellement les 2 formulaires */}
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                <button
                    type="button"
                    onClick={() => setOpenTab(openTab === "claim" ? "none" : "claim")}
                    className={`p-4 text-left transition-colors ${
                        openTab === "claim" ? "bg-red-50" : "hover:bg-gray-50"
                    }`}
                    aria-expanded={openTab === "claim"}
                >
                    <div className="flex items-center gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div>
                            <div className="font-semibold text-gray-900">Signaler un problème</div>
                            <div className="text-xs text-gray-600">Colis endommagé, retard, erreur…</div>
                        </div>
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => setOpenTab(openTab === "callback" ? "none" : "callback")}
                    className={`p-4 text-left transition-colors ${
                        openTab === "callback" ? "bg-emerald-50" : "hover:bg-gray-50"
                    }`}
                    aria-expanded={openTab === "callback"}
                >
                    <div className="flex items-center gap-3">
                        <div className="text-2xl">📞</div>
                        <div>
                            <div className="font-semibold text-gray-900">Demander un rappel</div>
                            <div className="text-xs text-gray-600">Un agent NIMAPLEX vous rappellera</div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Formulaires (séparés — un seul ouvert à la fois) */}
            {openTab === "claim" && (
                <div className="p-5 bg-red-50/40 border-t border-red-100">
                    <ClaimForm
                        trackingId={trackingId}
                        suggestedName={suggestedName}
                        suggestedEmail={suggestedEmail}
                        suggestedPhone={suggestedPhone}
                        onClose={() => setOpenTab("none")}
                    />
                </div>
            )}
            {openTab === "callback" && (
                <div className="p-5 bg-emerald-50/40 border-t border-emerald-100">
                    <CallbackForm
                        trackingId={trackingId}
                        suggestedName={suggestedName}
                        suggestedEmail={suggestedEmail}
                        suggestedPhone={suggestedPhone}
                        onClose={() => setOpenTab("none")}
                    />
                </div>
            )}
        </section>
    );
}

// ============================================================================
// Formulaire Plainte
// ============================================================================

function ClaimForm({
    trackingId,
    suggestedName,
    suggestedEmail,
    suggestedPhone,
    onClose,
}: {
    trackingId: string;
    suggestedName?: string;
    suggestedEmail?: string;
    suggestedPhone?: string;
    onClose: () => void;
}) {
    const [name, setName] = useState(suggestedName ?? "");
    const [email, setEmail] = useState(suggestedEmail ?? "");
    const [phone, setPhone] = useState(suggestedPhone ?? "");
    const [type, setType] = useState<ClaimType | "">("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!type) {
            setMsg("Sélectionnez la nature de la plainte.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/track/${encodeURIComponent(trackingId)}/claim`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName: name,
                    clientEmail: email,
                    clientPhone: phone || undefined,
                    type,
                    description,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            setSent(true);
            setMsg("✅ Plainte enregistrée. Nous vous contacterons rapidement.");
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <div className="text-center py-6">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-gray-800 font-medium">Plainte enregistrée.</p>
                <p className="text-sm text-gray-600 mt-1">Nous vous contactons dans les meilleurs délais.</p>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 text-sm text-gray-600 hover:underline"
                >
                    Fermer
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Votre nom" required>
                    <input
                        type="text"
                        required
                        minLength={2}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom complet"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Votre email" required>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ex: nom@exemple.com"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Téléphone (facultatif)">
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (514) 000-0000"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Nature de la plainte" required>
                    <select
                        required
                        value={type}
                        onChange={(e) => setType(e.target.value as ClaimType)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">-- Sélectionner --</option>
                        {CLAIM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </Field>
            </div>

            <Field label="Description du problème" required>
                <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décrivez le problème (min. 10 caractères)"
                    rows={4}
                    className="input border p-2 w-full rounded"
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                    {description.length} / 2000
                </div>
            </Field>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? "Envoi…" : "Enregistrer la plainte"}
                </button>
            </div>
        </form>
    );
}

// ============================================================================
// Formulaire Rappel
// ============================================================================

function CallbackForm({
    trackingId,
    suggestedName,
    suggestedEmail,
    suggestedPhone,
    onClose,
}: {
    trackingId: string;
    suggestedName?: string;
    suggestedEmail?: string;
    suggestedPhone?: string;
    onClose: () => void;
}) {
    const [name, setName] = useState(suggestedName ?? "");
    const [phone, setPhone] = useState(suggestedPhone ?? "");
    const [email, setEmail] = useState(suggestedEmail ?? "");
    const [reason, setReason] = useState<CallbackReason | "">("");
    const [preferredTime, setPreferredTime] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!reason) {
            setMsg("Sélectionnez le motif du rappel.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/track/${encodeURIComponent(trackingId)}/callback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName: name,
                    clientPhone: phone,
                    clientEmail: email || undefined,
                    reason,
                    preferredTime: preferredTime || undefined,
                    message: message || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            setSent(true);
            setMsg("✅ Demande envoyée. Un agent NIMAPLEX vous rappellera.");
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <div className="text-center py-6">
                <div className="text-4xl mb-2">📞</div>
                <p className="text-gray-800 font-medium">Demande envoyée.</p>
                <p className="text-sm text-gray-600 mt-1">Un agent NIMAPLEX vous rappellera au plus vite.</p>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 text-sm text-gray-600 hover:underline"
                >
                    Fermer
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Votre nom" required>
                    <input
                        type="text"
                        required
                        minLength={2}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nom complet"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Téléphone à rappeler" required>
                    <input
                        type="tel"
                        required
                        minLength={6}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (514) 000-0000"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Email (facultatif)">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ex: nom@exemple.com"
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Motif" required>
                    <select
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value as CallbackReason)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">-- Sélectionner --</option>
                        {CALLBACK_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Créneau préféré (facultatif)">
                    <select
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">Peu importe</option>
                        <option value="matin">Matin</option>
                        <option value="après-midi">Après-midi</option>
                        <option value="soir">Soir</option>
                    </select>
                </Field>
            </div>

            <Field label="Message pour l'agent (facultatif)">
                <textarea
                    maxLength={1000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Précisions utiles avant le rappel…"
                    rows={3}
                    className="input border p-2 w-full rounded"
                />
                <div className="text-xs text-gray-500 mt-1 text-right">
                    {message.length} / 1000
                </div>
            </Field>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                    {loading ? "Envoi…" : "Demander à être rappelé"}
                </button>
            </div>
        </form>
    );
}

// ============================================================================
// Helper : label + child input
// ============================================================================

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </span>
            {children}
        </label>
    );
}
