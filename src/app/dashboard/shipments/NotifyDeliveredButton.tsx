"use client";

import { useState } from "react";

type Props = {
    shipmentId: number;
    receiverName: string;
    receiverEmail: string | null;
    trackingId: string;
    thankYouEmailSent: boolean;
};

export default function NotifyDeliveredButton({
                                                  shipmentId,
                                                  receiverName,
                                                  receiverEmail,
                                                  trackingId,
                                                  thankYouEmailSent: initialEmailSent,
                                              }: Props) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState(receiverEmail ?? "");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState(initialEmailSent);

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
                }),
            });

            const data = res.headers.get("content-type")?.includes("application/json")
                ? await res.json()
                : { ok: false, error: await res.text() };

            if (!res.ok || !data.ok) throw new Error(data.error || "Échec de l'envoi");

            setMsg(`✅ Email envoyé à ${data.customerEmail}`);
            setEmailSent(true);
            setOpen(false);

            // Recharger la page après 1 seconde pour refléter le changement
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    // Si email déjà envoyé (depuis la BD ou localement), bouton désactivé
    const isDisabled = emailSent;

    return (
        <div className="relative">
            <button
                className={`px-2 py-1 text-sm rounded transition-all ${
                    isDisabled
                        ? "bg-gray-200 text-gray-400 cursor-not-allowed opacity-50"
                        : "bg-green-600 text-white hover:bg-green-700"
                }`}
                onClick={() => !isDisabled && setOpen((v) => !v)}
                disabled={isDisabled}
                title={
                    isDisabled
                        ? "Email déjà envoyé"
                        : "Envoyer un email de remerciement"
                }
            >
                {isDisabled ? "✓ Envoyé" : "Remercier"}
            </button>

            {open && !isDisabled && (
                <div className="absolute right-0 z-10 mt-2 w-[320px] rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
                    <div className="mb-2">
                        <div className="text-sm font-semibold">Email de remerciement</div>
                        <div className="text-xs text-neutral-500">
                            {receiverName} — {trackingId}
                        </div>
                    </div>

                    <form onSubmit={onSubmit} className="flex flex-col gap-2">
                        <label className="text-xs text-neutral-600">Email du client</label>
                        <input
                            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                                className="px-3 py-1.5 text-sm rounded bg-neutral-200 hover:bg-neutral-300"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Envoi..." : "Envoyer"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {msg && (
                <p className="mt-1 text-xs text-neutral-600 absolute whitespace-nowrap">
                    {msg}
                </p>
            )}
        </div>
    );
}