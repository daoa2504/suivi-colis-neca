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
    const lastShipment = await prisma.shipment.findFirst({
        orderBy: { id: "desc" },
    });

    const nextNumber = (lastShipment ? lastShipment.id + 1 : 1)
        .toString()
        .padStart(4, "0");


    const weightKg = toFloatOrNull((body as any).weightKg);
    // 2) créer le colis
    const shipment = await prisma.shipment.create({
        data: {
            trackingId: `NECA-${nextNumber}`,
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

  <!-- Signature alignée à gauche sans espace -->
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
          Plus qu’une solution, un service d’excellence global
        </div>
      </td>
    </tr>
  </table>
</div>
`;


        // n'empêche pas la création si l'email échoue
        try {
            await sendEmailSafe({
                from: FROM,
                to: shipment.receiverEmail,
                subject,
                html,
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