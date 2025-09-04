import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function ShipmentPage(
    { params }: { params: { trackingId: string } }
) {
    const { trackingId } = params;

    // 1) On prépare la requête (pour pouvoir en extraire le type)
    const q = prisma.shipment.findUnique({
        where: { trackingId },
        include: { events: { orderBy: { occurredAt: "desc" } } },
    });

    // 2) On dérive les types à partir de la requête
    type ShipmentWithEvents = NonNullable<Awaited<typeof q>>;
    type EventItem = ShipmentWithEvents["events"][number];

    // 3) On exécute la requête
    const shipment = await q;

    if (!shipment) {
        return (
            <main className="min-h-screen w-full bg-neutral-50 p-6">
                <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
                    <h1 className="text-2xl font-bold text-neutral-900">Colis introuvable</h1>
                    <p className="mt-2 text-sm text-neutral-700">
                        Vérifiez le numéro de suivi et réessayez.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen w-full bg-neutral-50 p-6">
            <div className="mx-auto max-w-4xl space-y-6">
                <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Suivi — {shipment.trackingId}
                    </h1>
                    <p className="mt-2 text-sm text-neutral-700">
                        Destinataire : <b className="text-neutral-900">{shipment.receiverName}</b>
                    </p>
                    <p className="text-sm text-neutral-700">
                        Statut actuel : <b className="text-neutral-900">{shipment.status}</b>
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                        Origine : {shipment.originCountry} • Destination : {shipment.destinationCountry}
                    </p>
                </section>

                <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
                    <h2 className="text-lg font-semibold text-neutral-900">Historique</h2>
                    {shipment.events.length === 0 ? (
                        <p className="mt-2 text-sm text-neutral-600">Aucun événement pour le moment.</p>
                    ) : (
                        <ol className="mt-4 relative ml-2 border-l border-neutral-200">
                            {shipment.events.map((e: EventItem) => (
                                <li key={e.id} className="mb-6 ml-4">
                                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-black" />
                                    <time className="mb-1 block text-xs text-neutral-500">
                                        {e.occurredAt
                                            ? formatDate(
                                                typeof e.occurredAt === "string"
                                                    ? e.occurredAt
                                                    : e.occurredAt.toISOString()
                                            )
                                            : "—"}
                                    </time>
                                    <h4 className="text-sm font-semibold">{LABELS[e.type] ?? e.type}</h4>
                                    {e.description && (
                                        <p className="text-sm text-neutral-700">{e.description}</p>
                                    )}
                                    {e.location && (
                                        <p className="text-xs text-neutral-500">📍 {e.location}</p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                <section className="rounded-2xl bg-white p-6 ring-1 ring-neutral-200 shadow">
                    <h3 className="text-base font-semibold text-neutral-900">Espace agents</h3>
                    <div className="mt-3 flex flex-wrap gap-3">
                        <a
                            href={`/admin/ca/${shipment.trackingId}/quick-actions`}
                            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-neutral-800"
                        >
                            Ouvrir les actions rapides (Canada)
                        </a>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                        (L’accès pourra être restreint aux agents authentifiés plus tard.)
                    </p>
                </section>
            </div>
        </main>
    );
}

const LABELS: Record<string, string> = {
    RECEIVED_IN_GUINEA: "Reçu en Guinée",
    IN_TRANSIT: "En transit",
    IN_CUSTOMS: "À la douane",
    ARRIVED_IN_CANADA: "Arrivé au Canada",
    PICKED_UP: "Récupéré par agent Canada",
    OUT_FOR_DELIVERY: "En cours de livraison",
    DELIVERED: "Livré",
    CUSTOM: "Mise à jour",
};
