// src/app/api/shipments/[id]/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const createItemSchema = z.object({
    label: z.string().min(1, "Libellé requis"),
    quantity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
        z.number().int().min(1)
    ),
    weightKg: z
        .preprocess(
            (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
            z.number().nonnegative().optional()
        )
        .nullish(),
});

// GET /api/shipments/[id]/items
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 });

    const items = await prisma.shipmentItem.findMany({
        where: { shipmentId },
        orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, items });
}

// POST /api/shipments/[id]/items
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const item = await prisma.shipmentItem.create({
        data: {
            shipmentId,
            label: parsed.data.label.trim(),
            quantity: parsed.data.quantity,
            weightKg: parsed.data.weightKg ?? null,
        },
    });

    return NextResponse.json({ ok: true, item });
}
