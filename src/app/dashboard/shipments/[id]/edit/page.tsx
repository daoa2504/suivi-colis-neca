import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EditForm from "./EditForm";

export const runtime = "nodejs";

export default async function EditShipmentPage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_GN"].includes(session.user.role)) {
        redirect("/login");
    }

    const shipment = await prisma.shipment.findUnique({
        where: { id: params.id },
        select: {
            id: true, trackingId: true, receiverName: true, receiverEmail: true,
            receiverPhone: true, weightKg: true, price: true, notes: true,
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