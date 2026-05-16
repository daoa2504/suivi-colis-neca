// src/app/api/shipments/[id]/payments/[paymentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
    amount: z
        .preprocess(
            (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
            z.number().positive().optional()
        ),
    currency: z.enum(["CAD", "XOF"]).optional(),
    method: z.enum(["CASH", "TRANSFER", "MOBILE_MONEY", "OTHER"]).optional(),
    paidAt: z.union([z.string(), z.date()]).optional(),
    notes: z.string().nullish(),
});

// PATCH /api/shipments/[id]/payments/[paymentId]
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { paymentId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
    if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
    if (parsed.data.method !== undefined) data.method = parsed.data.method;
    if (parsed.data.paidAt !== undefined) data.paidAt = new Date(parsed.data.paidAt);
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;

    try {
        const payment = await prisma.payment.update({ where: { id: paymentId }, data });
        return NextResponse.json({ ok: true, payment });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}

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
