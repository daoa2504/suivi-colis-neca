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
                    ? `${String(updatedShipment.notes).trim()}\n`
                    : "";

            const subject = `Réception de colis au Niger — N° ID: ${updatedShipment.trackingId}`;
            const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">
  
  <!-- En-tête avec logo -->
  <table role="presentation" style="border-collapse: collapse; border-spacing: 0; margin-bottom: 30px; width: 100%;">
    <tr>
      <td style="padding: 0;">
        <img src="https://nimaplex.com/img.png" alt="NIMAPLEX" width="60" height="60" style="display: block; border-radius: 8px;" />
      </td>
      <td style="padding-left: 12px; line-height: 1.3;">
        <div style="font-weight: 700; color: #8B0000; font-size: 18px; letter-spacing: 0.5px;">NIMAPLEX</div>
        <div style="font-size: 13px; color: #6c757d;">Plus qu'une solution, un service d'excellence global</div>
      </td>
    </tr>
  </table>

  <!-- Corps du message -->
  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      Confirmation de réception de votre colis
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${updatedShipment.receiverName}</strong>,</p>
    
    <p style="margin: 0 0 15px 0;">
      Nous avons le plaisir de vous informer que votre colis a été réceptionné avec succès au <strong>Niger</strong>.
    </p>
    
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Numéro ID :</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
            ${updatedShipment.trackingId}
          </td>
        </tr>
         <tr>
      <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Poids :</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
        ${updatedShipment.weightKg} kg
      </td>
    </tr>
      </table>
    </div>
    
    ${notes ? `
    <div style="background-color: #fff3cd; border-left: 3px solid #ffc107; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        <strong>Note :</strong> ${notes}
      </p>
    </div>
    ` : ""}
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
      Votre colis est actuellement en notre possession et sera acheminé vers le Canada dans les meilleurs délais.
    </p>
  </div>

  <!-- Pied de page -->
  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">Niger → Canada</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
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