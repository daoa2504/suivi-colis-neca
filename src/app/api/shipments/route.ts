// src/app/api/shipments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Direction } from "@prisma/client";
import { sendEmailSafe, FROM, type EmailAttachment } from "@/lib/email";
import { createShipmentByCA } from "@/lib/validators";
import { createInvoiceForShipment, getInvoiceByShipment } from "@/lib/invoice";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

const toFloatOrNull = (v: unknown) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

// 📍 Fonction déplacée AVANT le POST handler
async function getNextTrackingNumber(prefix: "NECA" | "CANE") {
    const lastShipment = await prisma.shipment.findFirst({
        where: {
            trackingId: {
                startsWith: prefix
            }
        },
        orderBy: {
            trackingId: 'desc'
        }
    });

    if (!lastShipment || !lastShipment.trackingId) {
        return 1;
    }

    const parts = lastShipment.trackingId.split('-');

    if (parts.length < 2) {
        console.warn("⚠️ Format trackingId invalide, on recommence à 1");
        return 1;
    }

    const lastNumber = parseInt(parts[1], 10);

    if (isNaN(lastNumber)) {
        console.warn("⚠️ Impossible de parser le numéro, on recommence à 1");
        return 1;
    }

    return lastNumber + 1;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !["ADMIN", "AGENT_NE", "AGENT_CA"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({} as any));

        // 1) Récupérer le convoi : on exige désormais convoyId (créé par l'admin à l'avance)
        if (!body.convoyId || typeof body.convoyId !== "string") {
            return NextResponse.json(
                { ok: false, error: "convoyId requis — sélectionnez un convoi existant" },
                { status: 400 }
            );
        }

        const convoy = await prisma.convoy.findUnique({
            where: { id: body.convoyId },
        });

        if (!convoy) {
            return NextResponse.json(
                { ok: false, error: "Convoi introuvable" },
                { status: 404 }
            );
        }

        // La direction provient du convoi, source de vérité
        const direction: Direction = convoy.direction;

        // Validation spécifique CA→NE : infos du récupérateur au Niger obligatoires
        if (direction === "CA_TO_NE") {
            const parsed = createShipmentByCA.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    { ok: false, error: parsed.error.flatten() },
                    { status: 400 }
                );
            }
        }

        const isNeToCA = direction === "NE_TO_CA";
        const originCountry = isNeToCA ? "NE" : "CA";
        const destinationCountry = isNeToCA ? "CA" : "NE";
        const routeDisplay = isNeToCA ? "Niger → Canada" : "Canada → Niger";

        console.log("📦 Création de colis:");
        console.log("  - ConvoyId:", convoy.id);
        console.log("  - Date convoi:", convoy.date.toISOString());
        console.log("  - Direction:", direction);
        console.log("  - Origin:", originCountry);
        console.log("  - Destination:", destinationCountry);
        console.log("  - Route:", routeDisplay);

        const weightKg = toFloatOrNull(body.weightKg);

        // Paiement (nouveau — Phase 2.8)
        const totalAmount = toFloatOrNull(body.totalAmount);
        const rawStatus = String(body.paymentStatus ?? "UNPAID").toUpperCase();
        const paymentStatus: "PAID" | "PARTIAL" | "UNPAID" =
            rawStatus === "PAID" || rawStatus === "PARTIAL" ? rawStatus : "UNPAID";
        const rawCurrency = String(body.currency ?? "CAD").toUpperCase();
        const currency: "CAD" | "XOF" = rawCurrency === "XOF" ? "XOF" : "CAD";
        let amountPaid = toFloatOrNull(body.amountPaid);
        // Cohérence : PAID → totalité, UNPAID → 0
        if (paymentStatus === "PAID") amountPaid = totalAmount;
        if (paymentStatus === "UNPAID") amountPaid = 0;

        // 2) 🎯 GÉNÉRER LE TRACKING ID AVANT DE CRÉER LE SHIPMENT
        const trackingPrefix = isNeToCA ? "NECA" : "CANE";
        const nextNumber = await getNextTrackingNumber(trackingPrefix);
        const trackingId = `${trackingPrefix}-${nextNumber.toString().padStart(4, "0")}`;

        console.log("🎯 TrackingId généré:", trackingId);

        // 3) Créer le shipment DIRECTEMENT avec le bon trackingId
        const shipment = await prisma.shipment.create({
            data: {
                trackingId, // ✅ TrackingId correct dès la création
                receiverName: body.receiverName?.trim() || "",
                receiverEmail: body.receiverEmail?.trim() || "",
                receiverPhone: body.receiverPhone || null,
                weightKg: weightKg ?? null,
                receiverAddress: body.receiverAddress || null,
                receiverCity: body.receiverCity || null,
                receiverPoBox: body.receiverPoBox || null,
                pickupLastName: body.pickupLastName?.trim() || null,
                pickupFirstName: body.pickupFirstName?.trim() || null,
                pickupQuartier: body.pickupQuartier?.trim() || null,
                pickupPhone: body.pickupPhone?.trim() || null,
                notes: body.notes || null,
                convoyId: convoy.id,
                createdById: session.user?.id ?? null,
                originCountry,
                destinationCountry,
                status: isNeToCA ? "RECEIVED_IN_NIGER" : "RECEIVED_IN_CANADA",
                totalAmount: totalAmount ?? null,
                amountPaid: amountPaid ?? null,
                paymentStatus,
                currency: currency as any,
            },
        });

        console.log("✅ Colis créé:", {
            id: shipment.id,
            trackingId: shipment.trackingId,
            originCountry: shipment.originCountry,
            destinationCountry: shipment.destinationCountry,
        });

        // 3.5) Facture — best-effort, ne bloque jamais la création du colis
        let invoicePdfAttachment: EmailAttachment | null = null;
        try {
            const invoice = await createInvoiceForShipment(shipment.id, {
                userId: session.user?.id ?? null,
            });
            if (invoice) {
                const full = await getInvoiceByShipment(shipment.id);
                if (full) {
                    const pdfBuf = renderInvoicePdf(full, "client");
                    invoicePdfAttachment = {
                        filename: `${invoice.number}.pdf`,
                        content: pdfBuf,
                        contentType: "application/pdf",
                    };
                    console.log(`📄 Facture ${invoice.number} générée (${pdfBuf.length} bytes) — jointe à l'email`);
                }
            }
        } catch (e) {
            console.warn(`[shipments] Génération facture échouée pour ${shipment.trackingId}:`, e);
            // On continue sans PDF — l'email de confirmation part quand même
        }

        // 4) Email (optionnel)
        if (shipment.receiverEmail) {
            const notes =
                shipment.notes && String(shipment.notes).trim().length > 0
                    ? `${String(shipment.notes).trim()}\n`
                    : "";

            const receptionCountry = isNeToCA ? "Niger" : "Canada";
            const destinationText = isNeToCA ? "Canada" : "Niger";

            // Bloc récupérateur au Niger (CA → NE uniquement)
            const pickupFullName = [shipment.pickupFirstName, shipment.pickupLastName]
                .filter(Boolean)
                .join(" ");
            const pickupBlockHtml = !isNeToCA && pickupFullName ? `
    <div style="background-color: #e8f4f8; border-left: 3px solid #17a2b8; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #0c5460; font-size: 14px; font-weight: 600;">
        👤 Récupérateur au Niger
      </p>
      <table style="width: 100%; border-collapse: collapse; color: #0c5460; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0;"><strong>Nom & Prénoms :</strong></td>
          <td style="padding: 4px 0; text-align: right;">${pickupFullName}</td>
        </tr>
        ${shipment.pickupQuartier ? `
        <tr>
          <td style="padding: 4px 0;"><strong>Quartier :</strong></td>
          <td style="padding: 4px 0; text-align: right;">${shipment.pickupQuartier}</td>
        </tr>` : ""}
        ${shipment.pickupPhone ? `
        <tr>
          <td style="padding: 4px 0;"><strong>Téléphone :</strong></td>
          <td style="padding: 4px 0; text-align: right;">${shipment.pickupPhone}</td>
        </tr>` : ""}
      </table>
    </div>` : "";

            const subject = `Réception de colis au ${receptionCountry} — N° ID: ${shipment.trackingId}`;
            const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">
  
  <!-- En-tête avec logo -->
  <table role="presentation" style="border-collapse: collapse; border-spacing: 0; margin-bottom: 30px; width: 100%;">
    <tr>
      <td style="padding: 0;">
        <img src="https://nimaplex.com/img.png" alt="NIMAPLEX" width="60" height="60" style="display: block; border-radius: 8px;" />
      </td>
      <td style="padding-left: 12px; line-height: 1.3;">
        <div style="font-weight: 700; color: #8B0000; font-size: 18px; letter-spacing: 0.5px;">NIMAPLEX<span style="font-size: 11px; font-weight: 500; letter-spacing: 0; color: #8B0000;">.INC</span></div>
        <div style="font-size: 13px; color: #6c757d;">Plus qu'une solution, un service d'excellence global</div>
      </td>
    </tr>
  </table>

  <!-- Corps du message -->
  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      Confirmation de réception de votre colis
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${shipment.receiverName}</strong>,</p>
    
    <p style="margin: 0 0 15px 0;">
      Nous avons le plaisir de vous informer que votre colis a été réceptionné avec succès au <strong>${receptionCountry}</strong>.
    </p>
    
    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Numéro ID :</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
            ${shipment.trackingId}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Poids :</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #2c3e50; font-size: 14px;">
            ${shipment.weightKg} Kg
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

    ${pickupBlockHtml}

    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
      Votre colis est actuellement en notre possession et sera acheminé vers le ${destinationText} dans les meilleurs délais.
    </p>

    <!-- Bouton de suivi -->
    <div style="text-align: center; margin: 28px 0 8px 0;">
      <a href="https://nimaplex.com/track/${shipment.trackingId}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #8B0000, #DC143C); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;">
        📍 Suivre mon colis en direct
      </a>
    </div>
    <p style="margin: 6px 0 0 0; text-align: center; color: #6c757d; font-size: 12px;">
      ou copiez ce lien : https://nimaplex.com/track/${shipment.trackingId}
    </p>
  </div>

  <!-- Pied de page -->
  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX<span style="font-size: 10px; font-weight: 400; letter-spacing: 0;">.INC</span></strong><br/>
      <span style="font-size: 12px;">${routeDisplay}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>
`;
            try {
                await sendEmailSafe({
                    from: FROM,
                    to: shipment.receiverEmail,
                    subject,
                    html,
                    attachments: invoicePdfAttachment ? [invoicePdfAttachment] : undefined,
                });
            } catch (e) {
                console.warn(`[${direction} new-shipment] email send failed:`, e);
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
        }, { status: 500 });
    }
}