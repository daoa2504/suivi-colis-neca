// src/app/api/shipments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// DELETE /api/shipments/[id] — ADMIN uniquement
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const { id } = await params;
        const shipmentId = parseInt(id, 10);

        if (isNaN(shipmentId)) {
            return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 });
        }

        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            select: { id: true, trackingId: true },
        });

        if (!shipment) {
            return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
        }

        // Les ShipmentEvent seront supprimés en cascade (schema.prisma)
        await prisma.shipment.delete({ where: { id: shipmentId } });

        return NextResponse.json({
            ok: true,
            deletedId: shipment.id,
            trackingId: shipment.trackingId,
        });
    } catch (e: any) {
        console.error("DELETE /api/shipments/[id] error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Erreur lors de la suppression" },
            { status: 500 }
        );
    }
}
