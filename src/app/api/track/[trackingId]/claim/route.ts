// src/app/api/track/[trackingId]/claim/route.ts
//
// Endpoint public (pas d'auth) — le client dépose une plainte depuis
// la page de suivi /track/[trackingId].
//
// Rate-limit basique en mémoire par IP (soft — pas de Redis).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { ClaimType } from "@prisma/client";

export const runtime = "nodejs";

// Rate-limit : max 5 plaintes / IP / heure (soft, process-local)
const rateStore = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateStore.get(ip);
    if (!entry || entry.resetAt < now) {
        rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_MAX) return false;
    entry.count++;
    return true;
}

function getIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    );
}

const VALID_TYPES: ClaimType[] = [
    "DAMAGED", "MISSING", "LATE", "WRONG_ITEM", "BILLING", "OTHER",
];

const TYPE_LABEL: Record<ClaimType, string> = {
    DAMAGED: "Colis endommagé",
    MISSING: "Colis perdu / non reçu",
    LATE: "Retard important",
    WRONG_ITEM: "Mauvais contenu",
    BILLING: "Problème de facturation",
    OTHER: "Autre",
};

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    const { trackingId: raw } = await params;
    const trackingId = raw.trim().toUpperCase();

    const ip = getIp(req);
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { ok: false, error: "Trop de demandes. Réessayez dans une heure." },
            { status: 429 }
        );
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
    }

    const clientName = String(body.clientName ?? "").trim();
    const clientEmail = String(body.clientEmail ?? "").trim().toLowerCase();
    const clientPhone = body.clientPhone ? String(body.clientPhone).trim() : null;
    const type = String(body.type ?? "").toUpperCase() as ClaimType;
    const description = String(body.description ?? "").trim();

    // Validation
    if (!clientName || clientName.length < 2) {
        return NextResponse.json({ ok: false, error: "Nom requis" }, { status: 400 });
    }
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return NextResponse.json({ ok: false, error: "Email invalide" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type)) {
        return NextResponse.json({ ok: false, error: "Type de plainte invalide" }, { status: 400 });
    }
    if (!description || description.length < 10) {
        return NextResponse.json(
            { ok: false, error: "Description trop courte (min. 10 caractères)" },
            { status: 400 }
        );
    }
    if (description.length > 2000) {
        return NextResponse.json({ ok: false, error: "Description trop longue" }, { status: 400 });
    }

    // Lier au colis si le tracking existe (facultatif)
    const shipment = await prisma.shipment.findUnique({
        where: { trackingId },
        select: { id: true, trackingId: true, receiverName: true, receiverEmail: true },
    });

    const claim = await prisma.claimRequest.create({
        data: {
            shipmentId: shipment?.id ?? null,
            trackingId: shipment?.trackingId ?? trackingId,
            clientName,
            clientEmail,
            clientPhone,
            type,
            description,
            ipAddress: ip,
        },
    });

    // Audit
    await logAudit({
        entityType: "ClaimRequest",
        entityId: claim.id,
        action: "CREATE",
        after: { trackingId, type, clientEmail },
        ipAddress: ip,
    });

    // Notifier NIMAPLEX
    const subject = `⚠️ Nouvelle plainte · ${trackingId} · ${TYPE_LABEL[type]}`;
    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.6; max-width: 600px;">
  <h2 style="color: #8B0000; margin: 0 0 12px;">Nouvelle plainte reçue</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Colis :</strong></td>
        <td style="padding: 6px 0;">${trackingId}${shipment ? "" : " (non trouvé en base)"}</td></tr>
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Client :</strong></td>
        <td style="padding: 6px 0;">${clientName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Email :</strong></td>
        <td style="padding: 6px 0;"><a href="mailto:${clientEmail}">${clientEmail}</a></td></tr>
    ${clientPhone ? `<tr><td style="padding: 6px 0; color: #6c757d;"><strong>Téléphone :</strong></td>
        <td style="padding: 6px 0;">${clientPhone}</td></tr>` : ""}
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Type :</strong></td>
        <td style="padding: 6px 0;">${TYPE_LABEL[type]}</td></tr>
  </table>
  <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 12px 15px; border-radius: 4px; margin-top: 16px;">
    <div style="font-weight: 600; margin-bottom: 6px;">Description :</div>
    <div style="white-space: pre-wrap;">${escapeHtml(description)}</div>
  </div>
  <p style="margin-top: 20px; color: #6c757d; font-size: 12px;">
    Réf. plainte : ${claim.id}<br/>
    IP : ${ip}
  </p>
</div>`;

    try {
        await sendEmailSafe({
            from: FROM,
            to: process.env.SUPPORT_EMAIL || "contact@nimaplex.com",
            subject,
            html,
            reply_to: clientEmail,
        });
    } catch (e) {
        console.warn("[claim] notification email failed:", e);
    }

    return NextResponse.json({ ok: true, id: claim.id });
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
