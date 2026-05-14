// src/app/dashboard/shipments/[id]/items/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import ItemsManager from "./ItemsManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ShipmentItemsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id)) return notFound();

    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_NE", "AGENT_CA"].includes(role ?? "")) {
        redirect("/login");
    }

    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            paymentStatus: true,
            amountPaid: true,
            items: { orderBy: { createdAt: "asc" } },
        },
    });

    if (!shipment) redirect("/dashboard/shipments");

    return (
        <main className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link
                        href="/dashboard/shipments"
                        className="text-sm text-blue-600 hover:underline"
                    >
                        ← Retour à la liste
                    </Link>
                    <h1 className="text-2xl font-bold mt-2">
                        Colis de {shipment.receiverName}
                    </h1>
                    <p className="text-sm text-gray-600 font-mono">{shipment.trackingId}</p>
                </div>
            </div>

            <ItemsManager
                shipmentId={shipment.id}
                initialItems={shipment.items.map((i) => ({
                    id: i.id,
                    label: i.label,
                    quantity: i.quantity,
                    weightKg: i.weightKg,
                }))}
                initialPayment={{
                    status: shipment.paymentStatus,
                    amountPaid: shipment.amountPaid,
                }}
            />
        </main>
    );
}
