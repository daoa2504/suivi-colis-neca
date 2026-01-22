// src/app/track/page.tsx
import TrackClient from "./TrackClient";

type SP = { trackingId?: string };

export default async function TrackPage({
                                            searchParams,
                                        }: {
    searchParams: Promise<SP>;
}) {
    const sp = await searchParams;
    const initialTrackingId = (sp.trackingId ?? "").trim().toUpperCase();

    return <TrackClient initialTrackingId={initialTrackingId} />;
}
