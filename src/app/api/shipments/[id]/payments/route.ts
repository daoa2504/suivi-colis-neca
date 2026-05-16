// src/app/api/shipments/[id]/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const createPaymentSchema = z.object({
    amount: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().positive("Montant doit être > 0")
    ),
    currency: z.enum(["CAD", "XOF"]).default("CAD"),
    method: z.enum(["CASH", "TRANSFER", "MOBILE_MONEY", "OTHER"]).default("CASH"),
    paidAt: z.union([z.string(), z.date()]).optional(),
    notes: z.string().nullish(),
});

// GET /api/shipments/[id]/payments — liste les paiements
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const shipmentId = parseInt(id, 10);
    if (isNaN(shipmentId)) return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 });

    const payments = await prisma.payment.findMany({
        where: { shipmentId },
        orderBy: { paidAt: "desc" },
    });

    return NextResponse.json({ ok: true, payments });
}

// POST /api/shipments/[id]/payments — ajoute un paiement
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
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const payment = await prisma.payment.create({
            data: {
                shipmentId,
                amount: parsed.data.amount,
                currency: parsed.data.currency,
                method: parsed.data.method,
                paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
                notes: parsed.data.notes || null,
            },
        });
        return NextResponse.json({ ok: true, payment });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
