// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notifyConvoySchema } from "@/lib/validators";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const FROM = process.env.EMAIL_FROM || "no-reply@migralex.net";

// petite validation email très simple
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function htmlTemplate(opts: {
    receiverName: string;
    trackingId: string;
    dateStr: string;
    enRoute: boolean;
    custom?: string | null;
}) {
    const { receiverName, trackingId, dateStr, enRoute, custom } = opts;
    const title = enRoute
        ? "Votre convoi est en route vers le Canada"
        : "Votre convoi est arrivé à la douane (Canada)";

    return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
<h2 style="margin:0 0 8px">${title}</h2>
<p>Bonjour <strong>${receiverName}</strong>,</p>
<p>Convoi du <strong>${dateStr}</strong> — ${
        enRoute
            ? "il est en <strong>route vers le Canada</strong>."
            : "il est <strong>arrivé à la douane au Canada</strong>."
    }</p>
<p>Numéro de colis : <strong>${trackingId}</strong></p>
${custom ? `<p style="white-space:pre-wrap">${custom}</p>` : ""}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
<p style="color:#6b7280;font-size:12px">Équipe GN → CA</p>
</div>`;
}

async function sendWithRetry(args: Parameters<typeof sendEmail>[0], tries = 3) {
    let lastErr: unknown = null;
    for (let i = 0; i < tries; i++) {
        try {
            await sendEmail(args);
            return { ok: true as const };
        } catch (e: any) {
            lastErr = e;
// Si Resend renvoie 429/5xx on attend un peu (backoff)
            const msg = String(e?.message || "");
            if (/(429|rate|timeout|5\d\d)/i.test(msg)) {
                await new Promise((r) => setTimeout(r, 500 * (i + 1)));
                continue;
            }
            break;
        }
    }
    return { ok: false as const, error: lastErr };
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!["ADMIN", "AGENT_CA"].includes(session.user.role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const raw = await req.json();
        const parsed = notifyConvoySchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const convoyDate = new Date(parsed.data.convoyDate as any);
        const template = parsed.data.template; // "EN_ROUTE" | "IN_CUSTOMS"
        const custom = parsed.data.customMessage;

        const convoy = await prisma.convoy.findUnique({
            where: { date: convoyDate },
            include: {
                shipments: {
                    select: {
                        id: true,
                        trackingId: true,
                        receiverName: true,
                        receiverEmail: true,
                    },
                },
            },
        });

        if (!convoy || convoy.shipments.length === 0) {
            return NextResponse.json(
                { ok: false, error: "Aucun colis pour ce convoi" },
                { status: 404 }
            );
        }

        const dateStr = convoy.date.toLocaleDateString("fr-CA");
        const enRoute = template === "EN_ROUTE";
        const subject = enRoute
            ? "Votre convoi est en route vers le Canada"
            : "Votre convoi est arrivé à la douane (Canada)";

// 1) préparer les cibles valides
        const valid = convoy.shipments.filter(
            (s) => s.receiverEmail && EMAIL_RE.test(s.receiverEmail)
        );
        const skipped = convoy.shipments
            .filter((s) => !s.receiverEmail || !EMAIL_RE.test(s.receiverEmail))
            .map((s) => ({ id: s.id, email: s.receiverEmail || "", reason: "email invalide" }));

// 2) envoi par petits lots (concurrence limitée)
        const CONCURRENCY = 5;
        const results: { id: string; email: string; ok: boolean; error?: string }[] = [];

        for (let i = 0; i < valid.length; i += CONCURRENCY) {
            const chunk = valid.slice(i, i + CONCURRENCY);
            const settles = await Promise.allSettled(
                chunk.map(async (s) => {
                    const res = await sendWithRetry({
                        from: FROM,
                        to: s.receiverEmail!,
                        subject,
                        text: `Bonjour ${s.receiverName},

Convoi du ${dateStr} — ${
                            enRoute ? "il est en route vers le Canada." : "il est arrivé à la douane au Canada."
                        }
Colis: ${s.trackingId}

${custom ?? ""}

— Équipe GN → CA`,
                        html: htmlTemplate({
                            receiverName: s.receiverName,
                            trackingId: s.trackingId,
                            dateStr,
                            enRoute,
                            custom,
                        }),
// reply_to: 'support@migralex.net', // si tu veux
                    });
                    return { id: s.id, email: s.receiverEmail!, ok: res.ok, error: (res as any)?.error?.message };
                })
            );

            settles.forEach((r, idx) => {
                const { id, email } = chunk[idx];
                if (r.status === "fulfilled") {
                    results.push(r.value);
                } else {
                    results.push({ id, email: email!, ok: false, error: String(r.reason) });
                }
            });

// petite pause pour ne pas heurter les limites
            await new Promise((r) => setTimeout(r, 150));
        }

        const failed = results.filter((r) => !r.ok);
        const sent = results.filter((r) => r.ok).length;

// 3) mise à jour de statut en masse
        await prisma.shipment.updateMany({
            where: { convoyId: convoy.id },
            data: { status: enRoute ? "IN_TRANSIT" : "IN_CUSTOMS" },
        });

        return NextResponse.json({
            ok: true,
            convoyDate: dateStr,
            sent,
            failed,
            skipped,
            total: convoy.shipments.length,
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Server error" },
            { status: 500 }
        );
    }
}