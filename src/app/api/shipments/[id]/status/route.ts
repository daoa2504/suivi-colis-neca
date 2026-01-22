// src/app/api/shipments/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { status, currentLocation } = await req.json();
        const shipmentId = parseInt(params.id);

        const shipment = await prisma.shipment.update({
            where: { id: shipmentId },
            data: {
                status,
                currentLocation,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true, shipment });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}