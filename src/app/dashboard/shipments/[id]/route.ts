import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateShipmentSchema } from "@/lib/validators";

export const runtime = "nodejs";

async function mustAuth(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");
    if (!["ADMIN", "AGENT_GN"].includes(session.user.role)) throw new Error("Forbidden");
    return session;
}

// PUT /api/shipments/:id
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        await mustAuth(req);
        const json = await req.json();
        const parsed = updateShipmentSchema.safeParse(json);
        if (!parsed.success) {
            return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
        }

        const d = parsed.data;
        const updated = await prisma.shipment.update({
            where: { id: params.id },
            data: {
                receiverName: d.receiverName,
                receiverEmail: d.receiverEmail,
                receiverPhone: d.receiverPhone ?? null,
                weightKg: d.weightKg,
                price: d.price,
                notes: d.notes ?? null,
            },
            select: { id: true },
        });

        return NextResponse.json({ ok: true, id: updated.id });
    } catch (e: any) {
        const code = /Unauthorized|Forbidden/.test(String(e)) ? 401 : 500;
        return NextResponse.json({ ok: false, error: String(e) }, { status: code });
    }
}

// DELETE /api/shipments/:id
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        await mustAuth(req);
        await prisma.$transaction(async (tx) => {
            await tx.shipmentEvent.deleteMany({ where: { shipmentId: params.id } });
            await tx.shipment.delete({ where: { id: params.id } });
        });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        const code = /Unauthorized|Forbidden/.test(String(e)) ? 401 : 500;
        return NextResponse.json({ ok: false, error: String(e) }, { status: code });
    }
}