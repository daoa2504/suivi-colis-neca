// app/admin/ca/[trackingId]/quick-actions/page.tsx
import QuickActionsForm from "./QuickActionsForm";

export default function Page(
    { params }: { params: { trackingId: string } }
) {
    return <QuickActionsForm trackingId={params.trackingId} />;
}
