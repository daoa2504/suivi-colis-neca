"use client";

import { useState } from "react";

type Direction = "NE_TO_CA" | "CA_TO_NE";
type Props = { direction: Direction };

export default function NotifyByConvoyForm({ direction }: Props) {
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [template, setTemplate] = useState<"EN_ROUTE" | "IN_CUSTOMS" | "OUT_FOR_DELIVERY" | "DELIVERED">("EN_ROUTE");
    const [customerEmail, setCustomerEmail] = useState("");

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        const fd = new FormData(e.currentTarget);

        const payload = {
            convoyDate: String(fd.get("convoyDate") || ""),
            template: String(fd.get("template") || "EN_ROUTE"),
            customMessage: (fd.get("customMessage") as string) || "",
            direction,
            // ✅ IMPORTANT: inclure l'email uniquement pour DELIVERED
            customerEmail:
                String(fd.get("template")) === "DELIVERED"
                    ? String(fd.get("customerEmail") || "")
                    : undefined,
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
                `✅ Notifications envoyées : ${data.sent ?? 0}/${data.uniqueRecipients ?? data.shipmentsFound ?? 0}${
                    data.failedCount ? ` — échecs: ${data.failedCount}` : ""
                }`
            );
        } catch (err: any) {
            setMsg(`❌ Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        // ✅ IMPORTANT: brancher l’handler
        <form onSubmit={onSubmit}>
            <div>
                <label className="label">Date du convoi *</label>
                <input type="date" name="convoyDate" className="input" required />
            </div>

            <div>
                <label className="label">Action / Statut *</label>
                <select
                    name="template"
                    className="input"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value as any)}
                    required
                >
                    <option value="EN_ROUTE">En route</option>
                    <option value="IN_CUSTOMS">À la douane</option>
                    <option value="OUT_FOR_DELIVERY">Prêt à être récupéré</option>
                    <option value="DELIVERED">Livré (Remerciement)</option>
                </select>
            </div>

            {/* Champ conditionnel pour DELIVERED */}
            {template === "DELIVERED" && (
                <div>
                    <label className="label">Email du client *</label>
                    <input
                        type="email"
                        name="customerEmail"
                        className="input"
                        placeholder="Ex: client@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                    />
                    <p className="text-sm text-gray-600 mt-1">
                        Entrez l'email du client qui a récupéré son/ses colis
                    </p>
                </div>
            )}

            <div>
                <label className="label">Message (optionnel)</label>
                <textarea
                    name="customMessage"
                    className="input"
                    placeholder="Ex: Détails utiles qui seront ajoutés dans l'email"
                    rows={3}
                />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Envoi en cours..." : "Envoyer les notifications"}
            </button>

            {msg && <p className="mt-2 text-sm">{msg}</p>}
        </form>
    );
}
