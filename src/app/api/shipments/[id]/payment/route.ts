// src/app/api/shipments/[id]/payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

const paymentSchema = z.object({
    paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
    amountPaid: z
        .preprocess(
            (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
            z.number().nonnegative().optional()
        )
        .nullish(),
});

// PATCH /api/shipments/[id]/payment
export async function PATCH(
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
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const data: any = { paymentStatus: parsed.data.paymentStatus };
    if (parsed.data.paymentStatus === "PARTIAL") {
        data.amountPaid = parsed.data.amountPaid ?? null;
    } else if (parsed.data.paymentStatus === "PAID") {
        // garde amountPaid existant ou null
    } else {
        data.amountPaid = null;
    }

    try {
        const shipment = await prisma.shipment.update({
            where: { id: shipmentId },
            data,
            select: { id: true, paymentStatus: true, amountPaid: true },
        });
        return NextResponse.json({ ok: true, shipment });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Erreur" }, { status: 500 });
    }
}
