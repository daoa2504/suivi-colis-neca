// src/app/api/emails/send-custom/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !["ADMIN", "AGENT_CA"].includes(session.user?.role ?? "")) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { clientIds, subject, message } = body;

        if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Aucun client sélectionné" },
                { status: 400 }
            );
        }

        if (!subject || !message) {
            return NextResponse.json(
                { ok: false, error: "Sujet et message requis" },
                { status: 400 }
            );
        }

        // ✅ Récupérer les informations des clients (sans where problématique)
        const allClients = await prisma.shipment.findMany({
            select: {
                id: true,
                receiverName: true,
                receiverEmail: true,
                trackingId: true,
            },
        });

        // ✅ Filtrer en JavaScript
        const clients = allClients.filter(
            c => clientIds.includes(c.id) && c.receiverEmail && c.receiverEmail.trim() !== ""
        );

        if (clients.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Aucun client valide trouvé" },
                { status: 400 }
            );
        }

        // Envoyer les emails
        const results = await Promise.allSettled(
            clients.map(async (client) => {
                if (!client.receiverEmail) return;

                // Personnaliser le message
                const personalizedMessage = message
                    .replace(/\{receiverName\}/g, client.receiverName)
                    .replace(/\{trackingId\}/g, client.trackingId);

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
      ${subject}
    </h2>
    
    <div style="white-space: pre-wrap; color: #2c3e50; font-size: 14px; line-height: 1.8;">
${personalizedMessage}
    </div>
  </div>

  <!-- Pied de page -->
  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e9ecef; text-align: center;">
    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
      Cordialement,<br/>
      <strong style="color: #8B0000;">L'équipe NIMAPLEX</strong>
    </p>
    
    <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
      Cet email vous a été envoyé par NIMAPLEX.<br/>
      Pour toute question, veuillez contacter notre service client.
    </p>
  </div>
  
</div>
`;

                await sendEmailSafe({
                    from: FROM,
                    to: client.receiverEmail,
                    subject,
                    html,
                });
            })
        );

        const successCount = results.filter(r => r.status === "fulfilled").length;
        const failCount = results.filter(r => r.status === "rejected").length;

        return NextResponse.json({
            ok: true,
            message: `${successCount} email(s) envoyé(s) avec succès${failCount > 0 ? `, ${failCount} échec(s)` : ""}`,
            successCount,
            failCount,
        });
    } catch (error: any) {
        console.error("POST /api/emails/send-custom error:", error);
        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur lors de l'envoi",
        }, { status: 500 });
    }
}