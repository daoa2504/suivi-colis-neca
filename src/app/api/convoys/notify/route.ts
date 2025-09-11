import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { notifyConvoySchema } from "@/lib/validators";
import { sendEmailSafe, FROM } from "@/lib/email";

export const runtime = "nodejs";

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "AGENT_CA"].includes(session.user.role))
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const parsed = notifyConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
        }

        const convoyDate = new Date(parsed.data.convoyDate as any);
        const template = parsed.data.template;
        const custom = parsed.data.customMessage;

        const convoy = await prisma.convoy.findUnique({
            where: { date: convoyDate },
            include: {
                shipments: {
                    select: {
                        id: true, trackingId: true, receiverName: true, receiverEmail: true,
                    },
                },
            },
        });

        if (!convoy || convoy.shipments.length === 0) {
            return NextResponse.json({ ok: false, error: "Aucun colis pour ce convoi" }, { status: 404 });
        }

        const dateStr = convoy.date.toLocaleDateString("fr-CA");
        const subject =
            template === "EN_ROUTE"
                ? "Votre convoi est en route vers le Canada"
                : "Votre convoi est arrivé à la douane (Canada)";

// 1) déduplication + filtrage d’emails vides
        const unique = new Map<string, { id: string; trackingId: string; receiverName: string }>();
        for (const s of convoy.shipments) {
            const email = (s.receiverEmail || "").trim().toLowerCase();
            if (!email) continue;
            if (!unique.has(email)) unique.set(email, { id: s.id, trackingId: s.trackingId, receiverName: s.receiverName });
        }
        const list = Array.from(unique.entries()); // [ [email, meta], ... ]

        if (list.length === 0) {
            return NextResponse.json({ ok: false, error: "Aucun email valide" }, { status: 400 });
        }

// 2) envoi en CHUNKS, p.ex. 40 emails puis petite pause
        const BATCH = 40;
        const chunks = chunk(list, BATCH);

        type Result = { email: string; ok: boolean; error?: string; id?: string };
        // ...
// list = Array<[email, { id, trackingId, receiverName }]> (déjà dédupliqué)

        const results: { email: string; ok: boolean; error?: string; id?: string }[] = [];

        for (const [email, meta] of list) {
            const text = `Bonjour ${meta.receiverName},

Convoi du ${dateStr} — ${
                template === "EN_ROUTE" ? "il est en route vers le Canada." : "il est arrivé à la douane au Canada."
            }
Colis: ${meta.trackingId}

${custom ?? ""}

— Équipe GN → CA`;

            const r = await sendEmailSafe({
                from: FROM,
                to: email,
                subject,
                text,
            });

            results.push(r.ok ? { email, ok: true, id: r.id } : { email, ok: false, error: r.error });

            // petite pause 400 ms pour être 100% safe vis-à-vis du throttling
            await new Promise(res => setTimeout(res, 400));
        }

// puis retourne le rapport comme avant
        const sent = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok);
        return NextResponse.json({
            ok: true,
            totalRecipients: list.length,
            sent,
            failedCount: failed.length,
            failed,
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}