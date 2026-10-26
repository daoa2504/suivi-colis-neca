// src/app/api/shipments/cities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canAccessShipping } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { dedupeCityNames } from "@/lib/city";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !canAccessShipping(session.user?.role)) {
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

        // Une entrée par ville réelle : les villes sont saisies à la main et
        // la même s'écrit « Montréal », « Montreal » ou avec une espace
        // finale. Sans ce regroupement, la liste en propose trois.
        const cityList = dedupeCityNames(cities.map(c => c.receiverCity));

        return NextResponse.json({ ok: true, cities: cityList });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}