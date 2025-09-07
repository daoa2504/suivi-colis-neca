// src/app/dashboard/shipments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ Next 15: params est une Promise
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Auth
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_GN"].includes(role ?? "")) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Données depuis le formulaire
    const body = await req.json();

    const updated = await prisma.shipment.update({
        where: { id },
        data: {
            receiverName: body.receiverName,
            receiverEmail: body.receiverEmail,
            receiverPhone: body.receiverPhone ?? null,
            weightKg: body.weightKg ?? null,
            receiverCity: body.receiverCity ?? null,
            receiverAddress: body.receiverAddress ?? null,
            receiverPoBox: body.receiverPoBox ?? null,
            notes: body.notes ?? null,
            // ajoute ici d'autres champs si besoin
        },
    });

    return NextResponse.json({ ok: true, shipment: updated });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_GN"].includes(role ?? "")) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.shipment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}