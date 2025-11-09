"use client";

import { useState } from "react";

type Props = {
    shipmentId: number;
    receiverName: string;
    receiverEmail: string | null;
    trackingId: string;
};

export default function NotifyDeliveredButton({
                                                  shipmentId,
                                                  receiverName,
                                                  receiverEmail,
                                                  trackingId,
                                              }: Props) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState(receiverEmail ?? "");
    const [message, setMessage] = useState("Bonne réception 📦😊");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);
        try {
            const res = await fetch("/api/shipments/notify-delivered", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    shipmentId,
                    customerEmail: email,
                    // Si tu veux ajouter `customMessage` au template côté API plus tard, ajoute-le ici.
                    // customMessage: message,
                }),
            });

            const data = res.headers.get("content-type")?.includes("application/json")
                ? await res.json()
                : { ok: false, error: await res.text() };

            if (!res.ok || !data.ok) throw new Error(data.error || "Échec de l’envoi");
            setMsg(`✅ Email envoyé à ${data.customerEmail} — ${data.trackingId}`);
            setOpen(false);
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative">
            <button
                className="px-2 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => setOpen((v) => !v)}
                title="Envoyer un email de remerciement (DELIVERED)"
            >
                Remercier
            </button>

            {open && (
                <div className="absolute right-0 z-10 mt-2 w-[320px] rounded-xl border border-neutral-200 bg-white p-4 shadow">
                    <div className="mb-2">
                        <div className="text-sm font-semibold">Email de remerciement</div>
                        <div className="text-xs text-neutral-500">
                            {receiverName} — {trackingId}
                        </div>
                    </div>

                    <form onSubmit={onSubmit} className="flex flex-col gap-2">
                        <label className="text-xs text-neutral-600">Email du client</label>
                        <input
                            className="input"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="client@example.com"
                        />



                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-2 py-1 text-sm rounded bg-neutral-200 hover:bg-neutral-300"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-2 py-1 text-sm rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                            >
                                {loading ? "Envoi..." : "Envoyer"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {msg && <p className="mt-1 text-xs text-neutral-600">{msg}</p>}
        </div>
    );
}
