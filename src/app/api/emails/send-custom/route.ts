// src/app/api/emails/send-custom/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pas de timeout par défaut Next.js — on autorise jusqu'à 5 min pour 500 mails à 900ms d'écart
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function sendWithRetry(
    args: Parameters<typeof sendEmailSafe>[0],
    maxAttempts = 4
) {
    let last: Awaited<ReturnType<typeof sendEmailSafe>> | undefined;
    for (let i = 0; i < maxAttempts; i++) {
        last = await sendEmailSafe(args);
        if (last.ok) return last;
        const msg = last.error || "";
        const transient = /(?:429|rate|throttl|temporar|timeout|5\d\d)/i.test(msg);
        if (!transient) break;
        await sleep(700 * (i + 1));
    }
    return last!;
}

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

        // ✅ Récupérer les informations des clients (avec date du convoi)
        const allClients = await prisma.shipment.findMany({
            select: {
                id: true,
                receiverName: true,
                receiverEmail: true,
                trackingId: true,
                convoy: { select: { date: true, direction: true } },
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

        // Envoyer les emails SÉQUENTIELLEMENT pour respecter le rate limit Resend
        // (~2 req/sec en plan free, 10/sec en payant — on prend une marge avec sleep 800ms)
        let successCount = 0;
        let failCount = 0;
        const failures: { email: string; error: string }[] = [];

        for (const client of clients) {
            if (!client.receiverEmail) continue;

            // Date du convoi formatée en français (UTC pour rester aligné avec la date stockée)
            const convoyDateStr = client.convoy?.date
                ? new Date(client.convoy.date).toLocaleDateString("fr-CA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                  })
                : "—";

            const personalizedMessage = message
                .replace(/\{receiverName\}/g, client.receiverName)
                .replace(/\{trackingId\}/g, client.trackingId)
                .replace(/\{convoyDate\}/g, convoyDateStr);

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

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: client.receiverEmail,
                    subject,
                    html,
                });
                if (resp.ok) {
                    successCount++;
                } else {
                    failCount++;
                    failures.push({
                        email: client.receiverEmail,
                        error: resp.error || "Erreur inconnue",
                    });
                }
            } catch (e: any) {
                failCount++;
                failures.push({
                    email: client.receiverEmail,
                    error: e?.message || String(e),
                });
            }

            // Pause entre chaque envoi pour respecter le rate limit
            await sleep(800);
        }

        // Journal d'audit
        if (successCount > 0 || failCount > 0) {
            await prisma.notificationLog.create({
                data: {
                    userId: session.user?.id ?? null,
                    type: "CUSTOM",
                    template: "CUSTOM",
                    sentCount: successCount,
                    failedCount: failCount,
                    notes: `Email personnalisé "${subject.slice(0, 50)}" — ${clients.length} destinataire(s)`,
                },
            });
        }

        return NextResponse.json({
            ok: successCount > 0,
            message: `${successCount} email(s) envoyé(s) avec succès${failCount > 0 ? `, ${failCount} échec(s)` : ""}`,
            successCount,
            failCount,
            failedSamples: failures.slice(0, 5),
        });
    } catch (error: any) {
        console.error("POST /api/emails/send-custom error:", error);
        return NextResponse.json({
            ok: false,
            error: error.message || "Erreur lors de l'envoi",
        }, { status: 500 });
    }
}