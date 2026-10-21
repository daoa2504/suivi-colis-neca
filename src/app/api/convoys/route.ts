// src/app/api/convoys/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

function startOfDayUTC(input: string | Date) {
    const d = new Date(input);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}


// Tarif au kilo, facultatif. Vide ou 0 = pas de tarif, l'agent saisit le
// montant à la main comme avant.
const pricePerKgField = z.preprocess(
    (v) => {
        if (v === "" || v === null || v === undefined) return null;
        const n = Number(String(v).replace(",", "."));
        return Number.isFinite(n) ? n : v;
    },
    z.number().min(0).max(10_000_000).nullable()
);
const createConvoySchema = z.object({
    date: z.union([z.string(), z.date()]),
    direction: z.enum(["NE_TO_CA", "CA_TO_NE"]),
    pricePerKg: pricePerKgField.optional(),
});

// POST /api/convoys — ADMIN uniquement, crée un convoi à l'avance
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = createConvoySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const date = startOfDayUTC(parsed.data.date);

        // Vérifier unicité (date + direction)
        const existing = await prisma.convoy.findUnique({
            where: { date_direction: { date, direction: parsed.data.direction } },
        });

        if (existing) {
            return NextResponse.json(
                { ok: false, error: "Un convoi existe déjà pour cette date et direction" },
                { status: 409 }
            );
        }

        const convoy = await prisma.convoy.create({
            data: {
                date,
                direction: parsed.data.direction,
                // 0 et vide valent « pas de tarif » : on ne stocke pas un zéro
                // qui se lirait ensuite comme un transport gratuit.
                pricePerKg: parsed.data.pricePerKg ? parsed.data.pricePerKg : null,
            },
        });

        return NextResponse.json({
            ok: true,
            convoy: {
                id: convoy.id,
                date: convoy.date,
                direction: convoy.direction,
                pricePerKg: convoy.pricePerKg,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
