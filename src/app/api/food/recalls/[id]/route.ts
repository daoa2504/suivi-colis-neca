// src/app/api/food/recalls/[id]/route.ts
//
// GET   /api/food/recalls/[id]  → détail complet + contacts
// PATCH /api/food/recalls/[id]  → mise à jour workflow (statut, dates,
//                                  bilans, communiqué, ACIA, rapport de clôture)
//
// Passage automatique de statut :
// - Quand on marque activatedAt → status = ACTIVE
// - Quand on marque completedAt → status = COMPLETED
// - Quand on marque closedAt → status = CLOSED
//   + si type = REAL → FoodLot.status = RECALLED

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { RecallStatus, RecallReason, RecallClassification } from "@prisma/client";

export const runtime = "nodejs";

const STATUSES: RecallStatus[] = ["DRAFT", "ACTIVE", "MONITORING", "COMPLETED", "CLOSED"];
const REASONS: RecallReason[] = [
    "BIOLOGICAL_HAZARD", "CHEMICAL_HAZARD", "PHYSICAL_HAZARD",
    "UNDECLARED_ALLERGEN", "QUALITY_DEFECT", "REGULATORY_REQUIREMENT",
    "VOLUNTARY", "OTHER",
];
const CLASSIFICATIONS: RecallClassification[] = ["CLASS_I", "CLASS_II", "CLASS_III"];

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const recall = await prisma.foodRecall.findUnique({
        where: { id },
        include: {
            lot: true,
            triggeringComplaint: {
                select: { id: true, complaintNumber: true, natureCategory: true },
            },
            createdBy: { select: { id: true, username: true } },
            contacts: {
                include: {
                    client: {
                        select: {
                            id: true, customerCode: true, name: true,
                            email: true, phone: true,
                        },
                    },
                },
                orderBy: { clientNameSnapshot: "asc" },
            },
        },
    });
    if (!recall) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, recall });
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
    const existing = await prisma.foodRecall.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    // Statut manuel
    if (body.status !== undefined) {
        const s = String(body.status).toUpperCase() as RecallStatus;
        if (!STATUSES.includes(s)) return NextResponse.json({ ok: false, error: "Statut invalide" }, { status: 400 });
        data.status = s;
    }
    // Motif + classification (rare mais possible en draft)
    if (body.reason !== undefined) {
        const r = String(body.reason).toUpperCase() as RecallReason;
        if (!REASONS.includes(r)) return NextResponse.json({ ok: false, error: "Motif invalide" }, { status: 400 });
        data.reason = r;
    }
    if (body.classification !== undefined) {
        const c = String(body.classification).toUpperCase() as RecallClassification;
        if (!CLASSIFICATIONS.includes(c)) return NextResponse.json({ ok: false, error: "Classification invalide" }, { status: 400 });
        data.classification = c;
    }
    if (body.description !== undefined) data.description = body.description;

    // Dates de cycle de vie — passage auto de statut
    if (body.activatedAt !== undefined) {
        data.activatedAt = body.activatedAt ? new Date(body.activatedAt) : null;
        if (body.activatedAt && existing.status === "DRAFT") data.status = "ACTIVE";
    }
    if (body.completedAt !== undefined) {
        data.completedAt = body.completedAt ? new Date(body.completedAt) : null;
        if (body.completedAt) data.status = "COMPLETED";
    }
    if (body.closedAt !== undefined) {
        data.closedAt = body.closedAt ? new Date(body.closedAt) : null;
        if (body.closedAt) data.status = "CLOSED";
    }

    // Communication publique
    if (body.publicNoticeText !== undefined) data.publicNoticeText = body.publicNoticeText || null;
    if (body.publicNoticeUrl !== undefined) data.publicNoticeUrl = body.publicNoticeUrl || null;

    // ACIA
    if (body.cfiaNotifiedAt !== undefined) data.cfiaNotifiedAt = body.cfiaNotifiedAt ? new Date(body.cfiaNotifiedAt) : null;
    if (body.cfiaReference !== undefined) data.cfiaReference = body.cfiaReference || null;
    if (body.cfiaNoticeUrl !== undefined) data.cfiaNoticeUrl = body.cfiaNoticeUrl || null;

    // Bilan
    if (body.quantityRecovered !== undefined) data.quantityRecovered = body.quantityRecovered !== null && body.quantityRecovered !== "" ? Number(body.quantityRecovered) : null;
    if (body.quantityDestroyed !== undefined) data.quantityDestroyed = body.quantityDestroyed !== null && body.quantityDestroyed !== "" ? Number(body.quantityDestroyed) : null;

    // Rapport de clôture
    if (body.closureReport !== undefined) data.closureReport = body.closureReport || null;

    // Transaction : si on ferme un rappel REAL, on marque le lot RECALLED
    const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.foodRecall.update({
            where: { id },
            data,
            include: {
                lot: true,
                triggeringComplaint: { select: { id: true, complaintNumber: true } },
                createdBy: { select: { id: true, username: true } },
                contacts: {
                    include: {
                        client: {
                            select: {
                                id: true, customerCode: true, name: true,
                                email: true, phone: true,
                            },
                        },
                    },
                    orderBy: { clientNameSnapshot: "asc" },
                },
            },
        });

        // Effet de bord : si REAL rappel activé (ACTIVE ou plus), lot devient RECALLED
        if (u.type === "REAL" && ["ACTIVE", "MONITORING", "COMPLETED", "CLOSED"].includes(u.status)) {
            if (u.lot.status !== "RECALLED") {
                await tx.foodLot.update({
                    where: { id: u.lotId },
                    data: { status: "RECALLED" },
                });
            }
        }

        return u;
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodRecall",
        entityId: id,
        action: "UPDATE",
        before: { status: existing.status, closedAt: existing.closedAt },
        after: { status: updated.status, closedAt: updated.closedAt },
    });

    return NextResponse.json({ ok: true, recall: updated });
}
