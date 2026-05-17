// src/app/track/[trackingId]/page.tsx
import TrackClient from "../TrackClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TrackByIdPage({
    params,
}: {
    params: Promise<{ trackingId: string }>;
}) {
    const { trackingId } = await params;
    return <TrackClient initialTrackingId={trackingId.trim().toUpperCase()} />;
}
