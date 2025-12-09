// src/app/api/clients/list/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !["ADMIN", "AGENT_CA"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // ✅ Récupérer tous les shipments
        const shipments = await prisma.shipment.findMany({
            select: {
                id: true,
                receiverName: true,
                receiverEmail: true,
                trackingId: true,
            },
            orderBy: {
                receiverName: "asc",
            },
        });

        // ✅ Filtrer côté JavaScript pour enlever les emails null/vides
        const shipmentsWithEmail = shipments.filter(s =>
            s.receiverEmail && s.receiverEmail.trim() !== ""
        );

        // ✅ Dédupliquer par email
        const uniqueClients = Array.from(
            new Map(
                shipmentsWithEmail.map(s => [s.receiverEmail, s])
            ).values()
        );

        return NextResponse.json({
            ok: true,
            clients: uniqueClients,
        });
    } catch (error: any) {
        console.error("GET /api/clients/list error:", error);
        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur serveur",
        }, { status: 500 });
    }
}