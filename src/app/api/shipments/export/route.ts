// src/app/api/shipments/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const direction = searchParams.get("direction") || "NE_TO_CA";
    const convoyId = searchParams.get("convoyId") || "";
    const city = (searchParams.get("city") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    const filters: Prisma.ShipmentWhereInput[] = [
        { convoy: { direction: direction as "NE_TO_CA" | "CA_TO_NE" } },
    ];
    if (convoyId) filters.push({ convoyId });
    if (city) filters.push({ receiverCity: { equals: city, mode: "insensitive" } });
    if (q) {
        filters.push({
            OR: [
                { trackingId: { contains: q, mode: "insensitive" } },
                { receiverName: { contains: q, mode: "insensitive" } },
                { receiverEmail: { contains: q, mode: "insensitive" } },
            ],
        });
    }

    const shipments = await prisma.shipment.findMany({
        where: { AND: filters },
        orderBy: { createdAt: "desc" },
        include: {
            convoy: { select: { date: true, direction: true } },
            payments: { select: { amount: true, currency: true } },
            _count: { select: { items: true } },
        },
    });

    const rows = shipments.map((s) => {
        const totalPaid = s.payments.reduce<Record<string, number>>((acc, p) => {
            acc[p.currency] = (acc[p.currency] || 0) + p.amount;
            return acc;
        }, {});
        const totalPaidStr = Object.entries(totalPaid)
            .map(([cur, total]) => `${total.toFixed(2)} ${cur}`)
            .join(" + ");
        return {
            trackingId: s.trackingId,
            convoyDate: s.convoy?.date ?? null,
            receiverName: s.receiverName,
            receiverEmail: s.receiverEmail,
            receiverPhone: s.receiverPhone,
            receiverCity: s.receiverCity,
            receiverAddress: s.receiverAddress,
            receiverPoBox: s.receiverPoBox,
            pickupFirstName: s.pickupFirstName,
            pickupLastName: s.pickupLastName,
            pickupQuartier: s.pickupQuartier,
            pickupPhone: s.pickupPhone,
            weightKg: s.weightKg,
            itemsCount: s._count.items,
            status: s.status,
            paymentStatus: s.paymentStatus,
            totalPaid: totalPaidStr,
            notes: s.notes,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            readyAt: s.readyAt,
            deliveredAt: s.deliveredAt,
        };
    });

    return NextResponse.json({ ok: true, shipments: rows, count: rows.length });
}
