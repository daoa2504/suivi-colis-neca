// src/app/api/food/complaints/[id]/route.ts
//
// GET   /api/food/complaints/[id]  → détail (admin)
// PATCH /api/food/complaints/[id]  → mise à jour workflow (admin)
//
// Le PATCH accepte les updates partielles suivantes (workflow enquête Article 82) :
//   status, riskLevel, isHealthRisk, investigationNotes,
//   traceabilityChecked / traceabilityCheckedAt,
//   supplierContacted / supplierContactedAt / supplierResponse,
//   respondedAt / responseChannel / responseSummary / resolution / resolutionNotes,
//   correctiveMeasures,
//   cfiaNotificationRequired / cfiaNotifiedAt / cfiaReference,
//   handledById

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ComplaintStatus, ComplaintRiskLevel, ComplaintChannel, ComplaintResolution } from "@prisma/client";

export const runtime = "nodejs";

const STATUS_VALUES: ComplaintStatus[] = ["RECEIVED", "INVESTIGATION", "SUPPLIER_CONTACTED", "RESPONDED", "RESOLVED", "CLOSED"];
const RISK_VALUES: ComplaintRiskLevel[] = ["HIGH", "MEDIUM", "LOW", "NONE"];
const CHANNEL_VALUES: ComplaintChannel[] = ["PHONE", "EMAIL", "WEBSITE_FORM", "IN_PERSON", "MAIL", "OTHER"];
const RESOLUTION_VALUES: ComplaintResolution[] = ["REPLACEMENT", "REFUND", "APOLOGY_ONLY", "NO_ACTION_NEEDED", "RECALL_INITIATED", "OTHER"];

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const complaint = await prisma.foodComplaint.findUnique({
        where: { id },
        include: {
            client: true,
            lot: true,
            createdBy: { select: { id: true, username: true } },
            handledBy: { select: { id: true, username: true } },
        },
    });
    if (!complaint) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, complaint });
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
    const existing = await prisma.foodComplaint.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    // Status
    if (body.status !== undefined) {
        const s = String(body.status).toUpperCase() as ComplaintStatus;
        if (!STATUS_VALUES.includes(s)) return NextResponse.json({ ok: false, error: "Statut invalide" }, { status: 400 });
        data.status = s;
    }
    // Risk level
    if (body.riskLevel !== undefined) {
        const r = String(body.riskLevel).toUpperCase() as ComplaintRiskLevel;
        if (!RISK_VALUES.includes(r)) return NextResponse.json({ ok: false, error: "Niveau de risque invalide" }, { status: 400 });
        data.riskLevel = r;
    }
    if (body.isHealthRisk !== undefined) data.isHealthRisk = Boolean(body.isHealthRisk);

    // Investigation
    if (body.investigationNotes !== undefined) data.investigationNotes = body.investigationNotes || null;
    if (body.traceabilityChecked !== undefined) {
        data.traceabilityChecked = Boolean(body.traceabilityChecked);
        if (body.traceabilityChecked && !existing.traceabilityCheckedAt) {
            data.traceabilityCheckedAt = new Date();
        }
    }
    if (body.traceabilityCheckedAt !== undefined) {
        data.traceabilityCheckedAt = body.traceabilityCheckedAt ? new Date(body.traceabilityCheckedAt) : null;
    }

    // Supplier
    if (body.supplierContacted !== undefined) {
        data.supplierContacted = Boolean(body.supplierContacted);
        if (body.supplierContacted && !existing.supplierContactedAt) {
            data.supplierContactedAt = new Date();
        }
    }
    if (body.supplierContactedAt !== undefined) {
        data.supplierContactedAt = body.supplierContactedAt ? new Date(body.supplierContactedAt) : null;
    }
    if (body.supplierResponse !== undefined) data.supplierResponse = body.supplierResponse || null;

    // Réponse client
    if (body.respondedAt !== undefined) data.respondedAt = body.respondedAt ? new Date(body.respondedAt) : null;
    if (body.responseChannel !== undefined) {
        if (body.responseChannel === null || body.responseChannel === "") {
            data.responseChannel = null;
        } else {
            const c = String(body.responseChannel).toUpperCase() as ComplaintChannel;
            if (!CHANNEL_VALUES.includes(c)) return NextResponse.json({ ok: false, error: "Canal de réponse invalide" }, { status: 400 });
            data.responseChannel = c;
        }
    }
    if (body.responseSummary !== undefined) data.responseSummary = body.responseSummary || null;
    if (body.resolution !== undefined) {
        if (body.resolution === null || body.resolution === "") {
            data.resolution = null;
        } else {
            const r = String(body.resolution).toUpperCase() as ComplaintResolution;
            if (!RESOLUTION_VALUES.includes(r)) return NextResponse.json({ ok: false, error: "Résolution invalide" }, { status: 400 });
            data.resolution = r;
        }
    }
    if (body.resolutionNotes !== undefined) data.resolutionNotes = body.resolutionNotes || null;

    // Mesures correctives
    if (body.correctiveMeasures !== undefined) data.correctiveMeasures = body.correctiveMeasures || null;

    // ACIA
    if (body.cfiaNotificationRequired !== undefined) data.cfiaNotificationRequired = Boolean(body.cfiaNotificationRequired);
    if (body.cfiaNotifiedAt !== undefined) data.cfiaNotifiedAt = body.cfiaNotifiedAt ? new Date(body.cfiaNotifiedAt) : null;
    if (body.cfiaReference !== undefined) data.cfiaReference = body.cfiaReference || null;

    // Handled by
    if (body.handledById !== undefined) data.handledById = body.handledById || null;

    // Auto : dès qu'on assigne un handler ou change de statut → tracer qui traite
    if (data.status || data.investigationNotes) {
        if (!existing.handledById && !data.handledById) {
            data.handledById = session.user?.id ?? null;
        }
    }

    const updated = await prisma.foodComplaint.update({
        where: { id },
        data,
        include: {
            client: true,
            lot: true,
            createdBy: { select: { id: true, username: true } },
            handledBy: { select: { id: true, username: true } },
        },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodComplaint",
        entityId: id,
        action: "UPDATE",
        before: {
            status: existing.status,
            riskLevel: existing.riskLevel,
            cfiaNotifiedAt: existing.cfiaNotifiedAt,
        },
        after: {
            status: updated.status,
            riskLevel: updated.riskLevel,
            cfiaNotifiedAt: updated.cfiaNotifiedAt,
        },
    });

    return NextResponse.json({ ok: true, complaint: updated });
}
