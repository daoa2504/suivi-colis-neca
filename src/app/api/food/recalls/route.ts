// src/app/api/food/recalls/route.ts
//
// GET  /api/food/recalls?status=&type=  → liste (admin)
// POST /api/food/recalls                 → crée un rappel DRAFT +
//   AUTO-GÉNÈRE les RecallContact depuis FoodSale pour ce lot.
//   C'est le cœur ACIA : "retrouver en secondes tous les clients affectés".

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { nextRecallNumber } from "@/lib/recallNumber";
import type { RecallReason, RecallClassification, RecallType, RecallStatus } from "@prisma/client";

export const runtime = "nodejs";

const REASONS: RecallReason[] = [
    "BIOLOGICAL_HAZARD", "CHEMICAL_HAZARD", "PHYSICAL_HAZARD",
    "UNDECLARED_ALLERGEN", "QUALITY_DEFECT", "REGULATORY_REQUIREMENT",
    "VOLUNTARY", "OTHER",
];
const CLASSIFICATIONS: RecallClassification[] = ["CLASS_I", "CLASS_II", "CLASS_III"];
const TYPES: RecallType[] = ["REAL", "SIMULATION"];
const STATUSES: RecallStatus[] = ["DRAFT", "ACTIVE", "MONITORING", "COMPLETED", "CLOSED"];

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const q = url.searchParams.get("q")?.trim();

    const where: any = {};
    if (status && STATUSES.includes(status as any)) where.status = status;
    if (type && TYPES.includes(type as any)) where.type = type;
    if (q) {
        where.OR = [
            { recallNumber: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { lot: { lotNumber: { contains: q, mode: "insensitive" } } },
        ];
    }

    const recalls = await prisma.foodRecall.findMany({
        where,
        include: {
            lot: { select: { id: true, lotNumber: true, description: true } },
            _count: { select: { contacts: true } },
        },
        orderBy: { initiatedAt: "desc" },
        take: 500,
    });

    return NextResponse.json({ ok: true, recalls });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const lotId = String(body.lotId ?? "").trim();
    const reason = String(body.reason ?? "").toUpperCase() as RecallReason;
    const classification = String(body.classification ?? "").toUpperCase() as RecallClassification;
    const description = String(body.description ?? "").trim();
    const rawType = String(body.type ?? "REAL").toUpperCase() as RecallType;
    const type: RecallType = TYPES.includes(rawType) ? rawType : "REAL";
    const triggeringComplaintId = body.triggeringComplaintId ? String(body.triggeringComplaintId) : null;

    // Validation
    if (!lotId) return NextResponse.json({ ok: false, error: "Lot requis" }, { status: 400 });
    if (!REASONS.includes(reason)) return NextResponse.json({ ok: false, error: "Motif invalide" }, { status: 400 });
    if (!CLASSIFICATIONS.includes(classification)) {
        return NextResponse.json({ ok: false, error: "Classification invalide (CLASS_I/II/III)" }, { status: 400 });
    }
    if (!description || description.length < 10) {
        return NextResponse.json({ ok: false, error: "Description trop courte (min. 10 caractères)" }, { status: 400 });
    }

    const lot = await prisma.foodLot.findUnique({ where: { id: lotId } });
    if (!lot) return NextResponse.json({ ok: false, error: "Lot introuvable" }, { status: 404 });

    // Auto-génération de la liste des clients affectés depuis FoodSale
    // GROUP BY clientId, SUM quantityKg — pour ce lot
    const salesGroup = await prisma.foodSale.groupBy({
        by: ["clientId"],
        where: { lotId },
        _sum: { quantityKg: true },
    });

    const clientIds = salesGroup.map((g) => g.clientId);
    const clients = clientIds.length > 0
        ? await prisma.foodClient.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true },
        })
        : [];
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    // Numérotation + rétention 2 ans
    const recallNumber = await nextRecallNumber();
    const initiatedAt = new Date();
    const retentionUntil = new Date(initiatedAt);
    retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + 2);

    // Création atomique : rappel + tous les contacts
    const recall = await prisma.foodRecall.create({
        data: {
            recallNumber,
            type,
            status: "DRAFT",
            lotId,
            reason,
            classification,
            description,
            triggeringComplaintId,
            initiatedAt,
            retentionUntil,
            createdById: session.user?.id ?? null,
            contacts: {
                create: salesGroup.map((g) => ({
                    clientId: g.clientId,
                    clientNameSnapshot: nameById.get(g.clientId) ?? "Client inconnu",
                    quantityReceived: g._sum.quantityKg ?? 0,
                })),
            },
        },
        include: {
            lot: { select: { id: true, lotNumber: true, description: true } },
            _count: { select: { contacts: true } },
        },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodRecall",
        entityId: recall.id,
        action: "CREATE",
        after: {
            recallNumber,
            type,
            lot: lot.lotNumber,
            classification,
            reason,
            contactsGenerated: salesGroup.length,
        },
    });

    return NextResponse.json({
        ok: true,
        recall,
        contactsGenerated: salesGroup.length,
    });
}
