// src/app/api/invoices/[id]/pdf/route.ts
//
// Téléchargement d'une facture au format PDF.
//   ?variant=client       → PDF simplifié envoyé au client
//   ?variant=accounting   → PDF détaillé (comptable) — ADMIN + AGENT_CA seulement
//
// Le PDF est généré à la volée à partir du snapshot immuable en base.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getInvoiceById } from "@/lib/invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user?.role;
    if (!["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role ?? "")) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const url = new URL(req.url);
    const rawVariant = url.searchParams.get("variant") || "client";
    if (rawVariant !== "client" && rawVariant !== "accounting") {
        return NextResponse.json(
            { ok: false, error: "variant must be 'client' or 'accounting'" },
            { status: 400 }
        );
    }
    const variant = rawVariant;

    // Version comptable réservée ADMIN + AGENT_CA
    if (variant === "accounting" && !["ADMIN", "AGENT_CA"].includes(role ?? "")) {
        return NextResponse.json(
            { ok: false, error: "La version comptable est réservée à l'équipe Canada." },
            { status: 403 }
        );
    }

    const invoice = await getInvoiceById(id);
    if (!invoice) {
        return NextResponse.json({ ok: false, error: "Facture introuvable" }, { status: 404 });
    }

    let pdf: Buffer;
    try {
        pdf = renderInvoicePdf(invoice, variant);
    } catch (e: any) {
        console.error("[invoices/pdf] rendering failed:", e);
        return NextResponse.json(
            { ok: false, error: "Erreur génération PDF" },
            { status: 500 }
        );
    }

    // Journal d'audit du téléchargement
    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "Invoice",
        entityId: invoice.id,
        action: "EXPORT",
        reason: `Téléchargement PDF (${variant})`,
    });

    const filename = `${invoice.number}${variant === "accounting" ? "-comptable" : ""}.pdf`;

    return new NextResponse(pdf as unknown as BodyInit, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
            "Content-Length": String(pdf.length),
            "Cache-Control": "no-store",
        },
    });
}
