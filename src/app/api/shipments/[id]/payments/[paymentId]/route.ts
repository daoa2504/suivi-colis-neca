// src/app/api/shipments/[id]/payments/[paymentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// DELETE /api/shipments/[id]/payments/[paymentId]
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { paymentId } = await params;

    try {
        await prisma.payment.delete({ where: { id: paymentId } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
