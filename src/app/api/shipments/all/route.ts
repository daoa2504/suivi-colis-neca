// src/app/api/shipments/all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const role = session.user.role;

        // Filtrer selon le rôle
        let whereClause = {};

        if (role === "AGENT_NE") {
            // AGENT_NE ne voit que les colis CA_TO_NE
            whereClause = {
                convoy: {
                    direction: "CA_TO_NE"
                }
            };
        }
        // ADMIN et AGENT_CA voient tout

        const shipments = await prisma.shipment.findMany({
            where: whereClause,
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                receiverCity: true,
                originCountry: true,
                destinationCountry: true,
                status: true,
                weightKg: true,
                currentLocation: true,
                updatedAt: true,
                convoyId: true,
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return NextResponse.json({ ok: true, shipments });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        );
    }
}