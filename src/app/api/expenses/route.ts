// src/app/api/expenses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const expenseSchema = z.object({
    category: z.enum(["SALARY", "CUSTOMS", "PACKAGING", "FUEL", "SHIPPING", "OTHER"]),
    subcategory: z.string().nullish(),
    amount: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().positive()
    ),
    currency: z.enum(["CAD", "XOF"]).default("CAD"),
    date: z.union([z.string(), z.date()]),
    convoyId: z.string().nullish(),
    notes: z.string().nullish(),
});

// GET /api/expenses — admin only
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const convoyId = searchParams.get("convoyId");

    const where: any = {};
    if (category) where.category = category;
    if (convoyId) where.convoyId = convoyId;

    const expenses = await prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        include: { convoy: { select: { id: true, date: true, direction: true } } },
    });

    return NextResponse.json({ ok: true, expenses });
}

// POST /api/expenses — admin only
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const expense = await prisma.expense.create({
            data: {
                category: parsed.data.category,
                subcategory: parsed.data.subcategory || null,
                amount: parsed.data.amount,
                currency: parsed.data.currency,
                date: new Date(parsed.data.date),
                convoyId: parsed.data.convoyId || null,
                notes: parsed.data.notes || null,
            },
        });
        return NextResponse.json({ ok: true, expense });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
