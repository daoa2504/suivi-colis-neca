// src/app/dashboard/shipments/[id]/edit/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {notFound, redirect} from "next/navigation";
import EditForm from "./EditForm";

export const runtime = "nodejs";

export default async function EditShipmentPage({
                                                   params,
                                               }: { params: { id: string } }) {
    const id = Number(params.id);
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