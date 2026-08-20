"use client";

// src/app/food/plainte/ComplaintForm.tsx
// Formulaire public de plainte alimentaire.

import { useState } from "react";

type Cat = "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL" | "QUALITY" | "OTHER" | "NONE";

const CATEGORIES: { value: Cat; label: string; hint: string }[] = [
    { value: "BIOLOGICAL", label: "Danger biologique", hint: "Moisissure, contamination microbienne, mauvaise odeur…" },
    { value: "CHEMICAL", label: "Danger chimique", hint: "Résidus chimiques, allergène non déclaré…" },
    { value: "PHYSICAL", label: "Danger physique", hint: "Corps étranger (verre, métal, plastique, etc.)" },
    { value: "QUALITY", label: "Qualité du produit", hint: "Goût, texture, apparence, date de péremption" },
    { value: "OTHER", label: "Autre problème", hint: "" },
];

export default function ComplaintForm() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [lotNumber, setLotNumber] = useState("");
    const [productDescription, setProductDescription] = useState("");
    const [category, setCategory] = useState<Cat | "">("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [sent, setSent] = useState<{ number: string } | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!category) {
            setMsg("Sélectionnez la nature du problème.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/food/complaints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: "WEBSITE_FORM",
                    clientName: name,
                    clientEmail: email || undefined,
                    clientPhone: phone || undefined,
                    lotNumber: lotNumber || undefined,
                    productDescription: productDescription || undefined,
                    natureCategory: category,
                    natureDescription: description,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            setSent({ number: data.complaintNumber });
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <div className="bg-white p-8 rounded-lg border shadow-sm text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Plainte enregistrée</h2>
                <p className="text-gray-700 mb-4">
                    Votre référence est <strong className="font-mono text-blue-700">{sent.number}</strong>.
                </p>
                <p className="text-sm text-gray-600 mb-6">
                    Nous vous contactons dans les meilleurs délais avec les mesures prises.
                    {email && (
                        <>
                            <br />
                            Un accusé de réception a été envoyé à <strong>{email}</strong>.
                        </>
                    )}
                </p>
                <a
                    href="/"
                    className="inline-block px-6 py-2 bg-gray-800 text-white rounded font-medium hover:bg-gray-900"
                >
                    Retour à l'accueil
                </a>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="bg-white p-6 rounded-lg border shadow-sm space-y-5">
            {/* --- Vos coordonnées --- */}
            <fieldset>
                <legend className="text-sm font-semibold text-gray-800 mb-3">Vos coordonnées</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Votre nom" required>
                        <input
                            type="text"
                            required
                            minLength={2}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input border p-2 w-full rounded"
                            placeholder="Nom complet"
                        />
                    </Field>
                    <Field label="Email">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input border p-2 w-full rounded"
                            placeholder="pour recevoir l'accusé + la réponse"
                        />
                    </Field>
                    <Field label="Téléphone">
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="input border p-2 w-full rounded"
                            placeholder="+1 (514) 000-0000"
                        />
                    </Field>
                    <Field label="Numéro de lot" hint="Trouvable sur l'étiquette du produit (ex : LOT-2026-0001)">
                        <input
                            type="text"
                            value={lotNumber}
                            onChange={(e) => setLotNumber(e.target.value.toUpperCase())}
                            className="input border p-2 w-full rounded font-mono"
                            placeholder="LOT-2026-XXXX (si connu)"
                        />
                    </Field>
                </div>
            </fieldset>

            {/* --- Produit + Nature du problème --- */}
            <fieldset>
                <legend className="text-sm font-semibold text-gray-800 mb-3">Le problème</legend>

                <Field label="Produit concerné" hint="Ex : riz basmati 5 kg, haricots noirs, etc.">
                    <input
                        type="text"
                        value={productDescription}
                        onChange={(e) => setProductDescription(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>

                <div className="mt-3">
                    <span className="block text-sm font-medium text-gray-700 mb-2">
                        Nature du problème <span className="text-red-600">*</span>
                    </span>
                    <div className="space-y-2">
                        {CATEGORIES.map((c) => (
                            <label
                                key={c.value}
                                className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                                    category === c.value
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 hover:border-gray-400"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="category"
                                    value={c.value}
                                    checked={category === c.value}
                                    onChange={() => setCategory(c.value)}
                                    className="mt-0.5"
                                    required
                                />
                                <div>
                                    <div className="font-medium text-gray-900">{c.label}</div>
                                    {c.hint && <div className="text-xs text-gray-600">{c.hint}</div>}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="mt-3">
                    <Field label="Description détaillée" required hint="Soyez précis : date d'achat, symptômes, etc.">
                        <textarea
                            required
                            minLength={10}
                            maxLength={3000}
                            rows={5}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="input border p-2 w-full rounded"
                            placeholder="Décrivez le problème rencontré (min. 10 caractères)"
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                            {description.length} / 3000
                        </div>
                    </Field>
                </div>
            </fieldset>

            {msg && (
                <div className="text-sm p-3 rounded bg-red-100 text-red-800">
                    {msg}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
            >
                {loading ? "Envoi en cours…" : "⚠️ Envoyer la plainte"}
            </button>
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
