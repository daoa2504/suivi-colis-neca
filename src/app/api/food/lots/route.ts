// src/app/api/food/lots/route.ts
//
// GET  /api/food/lots?q=&status=            → liste (filtrable)
// POST /api/food/lots                        → création
// Auto-génère lotNumber si absent (format LOT-YYYY-NNNN)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { FoodLotStatus } from "@prisma/client";

export const runtime = "nodejs";

const VALID_STATUS: FoodLotStatus[] = ["IN_TRANSIT", "DELIVERED", "RECALLED"];

async function nextLotNumber(year: number): Promise<string> {
    const prefix = `LOT-${year}-`;
    const last = await prisma.foodLot.findFirst({
        where: { lotNumber: { startsWith: prefix } },
        orderBy: { lotNumber: "desc" },
        select: { lotNumber: true },
    });
    let seq = 1;
    if (last?.lotNumber) {
        const parts = last.lotNumber.split("-");
        const n = parseInt(parts[2] ?? "0", 10);
        if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const statusParam = url.searchParams.get("status")?.toUpperCase() as FoodLotStatus | null;

    const where: any = { active: true };
    if (statusParam && VALID_STATUS.includes(statusParam)) where.status = statusParam;
    if (q) {
        where.OR = [
            { lotNumber: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { awbNumber: { contains: q, mode: "insensitive" } },
            { supplier: { contains: q, mode: "insensitive" } },
        ];
    }

    const lots = await prisma.foodLot.findMany({
        where,
        orderBy: { importDate: "desc" },
        take: 500,
    });

    return NextResponse.json({ ok: true, lots });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const description = String(body.description ?? "").trim();
    const importDateRaw = body.importDate;
    const quantityKgNum = Number(body.quantityKg);

    if (!description) {
        return NextResponse.json({ ok: false, error: "Description requise" }, { status: 400 });
    }
    if (!importDateRaw || Number.isNaN(new Date(importDateRaw).getTime())) {
        return NextResponse.json({ ok: false, error: "Date d'importation invalide" }, { status: 400 });
    }
    if (!Number.isFinite(quantityKgNum) || quantityKgNum <= 0) {
        return NextResponse.json({ ok: false, error: "Quantité invalide (> 0)" }, { status: 400 });
    }

    const importDate = new Date(importDateRaw);
    const year = importDate.getUTCFullYear();
    const lotNumber = body.lotNumber
        ? String(body.lotNumber).trim().toUpperCase()
        : await nextLotNumber(year);

    // Unicité
    const existing = await prisma.foodLot.findUnique({ where: { lotNumber } });
    if (existing) {
        return NextResponse.json(
            { ok: false, error: `Le lot ${lotNumber} existe déjà` },
            { status: 409 }
        );
    }

    const statusRaw = String(body.status ?? "IN_TRANSIT").toUpperCase() as FoodLotStatus;
    const status: FoodLotStatus = VALID_STATUS.includes(statusRaw) ? statusRaw : "IN_TRANSIT";

    const lot = await prisma.foodLot.create({
        data: {
            lotNumber,
            description,
            awbNumber: body.awbNumber ? String(body.awbNumber).trim() : null,
            supplier: body.supplier ? String(body.supplier).trim() : null,
            supplierCity: body.supplierCity ? String(body.supplierCity).trim() : null,
            importDate,
            quantityKg: quantityKgNum,
            quantityRemaining: quantityKgNum,
            status,
            notes: body.notes ? String(body.notes).trim() : null,
        },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodLot",
        entityId: lot.id,
        action: "CREATE",
        after: { lotNumber: lot.lotNumber, quantityKg: lot.quantityKg, status: lot.status },
    });

    return NextResponse.json({ ok: true, lot });
}
