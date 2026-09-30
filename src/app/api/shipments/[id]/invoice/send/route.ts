// src/app/api/shipments/[id]/invoice/send/route.ts
//
// Régénère la facture d'un envoi depuis son état courant, puis l'envoie au
// client en pièce jointe.
//
// Sert le cas où un supplément de ville est configuré après l'enregistrement
// du colis : la facture déjà émise ne le porte pas, et il faut pouvoir
// transmettre un document à jour.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";
import { EMAIL_LOGO_SRC } from "@/lib/branding";
import { withEmailLogo } from "@/lib/emailLogo";
import { refreshInvoiceForShipment, getInvoiceByShipment } from "@/lib/invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(session.user?.role ?? "")) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
        return NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            totalAmount: true,
            surchargeAmount: true,
        },
    });

    if (!shipment) {
        return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
    }

    const to = (shipment.receiverEmail || "").trim();
    if (!to) {
        return NextResponse.json(
            { ok: false, error: "Ce colis n'a pas d'adresse courriel" },
            { status: 400 }
        );
    }

    if (!shipment.totalAmount || shipment.totalAmount <= 0) {
        return NextResponse.json(
            { ok: false, error: "Aucun montant enregistré : renseignez le paiement d'abord" },
            { status: 400 }
        );
    }

    // Régénération avant envoi : c'est tout l'intérêt du bouton, le client
    // doit recevoir le document reflétant l'état courant.
    const invoice = await refreshInvoiceForShipment(id, { userId: session.user?.id ?? null });
    if (!invoice) {
        return NextResponse.json(
            { ok: false, error: "Facture impossible à générer" },
            { status: 500 }
        );
    }

    const full = await getInvoiceByShipment(id);
    if (!full) {
        return NextResponse.json({ ok: false, error: "Facture introuvable" }, { status: 500 });
    }

    const pdf = renderInvoicePdf(full, "client");

    const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">

  <table role="presentation" style="border-collapse: collapse; border-spacing: 0; margin-bottom: 30px; width: 100%;">
    <tr>
      <td style="padding: 0;">
        <img src="${EMAIL_LOGO_SRC}" alt="Groupe NIMAPLEX Inc." width="280" style="display: block; width: 280px; max-width: 100%; height: auto; border: 0;" />
      </td>
    </tr>
  </table>

  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      Votre facture ${invoice.number}
    </h2>

    <p style="margin: 0 0 15px 0;">Bonjour <strong>${shipment.receiverName}</strong>,</p>

    <p style="margin: 0 0 20px 0;">
      Veuillez trouver ci-jointe la facture à jour de votre envoi
      <strong>${shipment.trackingId}</strong>.
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe Groupe NIMAPLEX Inc.</strong>
    </p>
  </div>

</div>`.trim();

    const resp = await sendEmailSafe({
        from: FROM,
        to,
        subject: `Facture ${invoice.number} — envoi ${shipment.trackingId}`,
        html,
        attachments: withEmailLogo([
            {
                filename: `${invoice.number}.pdf`,
                content: pdf,
                contentType: "application/pdf",
            },
        ]),
    });

    if (!resp.ok) {
        return NextResponse.json(
            { ok: false, error: resp.error || "Échec de l'envoi" },
            { status: 500 }
        );
    }

    await prisma.notificationLog.create({
        data: {
            userId: session.user?.id ?? null,
            type: "CUSTOM",
            template: "CUSTOM",
            shipmentId: id,
            sentCount: 1,
            failedCount: 0,
            notes: `Facture ${invoice.number} envoyée à ${to}`,
        },
    }).catch(() => {
        // Le journal ne doit pas faire échouer un envoi réussi
    });

    return NextResponse.json({
        ok: true,
        invoiceNumber: invoice.number,
        to,
    });
}
