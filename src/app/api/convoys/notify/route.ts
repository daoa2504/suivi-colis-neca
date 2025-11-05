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

function subjectFor(
    template: "EN_ROUTE" | "ARRIVED",
    direction: DirectionEnum,
    dateStr: string
) {
    const dirStr = direction === DirectionEnum.NE_TO_CA ? "NE → CA" : "CA → NE";
    const statusStr = template === "EN_ROUTE" ? "en route" : "arrivé à la douane";
    return `Convoi du ${dateStr} • ${dirStr} • ${statusStr}`;
}

function statusSentence(
    template: "EN_ROUTE" | "ARRIVED",
    direction: DirectionEnum
) {
    if (template === "EN_ROUTE") {
        return direction === DirectionEnum.NE_TO_CA
            ? "ils sont en route vers le Canada."
            : "ils sont en route vers le Niger.";
    }
    // ARRIVED
    return direction === DirectionEnum.NE_TO_CA
        ? "ils sont arrivés à la douane (Canada)."
        : "ils sont arrivés à la douane (Niger).";
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

        const { convoyDate, template, customMessage, direction } = parsed.data;

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

        // ---------- Dédup + Groupage par destinataire ----------
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

        // Base URL pour le logo
        const BASE_URL =
            process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.APP_URL ||
            "https://nimaplex.com";

        const results: { email: string; ok: boolean; error?: string; id?: string }[] = [];

        // ---------- Envoi séquentiel : un mail par destinataire (groupé) ----------
        for (const [email, { name, ids }] of grouped.entries()) {
            const colisListText = ids.map((t) => `• ${t}`).join("\n");
            const txt = `Bonjour ${name},

Convoi du ${dateStr} — ${statusSentence(template as "EN_ROUTE" | "ARRIVED", direction)}
Colis (${ids.length}) :
${colisListText}

${customMessage ?? ""}

${FOOTER}`;

            const html = `
<div style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
  <p>Bonjour <strong>${name}</strong>,</p>
  <p>Convoi du <strong>${dateStr}</strong> — ${statusSentence(template as "EN_ROUTE" | "ARRIVED", direction)}</p>
  <p><strong> Vous aviez  ${ids.length} colis :</strong><br>${ids.map((t) => `• ${t}`).join("<br>")}</p>
  ${customMessage ? `<p>${customMessage}</p>` : ""}
  <p>${FOOTER.replace("— ", "— ")}</p>

  <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;" />
  <table role="presentation" style="border-collapse:collapse;border-spacing:0;margin-top:6px;">
    <tr>
      <td style="padding:0;">
        <img src="https://nimaplex.com/img.png" width="55" height="55" style="display:block;border-radius:6px;" alt="NIMAPLEX" />
      </td><td style="padding:0 0 0 6px;line-height:1.25;">
        <div style="font-weight:bold;color:#8B0000;font-size:15px;">NIMAPLEX</div>
        <div style="font-size:12.5px;color:#555;">Plus qu’une solution, un service d’excellence global</div>
      </td>
    </tr>
  </table>
</div>`.trim();

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: email,
                    subject: subjectFor(template as "EN_ROUTE" | "ARRIVED", direction, dateStr),
                    text: txt,
                    html,
                });
                results.push(resp.ok ? { email, ok: true, id: resp.id } : { email, ok: false, error: resp.error });
            } catch (e: any) {
                results.push({ email, ok: false, error: e?.message || String(e) });
            }

            // Petite pause anti rate-limit (ajuste selon provider)
            await sleep(900);
        }

        const sent = results.filter((x) => x.ok).length;
        const failed = results.filter((x) => !x.ok);

        return NextResponse.json({
            ok: true,
            convoyId: convoy.id,
            totalShipments: convoy.shipments.length, // nb de colis
            uniqueRecipients: grouped.size,          // nb d'emails uniques
            sent,
            failedCount: failed.length,
            failed,                                   // [{ email, ok:false, error }]
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
