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

const createConvoySchema = z.object({
    date: z.union([z.string(), z.date()]),
    direction: z.enum(["NE_TO_CA", "CA_TO_NE"]),
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
            data: { date, direction: parsed.data.direction },
        });

        return NextResponse.json({
            ok: true,
            convoy: { id: convoy.id, date: convoy.date, direction: convoy.direction },
        });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
    }
}
