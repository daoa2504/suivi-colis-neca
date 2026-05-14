// src/app/api/shipments/[id]/items/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const updateItemSchema = z.object({
    label: z.string().min(1).optional(),
    quantity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().int().min(1).optional()
    ),
    weightKg: z
        .preprocess(
            (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
            z.number().nonnegative().optional()
        )
        .nullish(),
});

// PATCH /api/shipments/[id]/items/[itemId]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.label !== undefined) data.label = parsed.data.label.trim();
    if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity;
    if (parsed.data.weightKg !== undefined) data.weightKg = parsed.data.weightKg;

    try {
        const item = await prisma.shipmentItem.update({
            where: { id: itemId },
            data,
        });
        return NextResponse.json({ ok: true, item });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}

// DELETE /api/shipments/[id]/items/[itemId]
export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await params;

    try {
        await prisma.shipmentItem.delete({ where: { id: itemId } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
