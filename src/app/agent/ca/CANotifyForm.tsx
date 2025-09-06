"use client";

import { useState } from "react";

export default function CANotifyForm() {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        const form = e.currentTarget;
        const data = {
            convoyDate: form.convoyDate.value,
            template: form.template.value,
            customMessage: form.customMessage.value || undefined,
        };

        try {
            const res = await fetch("/api/convoys/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || "Erreur API");

            setMsg(`✅ Emails envoyés (${json.sent})`);
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
            <h2 className="text-lg font-semibold">Notifier un convoi (Canada)</h2>

            <input name="convoyDate" type="date" required className="border p-2 w-full rounded" />

            <select name="template" required className="border p-2 w-full rounded">
                <option value="EN_ROUTE">Convoi en route</option>
                <option value="ARRIVED_CUSTOMS_CA">Arrivé à la douane (Canada)</option>
            </select>

            <textarea name="customMessage" placeholder="Message personnalisé (optionnel)" className="border p-2 w-full rounded" />

            <button
                disabled={loading}
                className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
                {loading ? "Envoi…" : "Envoyer les emails"}
            </button>

            {msg && <p className="mt-2 text-sm">{msg}</p>}
        </form>
    );
}
