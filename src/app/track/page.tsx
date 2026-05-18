// src/app/track/page.tsx
import TrackClient from "./TrackClient";
import type { Metadata } from "next";

type SP = { trackingId?: string };

export const metadata: Metadata = {
    title: "Suivi de votre colis — NIMAPLEX",
    description:
        "Suivez en direct l'état de votre colis Niger ↔ Canada. Entrez votre numéro de suivi pour connaître l'étape actuelle, la date de récupération prévue et la position de votre envoi.",
    openGraph: {
        title: "Suivi de votre colis — NIMAPLEX",
        description:
            "Suivez en direct l'état de votre colis Niger ↔ Canada. Plus qu'une solution, un service d'excellence globale.",
        type: "website",
        locale: "fr_CA",
    },
    alternates: {
        canonical: "/track",
    },
};

export default async function TrackPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<SP>;
}) {
    const sp = await searchParams;
    const initialTrackingId = (sp.trackingId ?? "").trim().toUpperCase();

    return <TrackClient initialTrackingId={initialTrackingId} />;
}
