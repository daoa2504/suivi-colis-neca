// src/app/api/convoys/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// DELETE /api/convoys/[id] — ADMIN uniquement, refuse si le convoi contient des colis
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const convoy = await prisma.convoy.findUnique({
            where: { id },
            include: { _count: { select: { shipments: true } } },
        });

        if (!convoy) {
            return NextResponse.json({ ok: false, error: "Convoi introuvable" }, { status: 404 });
        }

        if (convoy._count.shipments > 0) {
            return NextResponse.json(
                { ok: false, error: `Impossible de supprimer : ${convoy._count.shipments} colis rattachés` },
                { status: 409 }
            );
        }

        await prisma.convoy.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
