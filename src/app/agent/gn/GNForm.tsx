"use client";

import { useState } from "react";

export default function GNForm() {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        const form = e.currentTarget;
        const data = {
            receiverName: form.receiverName.value,
            receiverEmail: form.receiverEmail.value,
            receiverPhone: form.receiverPhone.value,
            originCountry: "Guinée",
            destinationCountry: "Canada",
            convoyDate: form.convoyDate.value,
            weightKg: form.weightKg.value ? parseFloat(form.weightKg.value) : undefined,
            price: form.price.value ? parseFloat(form.price.value) : undefined,
            notes: form.notes.value || undefined,
        };

        try {
            const res = await fetch("/api/shipments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || "Erreur API");

            setMsg(`✅ Colis enregistré (${json.trackingId})`);
            form.reset();
        } catch (err: any) {
            setMsg(`❌ ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3 max-w-lg mx-auto p-6 bg-white rounded-xl shadow"
        >
            <h2 className="text-lg font-semibold">Réception d’un colis (Guinée)</h2>

            <input name="receiverName" placeholder="Nom du destinataire" required className="border p-2 w-full rounded" />
            <input name="receiverEmail" type="email" placeholder="Email destinataire" required className="border p-2 w-full rounded" />
            <input name="receiverPhone" placeholder="Téléphone" className="border p-2 w-full rounded" />
            <input name="convoyDate" type="date" required className="border p-2 w-full rounded" />
            <input name="weightKg" type="number" step="0.01" placeholder="Poids (kg)" className="border p-2 w-full rounded" />
            <input name="price" type="number" step="0.01" placeholder="Prix (optionnel)" className="border p-2 w-full rounded" />
            <textarea name="notes" placeholder="Notes" className="border p-2 w-full rounded" />

            <button
                disabled={loading}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {loading ? "Enregistrement…" : "Enregistrer le colis"}
            </button>

            {msg && <p className="mt-2 text-sm">{msg}</p>}
        </form>
    );
}
