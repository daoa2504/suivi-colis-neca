import QuickActionsForm from "./QuickActionsForm";

export default async function Page(
    { params }: { params: Promise<{ trackingId: string }> } // Next 15: params async
) {
    const { trackingId } = await params;                    // on attend params
    return <QuickActionsForm trackingId={trackingId} />;
}
