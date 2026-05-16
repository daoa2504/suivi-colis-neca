// src/app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
    category: z.enum(["SALARY", "CUSTOMS", "PACKAGING", "FUEL", "SHIPPING", "OTHER"]).optional(),
    subcategory: z.string().nullish(),
    amount: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().positive().optional()
    ),
    currency: z.enum(["CAD", "XOF"]).optional(),
    date: z.union([z.string(), z.date()]).optional(),
    convoyId: z.string().nullish(),
    notes: z.string().nullish(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = {};
    if (parsed.data.category !== undefined) data.category = parsed.data.category;
    if (parsed.data.subcategory !== undefined) data.subcategory = parsed.data.subcategory || null;
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
    if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
    if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date);
    if (parsed.data.convoyId !== undefined) data.convoyId = parsed.data.convoyId || null;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;

    try {
        const expense = await prisma.expense.update({ where: { id }, data });
        return NextResponse.json({ ok: true, expense });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    try {
        await prisma.expense.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
