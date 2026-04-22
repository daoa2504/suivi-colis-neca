// src/app/api/convoys/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const directionParam = searchParams.get("direction");
    const upcomingOnly = searchParams.get("upcomingOnly") === "true";

    const where: any = {};

    if (directionParam === "NE_TO_CA" || directionParam === "CA_TO_NE") {
        where.direction = directionParam;
    }

    // Filtre "date ≥ aujourd'hui" — n'affiche que les convois à venir ou du jour
    if (upcomingOnly) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        where.date = { gte: today };
    }

    try {
        const convoys = await prisma.convoy.findMany({
            where,
            include: {
                _count: {
                    select: { shipments: true }
                }
            },
            orderBy: { date: "desc" },
        });

        const formattedConvoys = convoys.map(c => ({
            id: c.id,
            date: c.date,
            direction: c.direction,
            totalShipments: c._count.shipments,
        }));

        return NextResponse.json({ ok: true, convoys: formattedConvoys });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}