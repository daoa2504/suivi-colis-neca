// src/app/api/shipments/cities/route.ts
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
        const cities = await prisma.shipment.findMany({
            select: { receiverCity: true },
            distinct: ["receiverCity"],
            where: {
                receiverCity: {
                    not: null
                }
            }
        });

        const cityList = cities
            .map(c => c.receiverCity)
            .filter(Boolean)
            .sort();

        return NextResponse.json({ ok: true, cities: cityList });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}