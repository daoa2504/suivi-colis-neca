// src/app/api/shipments/notify-delivered/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";

export const runtime = "nodejs";

/* ----------------------------- Helpers ----------------------------- */

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

/* --------------------------------- Route --------------------------------- */

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = session.user.role;
    if (!["ADMIN", "AGENT_CA"].includes(role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { shipmentId, customerEmail, customMessage } = body as {
            shipmentId?: number | string;
            customerEmail?: string;
            customMessage?: string;
        };

        if (!shipmentId || !customerEmail) {
            return NextResponse.json({ ok: false, error: "shipmentId et customerEmail requis" }, { status: 400 });
        }

        const idNum = Number(shipmentId);
        if (!Number.isFinite(idNum)) {
            return NextResponse.json({ ok: false, error: "shipmentId invalide" }, { status: 400 });
        }

        const targetEmail = normalizeEmail(customerEmail);
        if (!targetEmail || !isValidEmail(targetEmail)) {
            return NextResponse.json({ ok: false, error: "Email client invalide" }, { status: 400 });
        }

        // ✅ ICI on récupère le colis
        const shipment = await prisma.shipment.findUnique({
            where: { id: idNum },
            select: {
                id: true,
                trackingId: true,
                receiverName: true,
                receiverEmail: true,
            },
        });

        if (!shipment) {
            return NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 });
        }

        // Vérifier que l'email correspond
        if (normalizeEmail(shipment.receiverEmail ?? "") !== targetEmail) {
            return NextResponse.json({ ok: false, error: "L'email ne correspond pas au destinataire du colis" }, { status: 400 });
        }

        // ✅ ICI on utilise shipment (même scope)
        const name = shipment.receiverName ?? "client";
        const trackingIds = [shipment.trackingId].filter(Boolean) as string[]; // prêt pour évoluer à N colis
        const isPlural = trackingIds.length > 1;
        const heading = isPlural ? `Vos ${trackingIds.length} colis livrés :` : "Votre colis livré :";

        const colisListText = trackingIds.map(t => `• ${t}`).join("\n");
        const colisListHtml = trackingIds.map(t => `• ${t}`).join("<br>");



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
    <h2 style="color: #8B0000; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Merci pour votre confiance</h2>
    <p style="margin: 0 0 15px 0;">Bonjour <strong>${name}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      Nous confirmons que ${isPlural ? "vos colis ont été récupérés" : "votre colis a été récupéré"} avec succès. Merci de nous avoir fait confiance pour ${isPlural ? "leur" : "son"} acheminement.
    </p>

    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 0 0 12px 0; font-weight: 600; color: #2c3e50; font-size: 15px;">${heading}</p>
      <div style="padding-left: 10px; color: #495057; font-size: 14px; line-height: 1.8;">${colisListHtml}</div>
    </div>

    ${
            customMessage?.trim()
                ? `<div style="background-color: #d1ecf1; border-left: 3px solid #0c5460; padding: 12px 15px; border-radius: 4px; margin: 20px 0;">
             <p style="margin: 0; color: #0c5460; font-size: 14px;">
               <strong>Information :</strong> ${customMessage.trim()}
             </p>
           </div>`
                : ""
        }

    <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px; text-align: center;">
      <strong>Bonne réception 📦😊 !</strong>
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
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong><br/>
      <span style="font-size: 12px;">Niger → Canada</span>
    </p>
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email est envoyé automatiquement, merci de ne pas y répondre directement.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
</div>
`.trim();

        const resp = await sendWithRetry({
            from: FROM,
            to: targetEmail,
            subject: `Merci pour votre confiance • ${trackingIds.join(", ")}`,

            html,
        });

        if (!resp.ok) {
            return NextResponse.json({ ok: false, error: resp.error }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            shipmentId: shipment.id,
            trackingIds,
            customerEmail: targetEmail,
            emailId: resp.id,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
