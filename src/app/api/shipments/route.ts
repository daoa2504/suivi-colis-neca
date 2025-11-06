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
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        console.log("Session:", session); // Debug

        if (!session || !["ADMIN", "AGENT_NE"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({} as any));
        console.log("Body:", body); // Debug

        const convoyDate = body.convoyDate ? new Date(body.convoyDate) : new Date();
        const direction: Direction = "NE_TO_CA";

        // 1) upsert du convoi par (date, direction)
        const convoy = await prisma.convoy.upsert({
            where: { date_direction: { date: convoyDate, direction } },
            update: {},
            create: { date: convoyDate, direction },
        });

        // 2) Générer le prochain numéro de tracking
        const lastShipment = await prisma.shipment.findFirst({
            orderBy: { createdAt: "desc" }, // Changé de id à createdAt pour les String IDs
        });

        // Extraire le numéro du dernier trackingId
        let nextNumber = 1;
        if (lastShipment?.trackingId) {
            const match = lastShipment.trackingId.match(/NECA-(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const trackingId = `NECA-${nextNumber.toString().padStart(4, "0")}`;
        const weightKg = toFloatOrNull(body.weightKg);

        // 3) créer le colis
        const shipment = await prisma.shipment.create({
            data: {
                trackingId,
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

        console.log("Created shipment:", shipment.id, shipment.trackingId); // Debug

        // 4) Email destinataire (si email fourni)
        if (shipment.receiverEmail) {
            const notes =
                shipment.notes && String(shipment.notes).trim().length > 0
                    ? `\nNotes :\n${String(shipment.notes).trim()}\n`
                    : "";

            const subject = `Colis reçu par nos agents au Niger — ${shipment.trackingId}`;

            const html = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>Bonjour <strong>${shipment.receiverName}</strong>,</p>

  <p>
    Votre colis a été enregistré au <strong>Niger</strong>.
    Il sera expédié vers le <strong>Canada</strong> lors du prochain convoi.
  </p>

  ${notes ? `<p>${notes}</p>` : ""}

  <p>— Équipe <strong>NE → CA</strong></p>

  <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;" />

  <table role="presentation"
         style="border-collapse: collapse; border-spacing: 0; margin-top: 8px;">
    <tr style="padding: 0; margin: 0;">
      <td style="padding: 0; margin: 0;">
        <img src="https://nimaplex.com/img.png"
             alt="NIMAPLEX"
             width="55"
             height="55"
             style="display: block; border-radius: 6px;" />
      </td>
      <td style="padding: 0; margin: 0; line-height: 1.2;">
        <div style="font-weight: bold; color: #8B0000; font-size: 15px; margin-left: 4px;">NIMAPLEX</div>
        <div style="font-size: 12.5px; color: #555; margin-left: 4px;">
          Plus qu'une solution, un service d'excellence global
        </div>
      </td>
    </tr>
  </table>
</div>
`;

            try {
                await sendEmailSafe({
                    from: FROM,
                    to: shipment.receiverEmail,
                    subject,
                    html,
                });
                console.log("Email sent to:", shipment.receiverEmail); // Debug
            } catch (e) {
                console.warn("[NE new-shipment] email send failed:", e);
            }
        }

        return NextResponse.json({
            ok: true,
            id: shipment.id,
            trackingId: shipment.trackingId,
        });
    } catch (error: any) {
        console.error("POST /api/shipments error:", error);

        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur lors de la création du colis",
            code: error.code,
        }, { status: 500 });
    }
}