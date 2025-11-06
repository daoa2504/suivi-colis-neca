// src/app/dashboard/shipments/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import EditForm from "./EditForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // optionnel

export default async function EditShipmentPage({
                                                   params,
                                               }: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id)) return notFound();

    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_NE"].includes(role ?? "")) {
        redirect("/login");
    }

    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            receiverPhone: true,
            weightKg: true,
            receiverAddress: true,
            receiverCity: true,
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
                <h1 className="title">Modifier — {shipment!.trackingId}</h1>
                <EditForm shipment={shipment!} />
            </div>
        </main>
    );
}
