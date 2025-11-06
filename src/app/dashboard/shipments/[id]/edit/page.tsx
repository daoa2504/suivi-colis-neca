// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";

function canEdit(role?: string | null) {
    return role === "ADMIN" || role === "AGENT_NE";
}

export async function PUT(
    req: Request,
    ctx: { params: Promise<{ id: string }> }   // ✅ params est un Promise
) {
    const { id: idStr } = await ctx.params;     // ✅ on attend params
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const before = await prisma.shipment.findUnique({ where: { id } });
    if (!before) {
        return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
    }

    // … ton code d’update + revalidate + email (inchangé) …
    // revalidatePath("/dashboard/shipments");
    // revalidatePath(`/dashboard/shipments/${id}/edit`);
    // await sendEmailSafe({ ... });

    return NextResponse.json({ ok: true /* , shipment: updated */ });
}

export async function DELETE(
    _req: Request,
    ctx: { params: Promise<{ id: string }> }    // ✅ idem ici
) {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.shipment.delete({ where: { id } });
    revalidatePath("/dashboard/shipments");
    return NextResponse.json({ ok: true });
}
