// src/app/api/shipments/[trackingId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: { trackingId: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
    const { trackingId } = params;

    try {
        // récupère le colis + ses events si tu en as
        const shipment = await prisma.shipment.findUnique({
            where: { trackingId }, // ⚠️ 'trackingId' doit être @unique dans Prisma
            include: {
                events: { orderBy: { occurredAt: "desc" } },
                convoy: { select: { date: true, direction: true } },
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { ok: false, error: "Shipment not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true, shipment });
    } catch (err) {
        console.error("GET /api/shipments/[trackingId] error:", err);
        return NextResponse.json(
            { ok: false, error: "Server error" },
            { status: 500 }
        );
    }
}
