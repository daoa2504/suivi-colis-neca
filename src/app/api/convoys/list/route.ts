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

    try {
        const convoys = await prisma.convoy.findMany({
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