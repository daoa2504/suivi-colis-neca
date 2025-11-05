// src/app/dashboard/shipments/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import EditForm from "./EditForm";

export const runtime = "nodejs";
// (optionnel) pour éviter du cache si besoin
export const dynamic = "force-dynamic";

// ✅ En Next 15 (PPR), `params` est un Promise
export default async function EditShipmentPage({
                                                   params,
                                               }: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;   // ← on "await" params
    const id = Number(idStr);
    if (!Number.isInteger(id)) return notFound();

    // AuthZ
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_NE"].includes(role ?? "")) {
        redirect("/login");
    }

    // Fetch shipment
    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            receiverPhone: true,
            weightKg: true,
            receiverCity: true,
            receiverAddress: true,
            receiverPoBox: true,
            notes: true,
        },
    });

    if (!shipment) {
        redirect("/dashboard/shipments");
    }

    return (
        <main className="container-page">
            <div className="card">
                <h1 className="title">Modifier — {shipment.trackingId}</h1>
                <EditForm shipment={shipment} />
            </div>
        </main>
    );
}
