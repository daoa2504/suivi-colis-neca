// src/app/api/food/clients/[id]/route.ts
//
// GET    /api/food/clients/[id]  → détails
// PATCH  /api/food/clients/[id]  → mise à jour (partielle)
// DELETE /api/food/clients/[id]  → soft-delete (active = false)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const client = await prisma.foodClient.findUnique({ where: { id } });
    if (!client) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, client });
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
    const existing = await prisma.foodClient.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (name.length < 2) return NextResponse.json({ ok: false, error: "Nom trop court" }, { status: 400 });
        data.name = name;
    }
    if (body.email !== undefined) {
        const email = body.email ? String(body.email).trim().toLowerCase() : null;
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ ok: false, error: "Email invalide" }, { status: 400 });
        }
        data.email = email;
    }
    for (const key of ["phone", "address", "city", "province", "postalCode", "country", "notes"]) {
        if (body[key] !== undefined) {
            data[key] = body[key] ? String(body[key]).trim() : null;
        }
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const client = await prisma.foodClient.update({ where: { id }, data });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodClient",
        entityId: id,
        action: "UPDATE",
        before: { name: existing.name, email: existing.email, active: existing.active },
        after: { name: client.name, email: client.email, active: client.active },
    });

    return NextResponse.json({ ok: true, client });
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
    const existing = await prisma.foodClient.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    // Soft-delete : préserve l'historique et l'intégrité ACIA
    await prisma.foodClient.update({
        where: { id },
        data: { active: false },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodClient",
        entityId: id,
        action: "DELETE",
        reason: "Soft-delete via UI admin",
        before: { active: true },
        after: { active: false },
    });

    return NextResponse.json({ ok: true });
}
