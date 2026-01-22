// src/app/api/convoys/[id]/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const {id}= await params;
    try {
        const { status, currentLocation } = await req.json();
        const convoyId = await params;

        // Mettre à jour tous les colis du convoi
        const result = await prisma.shipment.updateMany({
            where: { convoyId: id, },
            data: {
                status,
                currentLocation,
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ ok: true, updatedCount: result.count });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}