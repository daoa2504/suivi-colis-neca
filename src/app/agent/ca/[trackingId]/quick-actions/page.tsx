import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import QuickActionsForm from "@/components/QuickActionsForm";

export const runtime = "nodejs";

// Next 15: params est une Promise
export default async function Page({
                                       params,
                                   }: {
    params: Promise<{ trackingId: string }>;
}) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_CA"].includes(role || "")) {
        redirect("/login");
    }

    const { trackingId } = await params;

    return (
        <main className="container-page">
            <div className="card">
                <h1 className="title">Suivi — {trackingId}</h1>
                <QuickActionsForm trackingId={trackingId} />
            </div>
        </main>
    );
}