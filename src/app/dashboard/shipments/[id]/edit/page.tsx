// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "AGENT_NE"].includes(session.user?.role ?? "")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shipmentId = Number(id);

    if (!Number.isInteger(shipmentId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    try {
        const body = await request.json();

        const updated = await prisma.shipment.update({
            where: { id: shipmentId },
            data: {
                receiverName: body.receiverName,
                receiverEmail: body.receiverEmail,
                receiverPhone: body.receiverPhone,
                weightKg: body.weightKg,
                receiverAddress: body.receiverAddress,
                receiverCity: body.receiverCity,
                receiverPoBox: body.receiverPoBox,
                notes: body.notes,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating shipment:", error);
        return NextResponse.json(
            { error: "Failed to update shipment" },
            { status: 500 }
        );
    }
}