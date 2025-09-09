// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Dans Next 15, params est un Promise -> on l'attend
type Ctx = { params: Promise<{ id: string }> };

function canEdit(role?: string | null) {
    return role === "ADMIN" || role === "AGENT_GN";
}

export async function PUT(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Normalisation des champs
    const data = {
        receiverName: body.receiverName as string,
        receiverEmail: body.receiverEmail as string,
        receiverPhone: (body.receiverPhone as string) || null,
        weightKg:
            body.weightKg !== undefined && body.weightKg !== ""
                ? Number(body.weightKg)
                : null,
        receiverAddress: (body.receiverAddress as string) || null,
        receiverCity: (body.receiverCity as string) || null,
        receiverPoBox: (body.receiverPoBox as string) || null,
        notes: (body.notes as string) || null,
    };

    await prisma.shipment.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.shipment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}