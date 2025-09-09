// src/app/dashboard/shipments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function notAuth() {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_GN"].includes(session.user.role)) {
        return notAuth();
    }
    await prisma.shipment.delete({ where: { id: params.id } });
    revalidatePath("/dashboard/shipments");
    return NextResponse.json({ ok: true });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_GN"].includes(session.user.role)) {
        return notAuth();
    }
    const body = await req.json();
    await prisma.shipment.update({
        where: { id: params.id },
        data: {
            receiverName: body.receiverName,
            receiverEmail: body.receiverEmail,
            receiverPhone: body.receiverPhone ?? null,
            weightKg: body.weightKg ?? null,
            receiverAddress: body.receiverAddress ?? null,
            receiverCity: body.receiverCity ?? null,
            receiverPoBox: body.receiverPoBox ?? null,
            notes: body.notes ?? null,
        },
    });
    revalidatePath("/dashboard/shipments");
    return NextResponse.json({ ok: true });
}