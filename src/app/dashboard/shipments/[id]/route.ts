// src/app/dashboard/shipments/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, FROM } from "@/lib/email";

export const runtime = "nodejs";

// En Next 15, params est un Promise -> on l'attend
type Ctx = { params: Promise<{ id: string }> };

function canEdit(role?: string | null) {
    return role === "ADMIN" || role === "AGENT_GN";
}

export async function PUT(req: Request, ctx: Ctx) {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // On récupère l'état avant modif (utile si tu veux comparer)
    const before = await prisma.shipment.findUnique({
        where: { id },
        select: {
            trackingId: true,
            receiverEmail: true,
            receiverName: true,
        },
    });
    if (!before) {
        return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
    }

    // Normalisation des champs
    const data = {
        receiverName: body.receiverName as string,
        receiverEmail: body.receiverEmail as string,
        receiverPhone: (body.receiverPhone as string) || null,
        weightKg:
            body.weightKg !== undefined && body.weightKg !== "" ? Number(body.weightKg) : null,
        receiverAddress: (body.receiverAddress as string) || null,
        receiverCity: (body.receiverCity as string) || null,
        receiverPoBox: (body.receiverPoBox as string) || null,
        notes: (body.notes as string) || null,
    };

    const updated = await prisma.shipment.update({ where: { id }, data });

    // ---- Envoi d'email de notification (via Resend) ----
    // Enverra seulement si RESEND_API_KEY est configurée (le helper no-op sinon).
    try {
        const subject = `Mise à jour du colis ${updated.trackingId}`;
        const lignes: string[] = [];
        lignes.push(`Bonjour ${updated.receiverName || ""}`.trim() + ",");
        lignes.push("");
        lignes.push("Les informations de votre colis ont été mises à jour :");
        if (data.receiverAddress) lignes.push(`• Adresse: ${data.receiverAddress}`);
        if (data.receiverCity) lignes.push(`• Ville: ${data.receiverCity}`);
        if (data.receiverPoBox) lignes.push(`• Boîte postale: ${data.receiverPoBox}`);
        if (data.receiverPhone) lignes.push(`• Téléphone: ${data.receiverPhone}`);
        if (data.weightKg != null) lignes.push(`• Poids: ${data.weightKg} kg`);
        if (data.notes) lignes.push(`• Notes: ${data.notes}`);
        lignes.push("");
        lignes.push(`Tracking: ${updated.trackingId}`);
        lignes.push("");
        lignes.push("— Service Suivi GN → CA");

        await sendEmail({
            from: FROM, // ex: "notification@migalex.net"
            to: updated.receiverEmail,
            subject,
            text: lignes.join("\n"),
        });
    } catch (e) {
        // on loggue simplement; on ne casse pas la réponse API
        console.warn("[email:update] échec d'envoi:", e);
    }
    // -----------------------------------------------------

    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    if (!session || !canEdit(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await prisma.shipment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}