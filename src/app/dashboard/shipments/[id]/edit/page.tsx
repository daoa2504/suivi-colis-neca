// src/app/dashboard/shipments/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import EditForm from "./EditForm";

export const runtime = "nodejs";

export default async function EditShipmentPage(
    { params }: { params: Promise<{ id: string }> } // ✅ Next 15 expects a Promise here
) {
    // Resolve the params
    const { id } = await params;

    // AuthZ
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_GN"].includes(role ?? "")) {
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
            receiverCity: true,       // ✅ fixed key
            receiverAddress: true,    // ✅ fixed key
            receiverPoBox: true,      // ✅ fixed key
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