// src/app/api/food/complaints/route.ts
//
// GET  /api/food/complaints?status=&riskLevel=&lotId=&q=  → ADMIN uniquement
// POST /api/food/complaints                               → PUBLIC (formulaire client)
//   OU ADMIN (saisie manuelle depuis un appel/email)
//
// Conforme à l'Article 82 du RSAC :
//   - Log tous les canaux de réception
//   - Snapshot immuable du client et du lot
//   - Rétention 2 ans (retentionUntil = receivedAt + 2 ans)
//   - Notification email à contact@nimaplex.com

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { nextComplaintNumber } from "@/lib/complaintNumber";
import type { ComplaintChannel, HealthRiskCategory, ComplaintRiskLevel } from "@prisma/client";

export const runtime = "nodejs";

// --- Rate-limit (public POST) ---
const rateStore = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const e = rateStore.get(ip);
    if (!e || e.resetAt < now) {
        rateStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (e.count >= RATE_MAX) return false;
    e.count++;
    return true;
}
function getIp(req: NextRequest): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    );
}

const VALID_CHANNELS: ComplaintChannel[] = ["PHONE", "EMAIL", "WEBSITE_FORM", "IN_PERSON", "MAIL", "OTHER"];
const VALID_CATEGORIES: HealthRiskCategory[] = ["BIOLOGICAL", "CHEMICAL", "PHYSICAL", "QUALITY", "OTHER", "NONE"];
const VALID_RISK: ComplaintRiskLevel[] = ["HIGH", "MEDIUM", "LOW", "NONE"];

const CATEGORY_LABEL: Record<HealthRiskCategory, string> = {
    BIOLOGICAL: "Danger biologique",
    CHEMICAL: "Danger chimique",
    PHYSICAL: "Danger physique",
    QUALITY: "Qualité du produit",
    OTHER: "Autre",
    NONE: "Aucun risque santé",
};

// --- GET (admin uniquement) ---
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const riskLevel = url.searchParams.get("riskLevel");
    const lotId = url.searchParams.get("lotId");
    const q = url.searchParams.get("q")?.trim();

    const where: any = {};
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;
    if (lotId) where.lotId = lotId;
    if (q) {
        where.OR = [
            { complaintNumber: { contains: q, mode: "insensitive" } },
            { clientNameSnapshot: { contains: q, mode: "insensitive" } },
            { lotNumberSnapshot: { contains: q, mode: "insensitive" } },
            { natureDescription: { contains: q, mode: "insensitive" } },
        ];
    }

    const complaints = await prisma.foodComplaint.findMany({
        where,
        include: {
            client: { select: { id: true, customerCode: true, name: true } },
            lot: { select: { id: true, lotNumber: true, description: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 500,
    });

    return NextResponse.json({ ok: true, complaints });
}

// --- POST (public via formulaire OU admin en saisie manuelle) ---
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const isAdmin = session?.user?.role === "ADMIN";
    const ip = getIp(req);

    // Rate-limit uniquement pour les submissions publiques (pas admin)
    if (!isAdmin && !checkRateLimit(ip)) {
        return NextResponse.json(
            { ok: false, error: "Trop de plaintes déposées. Réessayez dans une heure." },
            { status: 429 }
        );
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
    }

    // Canal : admin peut choisir, sinon WEBSITE_FORM par défaut
    const rawChannel = String(body.channel ?? "WEBSITE_FORM").toUpperCase() as ComplaintChannel;
    const channel: ComplaintChannel = VALID_CHANNELS.includes(rawChannel)
        ? rawChannel
        : "WEBSITE_FORM";

    // Nature du problème
    const rawCategory = String(body.natureCategory ?? "").toUpperCase() as HealthRiskCategory;
    if (!VALID_CATEGORIES.includes(rawCategory)) {
        return NextResponse.json({ ok: false, error: "Catégorie de nature invalide" }, { status: 400 });
    }
    const natureDescription = String(body.natureDescription ?? "").trim();
    if (!natureDescription || natureDescription.length < 10) {
        return NextResponse.json({ ok: false, error: "Description trop courte (min. 10 caractères)" }, { status: 400 });
    }
    if (natureDescription.length > 3000) {
        return NextResponse.json({ ok: false, error: "Description trop longue" }, { status: 400 });
    }

    // Client — soit clientId fourni, soit snapshot par nom/email/téléphone
    const clientId = body.clientId ? String(body.clientId) : null;
    const clientNameSnapshot = String(body.clientName ?? "").trim();
    const clientEmail = body.clientEmail ? String(body.clientEmail).trim().toLowerCase() : null;
    const clientPhone = body.clientPhone ? String(body.clientPhone).trim() : null;

    if (!clientNameSnapshot || clientNameSnapshot.length < 2) {
        return NextResponse.json({ ok: false, error: "Nom du client requis" }, { status: 400 });
    }
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return NextResponse.json({ ok: false, error: "Email invalide" }, { status: 400 });
    }

    // Vérifier que clientId (si fourni) existe
    let resolvedClientId: string | null = null;
    if (clientId) {
        const c = await prisma.foodClient.findUnique({ where: { id: clientId }, select: { id: true } });
        if (c) resolvedClientId = c.id;
    }

    // Lot : soit lotId fourni, soit lotNumber → on tente de retrouver
    let lotId: string | null = null;
    let lotNumberSnapshot: string | null = null;
    if (body.lotId) {
        const lot = await prisma.foodLot.findUnique({
            where: { id: String(body.lotId) },
            select: { id: true, lotNumber: true },
        });
        if (lot) {
            lotId = lot.id;
            lotNumberSnapshot = lot.lotNumber;
        }
    } else if (body.lotNumber) {
        const num = String(body.lotNumber).trim().toUpperCase();
        lotNumberSnapshot = num;
        const lot = await prisma.foodLot.findUnique({
            where: { lotNumber: num },
            select: { id: true },
        });
        if (lot) lotId = lot.id;
    }

    // Évaluation (admin peut fournir dès la création, sinon défauts prudents)
    const isHealthRisk = Boolean(body.isHealthRisk ?? (rawCategory !== "NONE" && rawCategory !== "QUALITY"));
    const rawRisk = String(body.riskLevel ?? "").toUpperCase() as ComplaintRiskLevel;
    const riskLevel: ComplaintRiskLevel = VALID_RISK.includes(rawRisk) ? rawRisk : isHealthRisk ? "MEDIUM" : "LOW";

    // Produit
    const productDescription = body.productDescription ? String(body.productDescription).trim() : null;

    // Numérotation + rétention 2 ans
    const { number: complaintNumber } = await nextComplaintNumber();
    const receivedAt = new Date();
    const retentionUntil = new Date(receivedAt);
    retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + 2);

    const complaint = await prisma.foodComplaint.create({
        data: {
            complaintNumber,
            channel,
            receivedAt,
            clientId: resolvedClientId,
            clientNameSnapshot,
            clientEmail,
            clientPhone,
            lotId,
            lotNumberSnapshot,
            natureCategory: rawCategory,
            natureDescription,
            productDescription,
            isHealthRisk,
            riskLevel,
            retentionUntil,
            ipAddress: isAdmin ? null : ip,
            createdById: isAdmin ? (session!.user?.id ?? null) : null,
        },
    });

    // Audit
    await logAudit({
        userId: isAdmin ? (session!.user?.id ?? null) : null,
        entityType: "FoodComplaint",
        entityId: complaint.id,
        action: "CREATE",
        after: {
            complaintNumber,
            channel,
            category: rawCategory,
            risk: riskLevel,
            client: clientNameSnapshot,
            lot: lotNumberSnapshot,
        },
        ipAddress: isAdmin ? null : ip,
    });

    // Email de notification admin
    const subject = `⚠️ Nouvelle plainte alimentaire · ${complaintNumber} · ${CATEGORY_LABEL[rawCategory]}${riskLevel === "HIGH" ? " · RISQUE ÉLEVÉ" : ""}`;
    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.6; max-width: 640px;">
  <h2 style="color: ${riskLevel === "HIGH" ? "#8B0000" : "#8B5A00"}; margin: 0 0 12px;">
    Nouvelle plainte reçue — ${complaintNumber}
  </h2>
  <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
    <tr><td style="padding: 5px 0; color: #6c757d;"><strong>Canal :</strong></td>
        <td style="padding: 5px 0;">${channel}</td></tr>
    <tr><td style="padding: 5px 0; color: #6c757d;"><strong>Client :</strong></td>
        <td style="padding: 5px 0;">${clientNameSnapshot}${resolvedClientId ? "" : " <em>(non en base)</em>"}</td></tr>
    ${clientEmail ? `<tr><td style="padding: 5px 0; color: #6c757d;"><strong>Email :</strong></td>
        <td style="padding: 5px 0;"><a href="mailto:${clientEmail}">${clientEmail}</a></td></tr>` : ""}
    ${clientPhone ? `<tr><td style="padding: 5px 0; color: #6c757d;"><strong>Téléphone :</strong></td>
        <td style="padding: 5px 0;">${clientPhone}</td></tr>` : ""}
    ${lotNumberSnapshot ? `<tr><td style="padding: 5px 0; color: #6c757d;"><strong>Lot :</strong></td>
        <td style="padding: 5px 0;"><code>${lotNumberSnapshot}</code>${lotId ? "" : " <em>(non trouvé)</em>"}</td></tr>` : ""}
    <tr><td style="padding: 5px 0; color: #6c757d;"><strong>Nature :</strong></td>
        <td style="padding: 5px 0;">${CATEGORY_LABEL[rawCategory]}</td></tr>
    <tr><td style="padding: 5px 0; color: #6c757d;"><strong>Risque santé :</strong></td>
        <td style="padding: 5px 0;">${isHealthRisk ? "OUI" : "non"} · niveau ${riskLevel}</td></tr>
  </table>
  <div style="background: ${riskLevel === "HIGH" ? "#f8d7da" : "#fff3cd"}; border-left: 3px solid ${riskLevel === "HIGH" ? "#dc3545" : "#ffc107"}; padding: 12px 15px; border-radius: 4px;">
    <div style="font-weight: 600; margin-bottom: 6px;">Description :</div>
    <div style="white-space: pre-wrap;">${escapeHtml(natureDescription)}</div>
  </div>
  <p style="margin-top: 20px;">
    <a href="https://nimaplex.com/admin/food/complaints/${complaint.id}"
       style="display: inline-block; padding: 10px 20px; background: #0E4B3C; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
      Ouvrir la plainte dans l'admin
    </a>
  </p>
  <p style="margin-top: 20px; color: #6c757d; font-size: 12px;">
    Rétention obligatoire jusqu'au ${retentionUntil.toLocaleDateString("fr-CA")} (Article 82 RSAC).
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
        console.warn("[food-complaint] email notif failed:", e);
    }

    // Accusé de réception au client (si soumission publique + email fourni)
    if (!isAdmin && clientEmail) {
        try {
            await sendEmailSafe({
                from: FROM,
                to: clientEmail,
                subject: `Confirmation de votre plainte — ${complaintNumber}`,
                html: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.6; max-width: 600px;">
  <h2 style="color: #0E4B3C;">Merci pour votre signalement</h2>
  <p>Bonjour ${escapeHtml(clientNameSnapshot)},</p>
  <p>
    Nous avons bien reçu votre plainte concernant ${lotNumberSnapshot ? `le lot <code>${lotNumberSnapshot}</code>` : "un de nos produits"}.
    Elle est enregistrée sous la référence <strong>${complaintNumber}</strong>.
  </p>
  <p>
    Un membre de notre équipe va évaluer votre demande et vous recontactera dans les meilleurs délais
    avec les mesures prises.
  </p>
  <p style="margin-top: 20px; color: #6c757d; font-size: 12px;">
    Cette plainte est conservée dans nos registres conformément à l'Article 82 du RSAC.
  </p>
  <p style="color: #6c757d; font-size: 12px;">— Équipe Groupe NIMAPLEX INC.</p>
</div>`,
            });
        } catch (e) {
            console.warn("[food-complaint] accusé au client échoué:", e);
        }
    }

    return NextResponse.json({ ok: true, complaintNumber, id: complaint.id });
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
