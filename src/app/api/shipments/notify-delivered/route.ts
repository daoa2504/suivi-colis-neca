import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { Direction } from "@prisma/client";

export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

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
        const { shipmentId, customerEmail } = body;

        if (!shipmentId || !customerEmail) {
            return NextResponse.json(
                { ok: false, error: "shipmentId et customerEmail requis" },
                { status: 400 }
            );
        }

        const targetEmail = normalizeEmail(customerEmail);
        if (!isValidEmail(targetEmail)) {
            return NextResponse.json(
                { ok: false, error: "Email invalide" },
                { status: 400 }
            );
        }

        // Récupérer le colis avec son convoi
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: {
                convoy: true,
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { ok: false, error: "Colis introuvable" },
                { status: 404 }
            );
        }

        // Vérifier que l'email n'a pas déjà été envoyé
        if (shipment.thankYouEmailSent) {
            return NextResponse.json(
                { ok: false, error: "Email déjà envoyé pour ce colis" },
                { status: 400 }
            );
        }

        // Vérifier les permissions
        const direction = shipment.convoy?.direction;
        if (role === "AGENT_CA" && direction !== Direction.NE_TO_CA) {
            return NextResponse.json(
                { ok: false, error: "Non autorisé pour cette direction" },
                { status: 403 }
            );
        }
        if (role === "AGENT_NE" && direction !== Direction.CA_TO_NE) {
            return NextResponse.json(
                { ok: false, error: "Non autorisé pour cette direction" },
                { status: 403 }
            );
        }

        // Trouver tous les colis du même client dans le même convoi
        const customerShipments = await prisma.shipment.findMany({
            where: {
                convoyId: shipment.convoyId,
                receiverEmail: {
                    equals: shipment.receiverEmail,
                    mode: "insensitive",
                },
            },
        });

        const trackingIds = customerShipments.map((s) => s.trackingId);
        const shipmentIds = customerShipments.map((s) => s.id);
        const name = shipment.receiverName;

        const FOOTER =
            direction === Direction.NE_TO_CA
                ? "— Équipe NE → CA"
                : "— Équipe CA → NE";

        const colisListText = trackingIds
            .map((t) => `• ${t}   →   https://nimaplex.com/track/${t}`)
            .join("\n");
        const colisListHtml = trackingIds
            .map(
                (t) =>
                    `<a href="https://nimaplex.com/track/${t}" style="display: inline-block; margin: 4px 8px 4px 0; padding: 8px 16px; background: linear-gradient(to right, #8B0000, #DC143C); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; font-family: 'Courier New', monospace;">📍 ${t}</a>`
            )
            .join("");

        const txt = `Bonjour ${name},

Nous confirmons que votre colis a été récupéré avec succès. Merci de nous avoir fait confiance pour son acheminement. Nous espérons vous revoir très bientôt pour vos prochains envois !

Colis :
${colisListText}

${FOOTER}`;

        const html = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; max-width: 600px; margin: 0 auto;">
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

  <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #8B0000;">
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
      Merci pour votre confiance
    </h2>
    
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>

    <p style="margin: 0 0 20px 0;">
      Nous confirmons que votre colis a été récupéré avec succès. Merci de nous avoir fait confiance pour son acheminement. Nous espérons vous revoir très bientôt pour vos prochains envois !
    </p>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">
        Votre colis récupéré :
      </p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">
        ${colisListHtml}
      </div>
    </div>
    
    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: center;">
      <strong>Bonne réception 😊 !</strong>
    </p>
  </div>

  <div style="background-color: #d4edda; border-left: 3px solid #28a745; padding: 15px; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 0; color: #155724; font-size: 14px; text-align: center;">
      <strong>🎉 Votre satisfaction est notre priorité !</strong><br/>
      <span style="font-size: 13px;">N'hésitez pas à nous recommander à vos proches.</span>
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Merci encore et à très bientôt,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX<span style="font-size: 10px; font-weight: 400; letter-spacing: 0;">.INC</span></strong><br/>
      <span style="font-size: 12px;">${direction === Direction.NE_TO_CA ? "Niger → Canada" : "Canada → Niger"}</span>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
</div>
`.trim();

        // Envoyer l'email
        const resp = await sendWithRetry({
            from: FROM,
            to: targetEmail,
            subject: `Merci pour votre confiance • ${trackingIds[0]}`,
            text: txt,
            html,
        });

        if (!resp.ok) {
            return NextResponse.json(
                { ok: false, error: resp.error || "Échec de l'envoi" },
                { status: 500 }
            );
        }

        // ✅ METTRE À JOUR LA BASE DE DONNÉES — flag email + statut DELIVERED + deliveredAt
        await prisma.shipment.updateMany({
            where: { id: { in: shipmentIds } },
            data: {
                thankYouEmailSent: true,
                status: "DELIVERED",
                deliveredAt: new Date(),
            },
        });

        // ✅ JOURNAL D'AUDIT
        await prisma.notificationLog.create({
            data: {
                userId: session.user?.id ?? null,
                type: "DELIVERED",
                template: "DELIVERED",
                shipmentId,
                sentCount: 1,
                failedCount: 0,
                notes: `${trackingIds.length} colis remerciés pour ${targetEmail}`,
            },
        });

        return NextResponse.json({
            ok: true,
            customerEmail: targetEmail,
            trackingIds,
            emailId: resp.id,
        });
    } catch (e: any) {
        console.error("Error in notify-delivered:", e);
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}