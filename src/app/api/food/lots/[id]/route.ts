// src/app/api/food/lots/[id]/route.ts
//
// GET    /api/food/lots/[id]  → détails
// PATCH  /api/food/lots/[id]  → mise à jour (partielle)
// DELETE /api/food/lots/[id]  → soft-delete
// Le lotNumber ne peut PAS être modifié (traçabilité ACIA — immuable).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { FoodLotStatus } from "@prisma/client";

export const runtime = "nodejs";

const VALID_STATUS: FoodLotStatus[] = ["IN_TRANSIT", "DELIVERED", "RECALLED"];

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const lot = await prisma.foodLot.findUnique({ where: { id } });
    if (!lot) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, lot });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.foodLot.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    // lotNumber est IMMUABLE — on refuse toute tentative de modification
    if (body.lotNumber && body.lotNumber !== existing.lotNumber) {
        return NextResponse.json(
            { ok: false, error: "Le numéro de lot est immuable (traçabilité ACIA)" },
            { status: 400 }
        );
    }

    if (body.description !== undefined) {
        const desc = String(body.description).trim();
        if (!desc) return NextResponse.json({ ok: false, error: "Description requise" }, { status: 400 });
        data.description = desc;
    }
    if (body.importDate !== undefined) {
        const d = new Date(body.importDate);
        if (Number.isNaN(d.getTime())) {
            return NextResponse.json({ ok: false, error: "Date invalide" }, { status: 400 });
        }
        data.importDate = d;
    }
    if (body.quantityKg !== undefined) {
        const q = Number(body.quantityKg);
        if (!Number.isFinite(q) || q <= 0) {
            return NextResponse.json({ ok: false, error: "Quantité invalide" }, { status: 400 });
        }
        data.quantityKg = q;
    }
    if (body.quantityRemaining !== undefined) {
        const q = Number(body.quantityRemaining);
        if (!Number.isFinite(q) || q < 0) {
            return NextResponse.json({ ok: false, error: "Quantité restante invalide" }, { status: 400 });
        }
        data.quantityRemaining = q;
    }
    if (body.status !== undefined) {
        const s = String(body.status).toUpperCase() as FoodLotStatus;
        if (!VALID_STATUS.includes(s)) {
            return NextResponse.json({ ok: false, error: "Statut invalide" }, { status: 400 });
        }
        data.status = s;
    }
    for (const key of ["awbNumber", "supplier", "supplierCity", "notes"]) {
        if (body[key] !== undefined) {
            data[key] = body[key] ? String(body[key]).trim() : null;
        }
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const lot = await prisma.foodLot.update({ where: { id }, data });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodLot",
        entityId: id,
        action: "UPDATE",
        before: { status: existing.status, quantityKg: existing.quantityKg },
        after: { status: lot.status, quantityKg: lot.quantityKg },
    });

    return NextResponse.json({ ok: true, lot });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.foodLot.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    await prisma.foodLot.update({
        where: { id },
        data: { active: false },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodLot",
        entityId: id,
        action: "DELETE",
        reason: "Soft-delete via UI admin",
    });

    return NextResponse.json({ ok: true });
}
