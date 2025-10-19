// src/app/api/shipments/[trackingId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/shipments/:trackingId
export async function GET(
    _req: NextRequest,
    { params }: { params: { trackingId: string } }
) {
    const { trackingId } = await params;

    // récupère le colis + ses events si tu en as
    const shipment = await prisma.shipment.findUnique({
        where: { trackingId },           // ⚠️ doit correspondre au champ @unique dans Prisma
        include: {
            events: {
                orderBy: { occurredAt: "desc" },
            },
            convoy: {
                select: { date: true, direction: true },
            },
        },
    });

    if (!shipment) {
        return NextResponse.json(
            { ok: false, error: "Shipment not found" },
            { status: 404 }
        );
    }

    return NextResponse.json({ ok: true, shipment });
}