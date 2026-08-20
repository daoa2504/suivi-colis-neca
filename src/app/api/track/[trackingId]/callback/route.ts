// src/app/api/track/[trackingId]/callback/route.ts
//
// Endpoint public — le client demande à être rappelé par NIMAPLEX depuis
// la page de suivi /track/[trackingId].

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import type { CallbackReason } from "@prisma/client";

export const runtime = "nodejs";

// Rate-limit : max 3 demandes de rappel / IP / heure
const rateStore = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 3;
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

const VALID_REASONS: CallbackReason[] = [
    "DELIVERY_INFO", "PAYMENT", "ADDRESS_CHANGE", "URGENT", "OTHER",
];

const REASON_LABEL: Record<CallbackReason, string> = {
    DELIVERY_INFO: "Question sur la livraison",
    PAYMENT: "Question sur le paiement / la facture",
    ADDRESS_CHANGE: "Modification de l'adresse",
    URGENT: "Urgent",
    OTHER: "Autre",
};

const VALID_TIMES = ["matin", "après-midi", "soir", ""] as const;

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
    const clientPhone = String(body.clientPhone ?? "").trim();
    const clientEmail = body.clientEmail ? String(body.clientEmail).trim().toLowerCase() : null;
    const reason = String(body.reason ?? "").toUpperCase() as CallbackReason;
    const message = body.message ? String(body.message).trim() : null;
    const preferredTime = body.preferredTime ? String(body.preferredTime).toLowerCase().trim() : null;

    // Validation
    if (!clientName || clientName.length < 2) {
        return NextResponse.json({ ok: false, error: "Nom requis" }, { status: 400 });
    }
    if (!clientPhone || clientPhone.length < 6) {
        return NextResponse.json(
            { ok: false, error: "Numéro de téléphone requis pour être rappelé" },
            { status: 400 }
        );
    }
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return NextResponse.json({ ok: false, error: "Email invalide" }, { status: 400 });
    }
    if (!VALID_REASONS.includes(reason)) {
        return NextResponse.json({ ok: false, error: "Motif invalide" }, { status: 400 });
    }
    if (preferredTime && !VALID_TIMES.includes(preferredTime as any)) {
        return NextResponse.json({ ok: false, error: "Créneau invalide" }, { status: 400 });
    }
    if (message && message.length > 1000) {
        return NextResponse.json({ ok: false, error: "Message trop long" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({
        where: { trackingId },
        select: { id: true, trackingId: true },
    });

    const callback = await prisma.callbackRequest.create({
        data: {
            shipmentId: shipment?.id ?? null,
            trackingId: shipment?.trackingId ?? trackingId,
            clientName,
            clientPhone,
            clientEmail,
            reason,
            message,
            preferredTime: preferredTime || null,
            ipAddress: ip,
        },
    });

    await logAudit({
        entityType: "CallbackRequest",
        entityId: callback.id,
        action: "CREATE",
        after: { trackingId, reason, clientPhone },
        ipAddress: ip,
    });

    // Notifier NIMAPLEX
    const subject = `📞 Demande de rappel · ${trackingId} · ${REASON_LABEL[reason]}`;
    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.6; max-width: 600px;">
  <h2 style="color: #0E4B3C; margin: 0 0 12px;">Nouvelle demande de rappel</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Colis :</strong></td>
        <td style="padding: 6px 0;">${trackingId}${shipment ? "" : " (non trouvé en base)"}</td></tr>
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Nom :</strong></td>
        <td style="padding: 6px 0;">${clientName}</td></tr>
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Téléphone :</strong></td>
        <td style="padding: 6px 0;"><a href="tel:${clientPhone}">${clientPhone}</a></td></tr>
    ${clientEmail ? `<tr><td style="padding: 6px 0; color: #6c757d;"><strong>Email :</strong></td>
        <td style="padding: 6px 0;"><a href="mailto:${clientEmail}">${clientEmail}</a></td></tr>` : ""}
    <tr><td style="padding: 6px 0; color: #6c757d;"><strong>Motif :</strong></td>
        <td style="padding: 6px 0;">${REASON_LABEL[reason]}</td></tr>
    ${preferredTime ? `<tr><td style="padding: 6px 0; color: #6c757d;"><strong>Créneau préféré :</strong></td>
        <td style="padding: 6px 0; text-transform: capitalize;">${preferredTime}</td></tr>` : ""}
  </table>
  ${message ? `
  <div style="background: #e8f4f8; border-left: 3px solid #17a2b8; padding: 12px 15px; border-radius: 4px; margin-top: 16px;">
    <div style="font-weight: 600; margin-bottom: 6px;">Message :</div>
    <div style="white-space: pre-wrap;">${escapeHtml(message)}</div>
  </div>` : ""}
  <p style="margin-top: 20px; color: #6c757d; font-size: 12px;">
    Réf. demande : ${callback.id}<br/>
    IP : ${ip}
  </p>
</div>`;

    try {
        await sendEmailSafe({
            from: FROM,
            to: process.env.SUPPORT_EMAIL || "contact@nimaplex.com",
            subject,
            html,
            reply_to: clientEmail || undefined,
        });
    } catch (e) {
        console.warn("[callback] notification email failed:", e);
    }

    return NextResponse.json({ ok: true, id: callback.id });
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
