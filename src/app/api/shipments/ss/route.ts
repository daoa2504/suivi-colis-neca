// src/app/api/shipments/ss/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: any) {
    const trackingId = ctx?.params?.trackingId as string | undefined;
    if (!trackingId || typeof trackingId !== "string") {
        return NextResponse.json(
            { ok: false, error: "Invalid trackingId" },
            { status: 400 }
        );
    }

    try {
        const shipment = await prisma.shipment.findUnique({
            where: { trackingId }, // doit être @unique dans Prisma
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
        console.error("GET /api/shipments/ss error:", err);
        return NextResponse.json(
            { ok: false, error: "Server error" },
            { status: 500 }
        );
    }
}
