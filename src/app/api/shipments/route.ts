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

        if (!session || !["ADMIN", "AGENT_NE"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({} as any));
        const convoyDate = body.convoyDate ? new Date(body.convoyDate) : new Date();
        const direction: Direction = "NE_TO_CA";

        // 1) upsert du convoi
        const convoy = await prisma.convoy.upsert({
            where: { date_direction: { date: convoyDate, direction } },
            update: {},
            create: { date: convoyDate, direction },
        });

        const weightKg = toFloatOrNull(body.weightKg);

        // 2) Créer le shipment (l'id s'auto-incrémente)
        const shipment = await prisma.shipment.create({
            data: {
                trackingId: "", // Temporaire, on va le mettre à jour
                receiverName: body.receiverName?.trim() || "",
                receiverEmail: body.receiverEmail?.trim() || "",
                receiverPhone: body.receiverPhone || null,
                weightKg: weightKg ?? null,
                receiverAddress: body.receiverAddress || null,
                receiverCity: body.receiverCity || null,
                receiverPoBox: body.receiverPoBox || null,
                notes: body.notes || null,
                convoyId: convoy.id,
                originCountry: "NE",
                destinationCountry: "CA",
                status: "RECEIVED_IN_NIGER",
            },
        });

        // 3) Mettre à jour le trackingId avec l'ID auto-incrémenté
        const trackingId = `NECA-${shipment.id.toString().padStart(4, "0")}`;

        const updatedShipment = await prisma.shipment.update({
            where: { id: shipment.id },
            data: { trackingId },
        });

        // 4) Email (optionnel)
        if (updatedShipment.receiverEmail) {
            const notes =
                updatedShipment.notes && String(updatedShipment.notes).trim().length > 0
                    ? `\nNotes :\n${String(updatedShipment.notes).trim()}\n`
                    : "";

            const subject = `Colis reçu par nos agents au Niger — ${updatedShipment.trackingId}`;
            const html = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <p>Bonjour <strong>${updatedShipment.receiverName}</strong>,</p>
  <p>Votre colis <strong>${updatedShipment.trackingId}</strong> a été enregistré au <strong>Niger</strong>.</p>
  ${notes ? `<p>${notes}</p>` : ""}
  <p>— Équipe <strong>NE → CA</strong></p>
  <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;" />
  <table role="presentation" style="border-collapse: collapse; border-spacing: 0; margin-top: 8px;">
    <tr>
      <td style="padding: 0;">
        <img src="https://nimaplex.com/img.png" alt="NIMAPLEX" width="55" height="55" style="display: block; border-radius: 6px;" />
      </td>
      <td style="padding-left: 6px; line-height: 1.2;">
        <div style="font-weight: bold; color: #8B0000; font-size: 15px;">NIMAPLEX</div>
        <div style="font-size: 12.5px; color: #555;">Plus qu'une solution, un service d'excellence global</div>
      </td>
    </tr>
  </table>
</div>
`;

            try {
                await sendEmailSafe({ from: FROM, to: updatedShipment.receiverEmail, subject, html });
            } catch (e) {
                console.warn("[NE new-shipment] email send failed:", e);
            }
        }

        return NextResponse.json({
            ok: true,
            id: updatedShipment.id,
            trackingId: updatedShipment.trackingId,
        });
    } catch (error: any) {
        console.error("POST /api/shipments error:", error);
        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur lors de la création du colis",
        }, { status: 500 });
    }
}