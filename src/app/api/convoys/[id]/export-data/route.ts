// src/app/api/convoys/[id]/export-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/convoys/[id]/export-data — Admin only
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const convoy = await prisma.convoy.findUnique({
        where: { id },
        include: {
            shipments: {
                orderBy: [{ receiverCity: "asc" }, { receiverName: "asc" }],
                include: {
                    items: { orderBy: { createdAt: "asc" } },
                },
            },
        },
    });

    if (!convoy) {
        return NextResponse.json({ ok: false, error: "Convoi introuvable" }, { status: 404 });
    }

    return NextResponse.json({
        ok: true,
        convoy: {
            id: convoy.id,
            date: convoy.date,
            direction: convoy.direction,
        },
        shipments: convoy.shipments.map((s) => ({
            id: s.id,
            trackingId: s.trackingId,
            receiverName: s.receiverName,
            receiverPhone: s.receiverPhone,
            receiverCity: s.receiverCity,
            weightKg: s.weightKg,
            paymentStatus: s.paymentStatus,
            amountPaid: s.amountPaid,
            pickupLastName: s.pickupLastName,
            pickupFirstName: s.pickupFirstName,
            pickupQuartier: s.pickupQuartier,
            pickupPhone: s.pickupPhone,
            items: s.items.map((it) => ({
                id: it.id,
                label: it.label,
                quantity: it.quantity,
                weightKg: it.weightKg,
            })),
        })),
    });
}
