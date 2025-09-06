import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createShipmentByGN } from "@/lib/validators";
import { resend, FROM } from "@/lib/email";

export const runtime = "nodejs"; // important pour Prisma en prod

const genTracking = () => "GNCA-" + Math.random().toString(36).slice(2, 8).toUpperCase();

export async function POST(req: NextRequest) {
    // Auth: ADMIN ou AGENT_GN uniquement
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "AGENT_GN"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const payload = await req.json();
        const parsed = createShipmentByGN.safeParse(payload);
        if (!parsed.success) {
            return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
        }

        const d = parsed.data;
        const convoyDate = new Date(d.convoyDate as any);

        // 1) upsert du convoi par date
        const convoy = await prisma.convoy.upsert({
            where: { date: convoyDate },
            update: {},
            create: { date: convoyDate },
        });

        // 2) création du colis + event + statut initial
        const shipment = await prisma.shipment.create({
            data: {
                trackingId: genTracking(),
                receiverName: d.receiverName,
                receiverEmail: d.receiverEmail,
                receiverPhone: d.receiverPhone,
                originCountry: d.originCountry ?? "Guinée",
                destinationCountry: d.destinationCountry ?? "Canada",
                weightKg: d.weightKg,
                price: d.price,
                notes: d.notes ?? null,
                status: "RECEIVED_IN_GUINEA",
                convoyId: convoy.id,
                events: {
                    create: {
                        type: "RECEIVED_IN_GUINEA",
                        description: "Colis reçu et enregistré par l’agent Guinée",
                        location: "Guinée",
                    },
                },
            },
            include: { convoy: true },
        });

        // 3) Email immédiat au destinataire
        const dateStr = shipment.convoy!.date.toLocaleDateString("fr-CA");
        try {
            await resend.emails.send({
                from: FROM,
                to: shipment.receiverEmail,
                subject: `Colis reçu en Guinée – Convoi du ${dateStr} (${shipment.trackingId})`,
                text:
                    `Bonjour ${shipment.receiverName},

Votre colis (${shipment.trackingId}) a bien été reçu en Guinée.
Convoi prévu : ${dateStr}.

Vous serez notifié lorsque le convoi sera en route puis à son arrivée au Canada.

— Équipe GN → CA`,
                // (facultatif) HTML un peu plus sympa :
                // html: `<p>Bonjour <b>${shipment.receiverName}</b>,</p> ...`
            });
        } catch (err) {
            // on logge mais on ne bloque pas l’enregistrement
            console.error("[resend error]", err);
        }

        return NextResponse.json({ ok: true, id: shipment.id, trackingId: shipment.trackingId });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
