// src/app/api/clients/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !["ADMIN", "AGENT_CA"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const directionParam = searchParams.get("direction");
        const convoyId = searchParams.get("convoyId");

        // Filtres Prisma
        const where: Prisma.ShipmentWhereInput = {};
        if (convoyId) {
            where.convoyId = convoyId;
        } else if (directionParam === "NE_TO_CA" || directionParam === "CA_TO_NE") {
            where.convoy = { direction: directionParam };
        }

        // ✅ Récupérer les shipments correspondant aux filtres
        const shipments = await prisma.shipment.findMany({
            where,
            select: {
                id: true,
                receiverName: true,
                receiverEmail: true,
                trackingId: true,
                receiverCity: true,
                convoy: { select: { id: true, date: true, direction: true } },
            },
            orderBy: {
                receiverName: "asc",
            },
        });

        // ✅ Filtrer côté JavaScript pour enlever les emails null/vides
        const shipmentsWithEmail = shipments.filter(
            (s) => s.receiverEmail && s.receiverEmail.trim() !== ""
        );

        // ✅ Dédupliquer par email (en gardant le shipment le plus récent)
        const map = new Map<string, (typeof shipmentsWithEmail)[0]>();
        for (const s of shipmentsWithEmail) {
            const key = s.receiverEmail!.toLowerCase().trim();
            if (!map.has(key)) {
                map.set(key, s);
            }
        }
        const uniqueClients = Array.from(map.values());

        return NextResponse.json({
            ok: true,
            clients: uniqueClients,
            total: uniqueClients.length,
        });
    } catch (error: any) {
        console.error("GET /api/clients/list error:", error);
        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur serveur",
        }, { status: 500 });
    }
}