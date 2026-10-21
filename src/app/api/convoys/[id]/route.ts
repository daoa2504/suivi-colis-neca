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

// PATCH /api/convoys/[id] — ADMIN uniquement, modifie le tarif au kilo.
//
// Le tarif n'est pas rétroactif : les colis déjà enregistrés gardent le
// montant figé à leur saisie. Le changer ici ne refacture personne, il
// s'applique aux colis saisis ensuite. C'est voulu — un client à qui on a
// annoncé un prix ne doit pas le voir bouger parce qu'un tarif a été
// corrigé après coup.
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    try {
        const body = await req.json().catch(() => ({} as any));
        const raw = body?.pricePerKg;

        let pricePerKg: number | null = null;
        if (raw !== "" && raw !== null && raw !== undefined) {
            const n = Number(String(raw).replace(",", "."));
            if (!Number.isFinite(n) || n < 0) {
                return NextResponse.json(
                    { ok: false, error: "Tarif invalide" },
                    { status: 400 }
                );
            }
            // Un zéro saisi vaut « pas de tarif », pas « transport gratuit ».
            pricePerKg = n > 0 ? n : null;
        }

        const convoy = await prisma.convoy.update({
            where: { id },
            data: { pricePerKg },
            select: { id: true, date: true, direction: true, pricePerKg: true },
        });

        return NextResponse.json({ ok: true, convoy });
    } catch (e: any) {
        if (e?.code === "P2025") {
            return NextResponse.json({ ok: false, error: "Convoi introuvable" }, { status: 404 });
        }
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
