'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createShipmentSchema } from '@/lib/validators'
import Input from '@/components/ui/Input'

type FormValues = z.infer<typeof createShipmentSchema>

export default function NewShipmentForm() {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(createShipmentSchema),
        defaultValues: {
            originCountry: 'Guinea',
            destinationCountry: 'Canada',
            initialStatus: 'RECEIVED_IN_GUINEA',
        },
    })

    async function onSubmit(values: FormValues) {
        const res = await fetch('/api/shipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) {
            alert(data?.error ? JSON.stringify(data.error) : 'Erreur lors de la création')
            return
        }
        alert(`Colis créé ✅\nTracking: ${data.trackingId}`)
        reset()
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <label className="mb-1 block text-sm text-neutral-700">Nom de l’expéditeur (Guinée)</label>
                <Input {...register('senderName')} placeholder="Ex: Mamadou Sow" />
                {errors.senderName && (
                    <p className="mt-1 text-xs text-red-600">{errors.senderName.message}</p>
                )}
            </div>

            <div>
                <label className="mb-1 block text-sm text-neutral-700">Nom du destinataire (Canada)</label>
                <Input {...register('receiverName')} placeholder="Ex: Alice Tremblay" />
                {errors.receiverName && (
                    <p className="mt-1 text-xs text-red-600">{errors.receiverName.message}</p>
                )}
            </div>

            <div>
                <label className="mb-1 block text-sm text-neutral-700">Email du destinataire</label>
                <Input type="email" {...register('receiverEmail')} placeholder="destinataire@email.com" />
                {errors.receiverEmail && (
                    <p className="mt-1 text-xs text-red-600">{errors.receiverEmail.message}</p>
                )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm text-neutral-700">Pays d’origine</label>
                    <Input {...register('originCountry')} />
                </div>
                <div>
                    <label className="mb-1 block text-sm text-neutral-700">Pays de destination</label>
                    <Input {...register('destinationCountry')} />
                </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-neutral-800 disabled:opacity-60"
            >
                {isSubmitting ? 'Création…' : 'Créer + envoyer email'}
            </button>
        </form>
    )
}
