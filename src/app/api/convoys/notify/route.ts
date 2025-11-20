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
    // filtrage basique ; la validation stricte est faite par le provider
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

        await sleep(600 * (i + 1)); // 0.6s, 1.2s, ...
    }
    return last!;
}

/* ----------------------------- Helpers email ----------------------------- */

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

function statusSentence(
    template: ConvoyStatus,
    direction: DirectionEnum
) {
    if (template === "EN_ROUTE") {
        return direction === DirectionEnum.NE_TO_CA
            ? "a quitté le Niger en destination du Canada. Les colis seront disponibles pour récupération dans un délai maximum de <strong>sept (7) jours ouvrables</strong>"
            : "est en route vers le Niger. Les colis seront disponibles pour récupération dans un délai maximum de <strong>dix (10) jours ouvrables</strong>";
    }

    if (template === "IN_CUSTOMS") {
        return direction === DirectionEnum.NE_TO_CA
            ? "est arrivé à la douane du Canada"
            : "est arrivé à la douane du Niger";
    }

    if (template === "OUT_FOR_DELIVERY") {
        return direction === DirectionEnum.NE_TO_CA
            ? "a été acheminé avec succès"
            : "est prêt pour récupération (Niger)";
    }

    // DELIVERED
    return direction === DirectionEnum.NE_TO_CA
        ? "a été livré avec succès (Canada)"
        : "a été livré avec succès (Niger)";
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

        // Upsert du convoi (assure @@unique([date, direction], name: "date_direction"))
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

        const FOOTER =
            direction === DirectionEnum.NE_TO_CA ? "— Équipe NE → CA" : "— Équipe CA → NE";

        const results: { email: string; ok: boolean; error?: string; id?: string; trackingIds?: string[] }[] = [];

        // Base URL pour le logo
        const BASE_URL =
            process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.APP_URL ||
            "https://nimaplex.com";

        // ========== DELIVERED : Rechercher par email client et envoyer UN seul email avec tous ses colis ==========
        if (template === "DELIVERED") {
            const targetEmail = normalizeEmail(customerEmail || "");

            if (!targetEmail || !isValidEmail(targetEmail)) {
                return NextResponse.json(
                    { ok: false, error: "Email client invalide" },
                    { status: 400 }
                );
            }

            // Trouver tous les colis de ce client dans ce convoi
            const customerShipments = convoy.shipments.filter(s =>
                normalizeEmail(s.receiverEmail ?? "") === targetEmail
            );

            if (!customerShipments.length) {
                return NextResponse.json(
                    { ok: false, error: `Aucun colis trouvé pour l'email ${customerEmail} dans ce convoi` },
                    { status: 404 }
                );
            }

            // Prendre le nom du premier colis (ils devraient tous avoir le même destinataire)
            const name = customerShipments[0].receiverName;
            const trackingIds = customerShipments.map(s => s.trackingId);
            const isPlural = trackingIds.length > 1;

            const colisListText = trackingIds.map((t) => `• ${t}`).join("\n");

            const txt = `Bonjour ${name},

Nous confirmons que ${isPlural ? "vos colis ont été récupérés" : "votre colis a été récupéré"} avec succès. Merci de nous avoir fait confiance pour ${isPlural ? "leur" : "son"} acheminement. Nous espérons vous revoir très bientôt pour vos prochains envois !

${isPlural ? `Colis (${trackingIds.length})` : "Colis"} :
${colisListText}

${customMessage ?? ""}

${FOOTER}`;

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
        ${trackingIds.map((t) => `• ${t}`).join("<br>")}
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
  
</div>
`.trim();

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: targetEmail,
                    subject: `Merci pour votre confiance • ${trackingIds.length > 1 ? `${trackingIds.length} colis` : trackingIds[0]}`,
                    text: txt,
                    html,
                });
                results.push(
                    resp.ok
                        ? { email: targetEmail, ok: true, id: resp.id, trackingIds }
                        : { email: targetEmail, ok: false, error: resp.error, trackingIds }
                );
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
            const colisListText = ids.map((t) => `• ${t}`).join("\n");
            const txt = `Bonjour ${name},

Convoi du ${dateStr} — ${statusSentence(template as ConvoyStatus, direction)}
Colis (${ids.length}) :
${colisListText}

${customMessage ?? ""}

${FOOTER}`;

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
      ${template === "IN_CUSTOMS"
                ? 'Colis en douane'
                : template === "OUT_FOR_DELIVERY"
                    ? 'Colis disponible'
                    : 'Départ du convoi'}
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0;">
      Nous vous informons que le convoi du <strong>${dateStr}</strong> ${statusSentence(template as ConvoyStatus, direction)}.
    </p>
    
    <!-- Encadré des colis -->
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        ${ids.length > 1 ? `Vos ${ids.length} colis concernés` : "Votre colis concerné"} :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${ids.map((t) => `• ${t}`).join("<br>")}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
      ${template === "EN_ROUTE"
                ? `${ids.length > 1 ? "Vos colis sont" : "Votre colis est"} actuellement en transit et ${ids.length > 1 ? "se dirigent" : "se dirige"} vers ${ids.length > 1 ? "leur" : "sa"} destination finale. Nous vous tiendrons informé de ${ids.length > 1 ? "leur" : "son"} arrivée.`
                : template === "IN_CUSTOMS"
                    ? `${ids.length > 1 ? "Vos colis sont" : "Votre colis est"} maintenant ${ids.length > 1 ? "arrivés" : "arrivé"} à la douane et ${ids.length > 1 ? "seront bientôt disponibles" : "sera bientôt disponible"} pour récupération. Nous vous contacterons prochainement pour la collecte.`
                    : `${ids.length > 1 ? "Vos colis sont" : "Votre colis est"} maintenant ${ids.length > 1 ? "disponibles" : "disponible"} pour remise. Nous vous contacterons sous peu pour confirmer les modalités de collecte.`}
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
      <span style="font-size: 12px;">${direction === DirectionEnum.NE_TO_CA ? "Niger → Canada" : "Canada → Niger"}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>
`.trim();

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: email,
                    subject: subjectFor(template as ConvoyStatus, direction, dateStr),
                    text: txt,
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