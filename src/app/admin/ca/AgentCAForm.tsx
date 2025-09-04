'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Input from '@/components/ui/Input'

export default function AgentCAForm() {
    const router = useRouter()
    const [t, setT] = useState('')

    function go() {
        const trackingId = t.trim()
        if (!trackingId) return
        router.push(`/admin/ca/${trackingId}/quick-actions`)
    }

    return (
        <main className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
            <h1 className="text-xl font-semibold text-neutral-900">Agent Canada</h1>
            <p className="mt-1 text-sm text-neutral-600">
                Entrez un numéro de suivi pour ouvrir les actions rapides.
            </p>
            <div className="mt-4 flex gap-2">
                <Input
                    value={t}
                    onChange={(e) => setT(e.target.value)}
                    placeholder="Ex: GNC-1234567"
                    className="flex-1"
                />
                <button
                    onClick={go}
                    className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                >
                    Ouvrir
                </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
                Astuce : copiez/collez le tracking depuis la page du colis.
            </p>
        </main>
    )
}
