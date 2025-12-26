// src/lib/emailTemplates.ts

export type ConvoyStatus = "EN_ROUTE" | "IN_CUSTOMS" | "OUT_FOR_DELIVERY";
export type Direction = "NE_TO_CA" | "CA_TO_NE";

export interface EmailContent {
    subject: string;
    text: string;
    html: string;
}

export function getEmailSubject(
    template: ConvoyStatus,
    direction: Direction,
    dateStr: string,
    trackingIds?: string[]
): string {
    const dirStr = direction === "NE_TO_CA" ? "NE → CA" : "CA → NE";

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
        default:
            statusStr = "Mise à jour";
    }

    return `Convoi du ${dateStr} • ${dirStr} • ${statusStr}`;
}

export function getEmailContent(
    template: ConvoyStatus,
    direction: Direction,
    name: string,
    trackingIds: string[],
    dateStr: string,
    customMessage?: string
): EmailContent {
    const directionLabel = direction === "NE_TO_CA" ? "Niger → Canada" : "Canada → Niger";
    const colisListText = trackingIds.map((t) => `• ${t}`).join("\n");
    const colisListHtml = trackingIds.map((t) => `• ${t}`).join("<br>");

    // ========== EN_ROUTE ==========
    if (template === "EN_ROUTE") {
        const delaiText = direction === "NE_TO_CA"
            ? "sept (7) jours ouvrables"
            : "dix (10) jours ouvrables";

        const statusMessage = direction === "NE_TO_CA"
            ? `a quitté le Niger en destination du Canada. Votre colis sera disponible pour récupération dans un délai maximum de <strong>${delaiText}</strong>.`
            : `est en route vers le Niger. Votre colis sera disponible pour récupération dans un délai maximum de <strong>${delaiText}</strong>.`;

        const text = `Bonjour ${name},

Le convoi du ${dateStr} ${direction === "NE_TO_CA" ? "a quitté le Niger en destination du Canada" : "est en route vers le Niger"}. Votre colis sera disponible pour récupération dans un délai maximum de ${delaiText}.

Colis :
${colisListText}

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

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      Le convoi du <strong>${dateStr}</strong> ${statusMessage}
    </p>

    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        Votre colis en transit :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: justify; text-justify: inter-word;">
      Votre colis est actuellement en transit et se dirige vers sa destination finale. Nous vous tiendrons informé de son arrivée.
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

        return {
            subject: getEmailSubject(template, direction, dateStr, trackingIds),
            text,
            html
        };
    }

    // ========== IN_CUSTOMS ==========
    if (template === "IN_CUSTOMS") {
        const locationText = direction === "NE_TO_CA" ? "du Canada" : "du Niger";

        const text = `Bonjour ${name},

Le convoi du ${dateStr} est arrivé à la douane ${locationText}. Votre colis est en cours de traitement douanier et sera bientôt disponible pour récupération.

Colis :
${colisListText}

Nous vous contacterons dès que votre colis sera prêt pour la collecte.

${customMessage || ""}

— Équipe ${directionLabel}`;

        const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">
  
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

  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      📦 Colis en douane
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      Le convoi du <strong>${dateStr}</strong> est arrivé à la douane ${locationText}. Votre colis est en cours de traitement douanier et sera bientôt disponible pour récupération.
    </p>

    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        Votre colis en douane :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: justify; text-justify: inter-word;">
      Nous vous contacterons prochainement pour la collecte dès que votre colis aura passé les formalités douanières.
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

        return {
            subject: getEmailSubject(template, direction, dateStr, trackingIds),
            text,
            html
        };
    }

    // ========== OUT_FOR_DELIVERY ==========
    if (template === "OUT_FOR_DELIVERY") {
        const locationText = direction === "NE_TO_CA" ? "au Canada" : "au Niger";

        const text = `Bonjour ${name},

Bonne nouvelle ! Le convoi du ${dateStr} a passé avec succès les formalités douanières. Votre colis est maintenant disponible pour récupération ${locationText}.

Colis :
${colisListText}

Notre équipe vous contactera sous peu pour organiser la récupération de votre colis.

${customMessage || ""}

— Équipe ${directionLabel}`;

        const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">
  
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

  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      ✅ Colis prêt pour récupération
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0; text-align: justify; text-justify: inter-word;">
      <strong>Bonne nouvelle !</strong> Le convoi du <strong>${dateStr}</strong> a passé avec succès les formalités douanières. Votre colis est maintenant disponible pour récupération ${locationText}.
    </p>

    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        Votre colis prêt :
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

        return {
            subject: getEmailSubject(template, direction, dateStr, trackingIds),
            text,
            html
        };
    }

    // Fallback - ne devrait jamais arriver avec TypeScript
    throw new Error(`Template non supporté: ${template}`);
}