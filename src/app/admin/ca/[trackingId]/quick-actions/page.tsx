'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Action = {
    label: string
    type: 'IN_CUSTOMS' | 'PICKED_UP' | 'OUT_FOR_DELIVERY'
    description: string
}

const ACTIONS: Action[] = [
    { label: '📦 À la douane',         type: 'IN_CUSTOMS',       description: 'Colis à la douane (Canada)' },
    { label: '✅ Récupéré par agent',  type: 'PICKED_UP',        description: 'Colis récupéré par un agent Canada' },
    { label: '🚚 Livraison en cours',  type: 'OUT_FOR_DELIVERY', description: 'Colis en cours de livraison vers le client' },
]

export default function QuickActionsForm({ trackingId }: { trackingId: string }) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [msg, setMsg] = useState<string | null>(null)

    async function trigger(action: Action) {
        try {
            setMsg(null)
            setLoading(action.type)
            const res = await fetch(`/api/shipments/${trackingId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: action.type,
                    description: action.description,
                    location: 'Canada',
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) throw new Error(data?.error || 'Erreur API')
            setMsg(`✅ ${action.label} enregistré (eventId: ${data.eventId})`)
        } catch (e: unknown) {
            if (e instanceof Error) {
                setMsg(`Erreur: ${e.message}`)
            } else {
                setMsg("Erreur inconnue")
            }

        } finally {
            setLoading(null)
        }
    }

    return (
        <main className="min-h-screen w-full bg-neutral-50 p-6">
            <div className="mx-auto w-full max-w-4xl">
                <h1 className="text-2xl font-bold text-neutral-900">
                    Actions rapides — Agent Canada
                </h1>
                <p className="mt-1 text-sm text-neutral-700">
                    Tracking:&nbsp;
                    <span className="font-semibold text-neutral-900">{trackingId}</span>
                </p>

                <div className="mt-6 grid w-full grid-cols-1 gap-4">
                    {ACTIONS.map((a) => (
                        <button
                            key={a.type}
                            onClick={() => trigger(a)}
                            disabled={loading === a.type}
                            className="w-full rounded-2xl bg-white px-5 py-4 text-left text-base font-semibold text-neutral-900 shadow-md ring-1 ring-neutral-200 transition hover:bg-neutral-100 active:translate-y-px disabled:opacity-70"
                        >
                            {loading === a.type ? '… envoi en cours' : a.label}
                        </button>
                    ))}
                </div>

                {msg && (
                    <div
                        className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${
                            msg.startsWith('✅')
                                ? 'bg-green-100 text-green-900 ring-1 ring-green-300'
                                : 'bg-red-100 text-red-900 ring-1 ring-red-300'
                        }`}
                    >
                        {msg}
                    </div>
                )}

                <div className="mt-6">
                    <button
                        onClick={() => router.push(`/shipments/${trackingId}`)}
                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-neutral-800"
                    >
                        Ouvrir la page publique de suivi
                    </button>
                </div>
            </div>
        </main>
    )
}
