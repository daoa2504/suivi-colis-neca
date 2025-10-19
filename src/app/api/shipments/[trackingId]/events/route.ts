// src/app/api/shipments/[trackingId]/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addEventSchema } from "@/lib/validators";
import { sendEmailSafe, FROM, inferDirection, footerFor } from "@/lib/email";

export const runtime = "nodejs";

// Next 15 : params est une Promise
type Ctx = { params: Promise<{ trackingId: string }> };

// mapping event -> statut
const STATUS_BY_EVENT = {
    RECEIVED_IN_NIGER: "RECEIVED_IN_NIGER",
    RECEIVED_IN_CANADA: "RECEIVED_IN_CANADA",
    IN_TRANSIT: "IN_TRANSIT",
    IN_CUSTOMS: "IN_CUSTOMS",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
} as const;

// labels FR
const LABELS: Record<string, string> = {
    RECEIVED_IN_NIGER: "Reçu par nos agents (Niger)",
    RECEIVED_IN_CANADA: "Reçu par nos agents (Canada)",
    IN_TRANSIT: "En route",
    IN_CUSTOMS: "À la douane",
    OUT_FOR_DELIVERY: "Prêt à être livré",
    DELIVERED: "Livré",
    CUSTOM: "Mise à jour",
};

// gabarits d’emails (texte) selon type — avec footer dynamique
function buildEmailForEvent(args: {
    type: keyof typeof STATUS_BY_EVENT | "CUSTOM";
    trackingId: string;
    receiverName: string;
    location?: string | null;
    notes?: string | null;
    footer: string; // 👈 footer injecté (Équipe GN → CA ou Équipe CA → GN)
}) {
    const { type, trackingId, receiverName, location, notes, footer } = args;
    const loc = location ? ` (${location})` : "";
    const noteBlock = notes && notes.trim().length > 0 ? `\nNotes :\n${notes.trim()}\n` : "";

    switch (type) {
        case "RECEIVED_IN_NIGER":
            return {
                subject: `Colis reçu par nos agents (Guinée) — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis a été reçu par nos agents en Guinée${loc}.\n` +
                    `${noteBlock}${footer}`,
            };
        case "RECEIVED_IN_CANADA":
            return {
                subject: `Colis reçu par nos agents (Canada) — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis a été reçu par nos agents au Canada${loc}.\n` +
                    `${noteBlock}${footer}`,
            };
        case "IN_TRANSIT":
            return {
                subject: `Colis en route — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis est en route${loc}.\n` +
                    `${noteBlock}${footer}`,
            };
        case "IN_CUSTOMS":
            return {
                subject: `Colis à la douane — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis est actuellement à la douane${loc}.\n` +
                    `${noteBlock}${footer}`,
            };
        case "OUT_FOR_DELIVERY":
            return {
                subject: `Colis prêt à être livré — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis est prêt à être livré${loc}.\n` +
                    `${noteBlock}${footer}`,
            };
        case "DELIVERED":
            return {
                subject: `Colis livré — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Votre colis a été livré${loc}. Merci pour votre confiance !\n` +
                    `${noteBlock}${footer}`,
            };
        default:
            return {
                subject: `Mise à jour de suivi — ${trackingId}`,
                text:
                    `Bonjour ${receiverName},\n\n` +
                    `Statut : ${LABELS[type] ?? type}${loc}\n` +
                    `${noteBlock}${footer}`,
            };
    }
}

function canPostEvent(role?: string | null) {
    // autorise ADMIN + les 2 agents
    return role === "ADMIN" || role === "AGENT_GN" || role === "AGENT_CA";
}

export async function POST(req: NextRequest, ctx: Ctx) {
    // Auth
    const session = await getServerSession(authOptions);
    if (!session || !canPostEvent(session.user?.role)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { trackingId } = await ctx.params;

    try {
        // Validation
        const body = await req.json();
        const parsed = addEventSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }
        const { type, description, location, occurredAt } = parsed.data;

        // Colis
        const shipment = await prisma.shipment.findUnique({
            where: { trackingId },
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                receiverEmail: true,
                originCountry: true,
                destinationCountry: true,
                convoy: { select: { direction: true } }, // si Direction est sur Convoy
            },
        });

        if (!shipment) {
            return NextResponse.json({ ok: false, error: "Shipment not found" }, { status: 404 });
        }

        // Déduire la direction & footer dynamique
        const direction = inferDirection({
            convoyDirection: (shipment.convoy?.direction as any) ?? null,
            originCountry: shipment.originCountry,
            destinationCountry: shipment.destinationCountry,
        });
        const FOOTER = footerFor(direction);

        // 1) créer l’événement + 2) MAJ statut si applicable
        const event = await prisma.$transaction(async (tx) => {
            const ev = await tx.shipmentEvent.create({
                data: {
                    shipmentId: shipment.id,
                    type,
                    description: description || LABELS[type] || type,
                    location: location || null,
                    occurredAt: occurredAt ? new Date(occurredAt) : undefined,
                },
            });

            const newStatus = STATUS_BY_EVENT[type as keyof typeof STATUS_BY_EVENT];
            if (newStatus) {
                await tx.shipment.update({
                    where: { id: shipment.id },
                    data: { status: newStatus },
                });
            }

            return ev;
        });

        // 3) Email (si l’adresse existe)
        if (shipment.receiverEmail) {
            const { subject, text } = buildEmailForEvent({
                type: type as any,
                trackingId: shipment.trackingId,
                receiverName: shipment.receiverName,
                location,
                notes: description,
                footer: FOOTER, // 👈 footer selon le sens
            });

            try {
                await sendEmailSafe({
                    from: FROM,
                    to: shipment.receiverEmail,
                    subject,
                    text,
                });
            } catch (e) {
                // on log seulement; on n’empêche pas la réussite de l’API
                console.warn("[event email] send failed:", e);
            }
        }

        return NextResponse.json({ ok: true, eventId: event.id });
    } catch (e) {
        console.error("[POST /api/shipments/:trackingId/events]", e);
        return NextResponse.json(
            { ok: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}