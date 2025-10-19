"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Action = {
    label: string;
    type:
        | "RECEIVED_IN_NIGER"
        | "RECEIVED_IN_CANADA"
        | "IN_TRANSIT"
        | "IN_CUSTOMS"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED"
        | "CUSTOM";
    description: string;
    location?: string; // ex: "Guinée" / "Canada"
};

export default function QuickActions({
                                         trackingId,
                                         actions,
                                         title,
                                         defaultLocation,
                                     }: {
    trackingId: string;
    actions: Action[];
    title: string;
    defaultLocation?: string;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function trigger(a: Action) {
        try {
            setMsg(null);
            setLoading(a.type);

            const res = await fetch(`/api/shipments/${trackingId}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    type: a.type,
                    description: a.description,
                    location: a.location ?? defaultLocation ?? undefined,
                }),
            });

            const data = res.headers.get("content-type")?.includes("application/json")
                ? await res.json()
                : { ok: false, error: await res.text() };

            if (!res.ok || !data.ok) throw new Error((data as any)?.error || "Erreur API");

            setMsg(`✅ ${a.label} enregistré (eventId: ${data.eventId})`);
            router.refresh();
        } catch (e: any) {
            setMsg(`Erreur: ${e?.message || "inconnue"}`);
        } finally {
            setLoading(null);
        }
    }

    return (
        <main className="min-h-screen w-full bg-neutral-50 p-6">
            <div className="mx-auto w-full max-w-4xl">
                <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
                <p className="mt-1 text-sm text-neutral-700">
                    Tracking : <span className="font-semibold text-neutral-900">{trackingId}</span>
                </p>

                <div className="mt-6 grid w-full grid-cols-1 gap-4">
                    {actions.map((a) => (
                        <button
                            key={a.type}
                            onClick={() => trigger(a)}
                            disabled={loading === a.type}
                            className="w-full rounded-2xl bg-white px-5 py-4 text-left text-base font-semibold text-neutral-900 shadow-md ring-1 ring-neutral-200 transition hover:bg-neutral-100 active:translate-y-px disabled:opacity-70"
                        >
                            {loading === a.type ? "… envoi en cours" : a.label}
                        </button>
                    ))}
                </div>

                {msg && (
                    <div
                        className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                            msg.startsWith("✅")
                                ? "bg-green-100 text-green-900 ring-1 ring-green-300"
                                : "bg-red-100 text-red-900 ring-1 ring-red-300"
                        }`}
                    >
                        {msg}
                    </div>
                )}
            </div>
        </main>
    );
}