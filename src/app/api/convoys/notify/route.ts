// src/app/api/convoys/notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FROM, sendEmailSafe } from "@/lib/email";
import { notifyConvoySchema } from "@/lib/validators";
import { Direction as DirectionEnum } from "@prisma/client";
import { getEmailContent, getEmailSubject, type ConvoyStatus, type Direction } from "@/lib/emailTemplates";

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

/* ----------------------------- Helper pour convertir Direction ----------------------------- */

function toEmailDirection(prismaDir: DirectionEnum): Direction {
    return prismaDir === DirectionEnum.NE_TO_CA ? "NE_TO_CA" : "CA_TO_NE";
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

        const { convoyDate, template, customMessage, direction, pickupCity } = parsed.data;

        // Règles d'accès
        if (role === "AGENT_NE" && direction !== DirectionEnum.CA_TO_NE) {
            return NextResponse.json(
                { ok: false, error: "AGENT_NE ne peut notifier que CA_TO_NE" },
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
                        receiverCity: true,  // ✅ ON A BESOIN DE receiverCity POUR FILTRER
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

        // ✅ FILTRER LES COLIS SELON LA VILLE SÉLECTIONNÉE (seulement pour OUT_FOR_DELIVERY)
        let shipmentsToNotify = convoy.shipments;

        if (template === "OUT_FOR_DELIVERY" && pickupCity) {
            // Normaliser la ville pour la comparaison
            const normalizedPickupCity = pickupCity.trim().toLowerCase();

            // Si "Autre" est sélectionné, prendre tous les colis qui ne sont PAS dans les 3 villes principales
            if (pickupCity === "Autre") {
                shipmentsToNotify = convoy.shipments.filter(s => {
                    const city = (s.receiverCity || "").trim().toLowerCase();
                    return city !== "sherbrooke" && city !== "québec" && city !== "quebec" && city !== "montréal" && city !== "montreal";
                });
                console.log(`📦 Filtrage "Autre ville": ${shipmentsToNotify.length} colis trouvés`);
            } else {
                // Filtrer pour la ville spécifique
                shipmentsToNotify = convoy.shipments.filter(s => {
                    const city = (s.receiverCity || "").trim().toLowerCase();
                    // Gérer les variations d'orthographe
                    if (normalizedPickupCity === "québec") {
                        return city === "québec" || city === "quebec";
                    }
                    if (normalizedPickupCity === "montréal") {
                        return city === "montréal" || city === "montreal";
                    }
                    return city === normalizedPickupCity;
                });
                console.log(`📦 Filtrage pour "${pickupCity}": ${shipmentsToNotify.length} colis trouvés sur ${convoy.shipments.length} total`);
            }
        }

        if (!shipmentsToNotify.length) {
            return NextResponse.json(
                {
                    ok: false,
                    error: `Aucun colis trouvé pour la ville "${pickupCity}"`,
                    totalShipments: convoy.shipments.length,
                    filteredShipments: 0
                },
                { status: 404 }
            );
        }

        const dateStr = convoy.date.toLocaleDateString("fr-CA", { timeZone: "UTC" });
        const emailDirection = toEmailDirection(direction);

        const results: { email: string; ok: boolean; error?: string; id?: string; trackingIds?: string[] }[] = [];

        // ========== Groupement par EMAIL ==========
        type RecipientGroup = { name: string; ids: string[] };
        const grouped = new Map<string, RecipientGroup>();
        const invalidEmails: Array<{ emailRaw: string; id: number; trackingId: string }> = [];

        // ✅ UTILISER shipmentsToNotify AU LIEU DE convoy.shipments
        for (const s of shipmentsToNotify) {
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
                grouped.set(email, {
                    name: s.receiverName,
                    ids: [s.trackingId]
                });
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
            // 🔍 LOG POUR DÉBOGUER
            console.log("=== ENVOI EMAIL ===");
            console.log("Email:", email);
            console.log("Ville de cueillette:", pickupCity);
            console.log("Tracking IDs:", ids);
            console.log("==================");

            // ✅ UTILISATION DE pickupCity du formulaire
            const { subject, text, html } = getEmailContent(
                template as ConvoyStatus,
                emailDirection,
                name,
                ids,
                dateStr,
                customMessage,
                pickupCity
            );

            try {
                const resp = await sendWithRetry({
                    from: FROM,
                    to: email,
                    subject,
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
            filteredShipments: shipmentsToNotify.length,  // ✅ NOMBRE DE COLIS FILTRÉS
            uniqueRecipients: grouped.size,
            pickupCity: pickupCity || "Tous",  // ✅ VILLE SÉLECTIONNÉE
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