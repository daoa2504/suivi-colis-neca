// src/app/agent/ca/notify/NotifyByConvoyForm.tsx
"use client";

import { useState } from "react";

type Direction = "NE_TO_CA" | "CA_TO_NE";
type Props = { direction: Direction };

export default function NotifyByConvoyForm({ direction }: Props) {
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        const fd = new FormData(e.currentTarget);
        const payload = {
            convoyDate: String(fd.get("convoyDate") || ""),
            template: String(fd.get("template") || "EN_ROUTE"), // action
            customMessage: (fd.get("customMessage") as string) || "",
            direction, // 👈 pour que l’API ajuste le libellé dans le bon sens
        };

        try {
            const res = await fetch("/api/convoys/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });

            const data = res.headers.get("content-type")?.includes("application/json")
                ? await res.json()
                : { ok: false, error: await res.text() };

            if (!res.ok || !data.ok) throw new Error(data.error || "Échec de l’envoi");
            setMsg(
                `✅ Notifications envoyées : ${data.sent}/${data.totalRecipients}${
                    data.failedCount ? ` — échecs: ${data.failedCount}` : ""
                }`
            );
        } catch (err: any) {
            setMsg(`Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-4 grid gap-4 max-w-xl">
            <div>
                <label className="label">Date du convoi *</label>
                <input name="convoyDate" type="date" required className="input" />
            </div>

            <div>
                <label className="label">Action / Statut *</label>
                <select name="template" className="input" defaultValue="EN_ROUTE" required>
                    <option value="EN_ROUTE">En route</option>
                    <option value="IN_CUSTOMS">À la douane</option>
                    <option value="OUT_FOR_DELIVERY">Prêt à être livré</option>
                    <option value="DELIVERED">Livré</option>
                </select>
            </div>

            <div>
                <label className="label">Message (optionnel)</label>
                <textarea
                    name="customMessage"
                    className="textarea"
                    placeholder="Ex: Détails utiles qui seront ajoutés dans l’email"
                />
            </div>

            <div className="flex items-center gap-3">
                <button className="btn-primary" disabled={loading}>
                    {loading ? "Envoi…" : "Envoyer les notifications"}
                </button>
                {msg && <p className="text-sm">{msg}</p>}
            </div>
        </form>
    );
}