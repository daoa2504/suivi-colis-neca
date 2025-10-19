// src/app/api/shipments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Direction } from "@prisma/client";
import { sendEmailSafe, FROM } from "@/lib/email";


const toFloatOrNull = (v: unknown) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    // accepte 12 ou 12,5
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_NE"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // le formulaire GN envoie ces champs
    const body = await req.json().catch(() => ({} as any));
    const convoyDate = body.convoyDate ? new Date(body.convoyDate) : new Date();

    // 👉 côté Guinée : direction figée GN_TO_CA
    const direction: Direction = "NE_TO_CA";

    // 1) upsert du convoi par (date, direction)
    const convoy = await prisma.convoy.upsert({
        where: { date_direction: { date: convoyDate, direction } },
        update: {},
        create: { date: convoyDate, direction },
    });
    const weightKg = toFloatOrNull((body as any).weightKg);
    // 2) créer le colis
    const shipment = await prisma.shipment.create({
        data: {
            trackingId: `NECA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            receiverName: body.receiverName?.trim(),
            receiverEmail: body.receiverEmail?.trim(),
            receiverPhone: body.receiverPhone || null,
            weightKg: weightKg ?? null,
            receiverAddress: body.receiverAddress || null,
            receiverCity: body.receiverCity || null,
            receiverPoBox: body.receiverPoBox || null,
            notes: body.notes || null,

            convoy: { connect: { id: convoy.id } },
            originCountry: "NE",
            destinationCountry: "CA",
            status: "RECEIVED_IN_NIGER",
        },
    });

    // 3) Email destinataire (si email fourni)
    if (shipment.receiverEmail) {
        const notes =
            shipment.notes && String(shipment.notes).trim().length > 0
                ? `\nNotes :\n${String(shipment.notes).trim()}\n`
                : "";

        const subject = `Colis enregistré en Guinée — ${shipment.trackingId}`;
        const text =
            `Bonjour ${shipment.receiverName},\n\n` +
            `Votre colis a été enregistré en Niger. Il sera expédié vers le Canada lors du prochain convoi.\n` +
            notes +
            `\n— Équipe GN → CA`;

        // n'empêche pas la création si l'email échoue
        try {
            await sendEmailSafe({
                from: FROM,
                to: shipment.receiverEmail,
                subject,
                text,
            });
        } catch (e) {
            console.warn("[NE new-shipment] email send failed:", e);
        }
    }

    return NextResponse.json({
        ok: true,
        id: shipment.id,
        trackingId: shipment.trackingId,
    });
}