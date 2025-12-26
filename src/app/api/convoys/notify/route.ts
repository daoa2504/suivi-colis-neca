// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { notifyConvoySchema } from "@/lib/validators";
import { Direction as DirectionEnum } from "@prisma/client";

export const runtime = "nodejs";

/* ----------------------------- Helpers utils ----------------------------- */

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function startOfDayUTC(input: string | Date) {
    const d = new Date(input);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function normalizeEmail(raw: string) {
    return (raw || "").trim().toLowerCase();
}

function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sendWithRetry(
    args: Parameters<typeof sendEmailSafe>[0],
    maxAttempts = 5
) {
    let last: Awaited<ReturnType<typeof sendEmailSafe>> | undefined;
    for (let i = 0; i < maxAttempts; i++) {
        last = await sendEmailSafe(args);
        if (last.ok) return last;

        const msg = last.error || "";
        const transient = /(?:429|rate|throttl|temporar|timeout|5\d\d)/i.test(msg);
        if (!transient) break;

        await sleep(600 * (i + 1));
    }
    return last!;
}

/* ----------------------------- Email Content Generators ----------------------------- */

type ConvoyStatus = "EN_ROUTE" | "IN_CUSTOMS" | "OUT_FOR_DELIVERY" | "DELIVERED";

function subjectFor(
    template: ConvoyStatus,
    direction: DirectionEnum,
    dateStr: string
) {
    const dirStr = direction === DirectionEnum.NE_TO_CA ? "NE → CA" : "CA → NE";
    let statusStr: string;

    switch (template) {
        case "EN_ROUTE":
            statusStr = "En route";
            break;
        case "IN_CUSTOMS":
            statusStr = "Arrivé à la douane";
            break;
        case "OUT_FOR_DELIVERY":
            statusStr = "Prêt pour récupération";
            break;
        case "DELIVERED":
            statusStr = "Livraison confirmée";
            break;
    }

    return `Convoi du ${dateStr} • ${dirStr} • ${statusStr}`;
}

function getEmailContent(
    template: ConvoyStatus,
    direction: DirectionEnum,
    name: string,
    trackingIds: string[],
    dateStr: string,
    customMessage?: string
) {
    const directionLabel = direction === DirectionEnum.NE_TO_CA ? "Niger → Canada" : "Canada → Niger";
    const isPlural = trackingIds.length > 1;
    const colisListText = trackingIds.map((t) => `• ${t}`).join("\n");
    const colisListHtml = trackingIds.map((t) => `• ${t}`).join("<br>");

    // ========== EN_ROUTE ==========
    if (template === "EN_ROUTE") {
        const delaiText = direction === DirectionEnum.NE_TO_CA
            ? "sept (7) jours ouvrables"
            : "dix (10) jours ouvrables";

        const statusMessage = direction === DirectionEnum.NE_TO_CA
            ? `a quitté le Niger en destination du Canada. ${isPlural ? "Vos colis seront disponibles" : "Votre colis sera disponible"} pour récupération dans un délai maximum de <strong>${delaiText}</strong>.`
            : `est en route vers le Niger. ${isPlural ? "Vos colis seront disponibles" : "Votre colis sera disponible"} pour récupération dans un délai maximum de <strong>${delaiText}</strong>.`;

        const text = `Bonjour ${name},

Veuillez s'il vous plaît ignorer les deux courriels que vous venez de recevoir. Il s'est agi d'une erreur d'envoi, et ces messages concernaient en réalité un convoi précédent déjà traité. Nous vous prions de nous excuser pour cette confusion.

Le convoi du ${dateStr} ${direction === DirectionEnum.NE_TO_CA ? "a quitté le Niger en destination du Canada" : "est en route vers le Niger"}. ${isPlural ? "Vos colis seront disponibles" : "Votre colis sera disponible"} pour récupération dans un délai maximum de ${delaiText}.

${isPlural ? `Colis (${trackingIds.length})` : "Colis"} :
${colisListText}

Nous vous remercions pour votre compréhension et votre confiance.

${customMessage || ""}

— Équipe ${directionLabel}`;

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
      🚀 Convoi en route
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <!-- Message d'excuses pour erreur d'envoi -->
    <div style="background-color: #fff3cd; border-left: 3px solid #856404; padding: 12px 15px; border-radius: 4px; margin: 0 0 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 14px; text-align: justify; text-justify: inter-word;">
        <strong>⚠️ Message important :</strong> Veuillez s'il vous plaît ignorer les deux courriels que vous venez de recevoir. Il s'est agi d'une erreur d'envoi, et ces messages concernaient en réalité un convoi précédent déjà traité. Nous vous prions de nous excuser pour cette confusion.
      </p>
    </div>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      Le convoi du <strong>${dateStr}</strong> ${statusMessage}
    </p>

    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        ${isPlural ? `Vos ${trackingIds.length} colis en transit` : "Votre colis en transit"} :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: justify; text-justify: inter-word;">
      ${isPlural ? "Vos colis sont" : "Votre colis est"} actuellement en transit et ${isPlural ? "se dirigent" : "se dirige"} vers ${isPlural ? "leur" : "sa"} destination finale. Nous vous tiendrons informé${isPlural ? "s" : ""} de ${isPlural ? "leur" : "son"} arrivée.
    </p>

    <p style="margin: 15px 0 0 0; color: #495057; font-size: 13px; text-align: center; font-style: italic;">
      Nous vous remercions pour votre compréhension et votre confiance.
    </p>
  </div>

  ${customMessage ? `
  <div style="background-color: #d1ecf1; border-left: 3px solid #0c5460; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #0c5460; font-size: 14px;">
      <strong>Information :</strong> ${customMessage}
    </p>
  </div>
  ` : ""}

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">${directionLabel}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>`;

        return { text, html };
    }

    // ========== IN_CUSTOMS ==========
    if (template === "IN_CUSTOMS") {
        const locationText = direction === DirectionEnum.NE_TO_CA ? "du Canada" : "du Niger";

        const text = `Bonjour ${name},

Le convoi du ${dateStr} est arrivé à la douane ${locationText}. ${isPlural ? "Vos colis" : "Votre colis"} ${isPlural ? "sont" : "est"} en cours de traitement douanier et ${isPlural ? "seront" : "sera"} bientôt ${isPlural ? "disponibles" : "disponible"} pour récupération.

${isPlural ? `Colis (${trackingIds.length})` : "Colis"} :
${colisListText}

Nous vous contacterons dès que ${isPlural ? "vos colis seront prêts" : "votre colis sera prêt"} pour la collecte.

${customMessage || ""}

— Équipe ${directionLabel}`;

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
      📦 Colis en douane
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      Le convoi du <strong>${dateStr}</strong> est arrivé à la douane ${locationText}. ${isPlural ? "Vos colis sont" : "Votre colis est"} en cours de traitement douanier et ${isPlural ? "seront" : "sera"} bientôt ${isPlural ? "disponibles" : "disponible"} pour récupération.
    </p>

    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        ${isPlural ? `Vos ${trackingIds.length} colis en douane` : "Votre colis en douane"} :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: justify; text-justify: inter-word;">
      Nous vous contacterons prochainement pour la collecte dès que ${isPlural ? "vos colis auront" : "votre colis aura"} passé les formalités douanières.
    </p>
  </div>

  ${customMessage ? `
  <div style="background-color: #d1ecf1; border-left: 3px solid #0c5460; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #0c5460; font-size: 14px;">
      <strong>Information :</strong> ${customMessage}
    </p>
  </div>
  ` : ""}

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">${directionLabel}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>`;

        return { text, html };
    }

    // ========== OUT_FOR_DELIVERY ==========
    if (template === "OUT_FOR_DELIVERY") {
        const locationText = direction === DirectionEnum.NE_TO_CA ? "au Canada" : "au Niger";

        const text = `Bonjour ${name},

Bonne nouvelle ! Le convoi du ${dateStr} a passé avec succès les formalités douanières. ${isPlural ? "Vos colis sont maintenant disponibles" : "Votre colis est maintenant disponible"} pour récupération ${locationText}.

${isPlural ? `Colis (${trackingIds.length})` : "Colis"} :
${colisListText}

Notre équipe vous contactera sous peu pour organiser la récupération de ${isPlural ? "vos colis" : "votre colis"}.

${customMessage || ""}

— Équipe ${directionLabel}`;

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
      ✅ Colis prêt pour récupération
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      <strong>Bonne nouvelle !</strong> Le convoi du <strong>${dateStr}</strong> a passé avec succès les formalités douanières. ${isPlural ? "Vos colis sont maintenant disponibles" : "Votre colis est maintenant disponible"} pour récupération ${locationText}.
    </p>

    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        ${isPlural ? `Vos ${trackingIds.length} colis prêts` : "Votre colis prêt"} :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <div style="background-color: #d4edda; border-left: 3px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #155724; font-size: 14px; text-align: center;">
        <strong>📞 Prochaine étape</strong><br/>
        <span style="font-size: 13px;">Notre équipe vous contactera sous peu pour organiser la récupération.</span>
      </p>
    </div>
  </div>

  ${customMessage ? `
  <div style="background-color: #d1ecf1; border-left: 3px solid #0c5460; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #0c5460; font-size: 14px;">
      <strong>Information :</strong> ${customMessage}
    </p>
  </div>
  ` : ""}

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">${directionLabel}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>`;

        return { text, html };
    }

    // Default fallback (should not happen)
    return { text: "", html: "" };
}

/* --------------------------------- Route --------------------------------- */

export async function POST(req: NextRequest) {
    // Auth
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    if (!["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();

        // Validation via Zod
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { convoyDate, template, customMessage, direction, customerEmail } = parsed.data;

        // Règles d'accès
        if (role === "AGENT_CA" && direction !== DirectionEnum.NE_TO_CA) {
            return NextResponse.json(
                { ok: false, error: "AGENT_CA ne peut notifier que NE_TO_CA" },
                { status: 403 }
            );
        }
        if (role === "AGENT_NE") {
            return NextResponse.json(
                { ok: false, error: "AGENT_NE n'est pas autorisé à notifier des convois" },
                { status: 403 }
            );
        }

        // Date normalisée
        const date = startOfDayUTC(convoyDate);

        // Upsert du convoi
        const convoy = await prisma.convoy.upsert({
            where: { date_direction: { date, direction } },
            update: {},
            create: { date, direction },
            include: {
                shipments: {
                    select: {
                        id: true,
                        trackingId: true,
                        receiverName: true,
                        receiverEmail: true,
                        notes: true,
                        thankYouEmailSent: true,
                    },
                },
            },
        });

        if (!convoy.shipments.length) {
            return NextResponse.json(
                { ok: false, error: "Aucun colis pour ce convoi" },
                { status: 404 }
            );
        }

        const dateStr = convoy.date.toLocaleDateString("fr-CA", { timeZone: "UTC" });

        const results: { email: string; ok: boolean; error?: string; id?: string; trackingIds?: string[] }[] = [];

        // ========== DELIVERED : Email de remerciement ==========
        if (template === "DELIVERED") {
            const targetEmail = normalizeEmail(customerEmail || "");

            if (!targetEmail || !isValidEmail(targetEmail)) {
                return NextResponse.json(
                    { ok: false, error: "Email client invalide" },
                    { status: 400 }
                );
            }

            const customerShipments = convoy.shipments.filter(s =>
                normalizeEmail(s.receiverEmail ?? "") === targetEmail
            );

            if (!customerShipments.length) {
                return NextResponse.json(
                    { ok: false, error: `Aucun colis trouvé pour l'email ${customerEmail} dans ce convoi` },
                    { status: 404 }
                );
            }

            const alreadySent = customerShipments.some(s => s.thankYouEmailSent);
            if (alreadySent) {
                return NextResponse.json(
                    { ok: false, error: "Email de remerciement déjà envoyé pour ce client" },
                    { status: 400 }
                );
            }

            const name = customerShipments[0].receiverName;
            const trackingIds = customerShipments.map(s => s.trackingId);
            const shipmentIds = customerShipments.map(s => s.id);
            const isPlural = trackingIds.length > 1;
            const colisListText = trackingIds.map((t) => `• ${t}`).join("\n");
            const colisListHtml = trackingIds.map((t) => `• ${t}`).join("<br>");

            const txt = `Bonjour ${name},

Nous confirmons que ${isPlural ? "vos colis ont été récupérés" : "votre colis a été récupéré"} avec succès. Merci de nous avoir fait confiance pour ${isPlural ? "leur" : "son"} acheminement. Nous espérons vous revoir très bientôt pour vos prochains envois !

${isPlural ? `Colis (${trackingIds.length})` : "Colis"} :
${colisListText}

${customMessage ?? ""}

— Équipe NIMAPLEX`;

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
      Merci pour votre confiance
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0;">
      Nous confirmons que ${isPlural ? "vos colis ont été récupérés" : "votre colis a été récupéré"} avec succès. Merci de nous avoir fait confiance pour ${isPlural ? "leur" : "son"} acheminement. Nous espérons vous revoir très bientôt pour vos prochains envois !
    </p>
    
    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        ${isPlural ? `Vos ${trackingIds.length} colis récupérés` : "Votre colis récupéré"} :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: center;">
      <strong> Bonne réception 😊 ! </strong>
    </p>
  </div>

${customMessage?.trim()
                ? `
  <div style="background-color: #d1ecf1; border-left: 3px solid #0c5460; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #0c5460; font-size: 14px;">
      <strong>Information :</strong> ${customMessage}
    </p>
  </div>`
                : ""
            }

  <!-- Message de fidélité -->
  <div style="background-color: #d4edda; border-left: 3px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #155724; font-size: 14px; text-align: center;">
      <strong>🎉 Votre satisfaction est notre priorité !</strong><br/>
      <span style="font-size: 13px;">N'hésitez pas à nous recommander à vos proches.</span>
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Merci encore et à très bientôt,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">${direction === DirectionEnum.NE_TO_CA ? "Niger → Canada" : "Canada → Niger"}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>`.trim();

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: targetEmail,
                    subject: `Merci pour votre confiance • ${trackingIds.length > 1 ? `${trackingIds.length} colis` : trackingIds[0]}`,
                    text: txt,
                    html,
                });

                if (resp.ok) {
                    await prisma.shipment.updateMany({
                        where: { id: { in: shipmentIds } },
                        data: { thankYouEmailSent: true },
                    });

                    results.push({ email: targetEmail, ok: true, id: resp.id, trackingIds });
                } else {
                    results.push({ email: targetEmail, ok: false, error: resp.error, trackingIds });
                }
            } catch (e: any) {
                results.push({ email: targetEmail, ok: false, error: e?.message || String(e), trackingIds });
            }

            const sent = results.filter((x) => x.ok).length;
            const failed = results.filter((x) => !x.ok);

            return NextResponse.json({
                ok: true,
                convoyId: convoy.id,
                customerEmail: targetEmail,
                shipmentsFound: customerShipments.length,
                trackingIds,
                sent,
                failedCount: failed.length,
                failed,
            });
        }

        // ========== EN_ROUTE, IN_CUSTOMS, OUT_FOR_DELIVERY : Emails groupés ==========

        type RecipientGroup = { name: string; ids: string[] };
        const grouped = new Map<string, RecipientGroup>();
        const invalidEmails: Array<{ emailRaw: string; id: number; trackingId: string }> = [];

        for (const s of convoy.shipments) {
            const emailRaw = s.receiverEmail ?? "";
            const email = normalizeEmail(emailRaw);

            if (!email || !isValidEmail(email)) {
                invalidEmails.push({ emailRaw, id: s.id, trackingId: s.trackingId });
                continue;
            }
            const entry = grouped.get(email);
            if (entry) {
                entry.ids.push(s.trackingId);
            } else {
                grouped.set(email, { name: s.receiverName, ids: [s.trackingId] });
            }
        }

        if (!grouped.size) {
            return NextResponse.json(
                {
                    ok: false,
                    error: "Aucun email valide",
                    invalidCount: invalidEmails.length,
                    invalidSamples: invalidEmails.slice(0, 5),
                },
                { status: 400 }
            );
        }

        for (const [email, { name, ids }] of grouped.entries()) {
            const { text, html } = getEmailContent(
                template as ConvoyStatus,
                direction,
                name,
                ids,
                dateStr,
                customMessage
            );

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: email,
                    subject: subjectFor(template as ConvoyStatus, direction, dateStr),
                    text,
                    html,
                });
                results.push(resp.ok ? { email, ok: true, id: resp.id } : { email, ok: false, error: resp.error });
            } catch (e: any) {
                results.push({ email, ok: false, error: e?.message || String(e) });
            }

            await sleep(900);
        }

        const sent = results.filter((x) => x.ok).length;
        const failed = results.filter((x) => !x.ok);

        return NextResponse.json({
            ok: true,
            convoyId: convoy.id,
            totalShipments: convoy.shipments.length,
            uniqueRecipients: grouped.size,
            sent,
            failedCount: failed.length,
            failed,
            invalidCount: invalidEmails.length,
            invalidSamples: invalidEmails.slice(0, 5),
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}