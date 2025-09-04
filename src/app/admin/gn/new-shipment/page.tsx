import NewShipmentForm from '@/components/forms/NewShipmentForm'

export default function NewShipmentPage() {
    return (
        <main className="space-y-6">
            <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
                <h1 className="text-xl font-semibold text-neutral-900">Agent Guinée — Nouveau colis</h1>
                <p className="mt-1 text-sm text-neutral-600">Renseignez les informations du destinataire.</p>
                <div className="mt-4">
                    <NewShipmentForm />
                </div>
            </section>
        </main>
    )
}
