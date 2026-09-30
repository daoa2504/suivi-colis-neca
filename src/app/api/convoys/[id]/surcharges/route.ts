// src/app/api/convoys/[id]/surcharges/route.ts
//
// Suppléments de ville d'un convoi : montant ajouté à la facture des seuls
// clients de la ville visée (livraison vers Québec, par exemple).
//
// Ils ne s'appliquent qu'aux factures générées APRÈS leur configuration :
// une facture émise est un instantané comptable, on ne la réécrit pas.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
    city: z.string().trim().min(1, "Ville requise").max(80),
    amount: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."))),
        z.number().positive("Montant doit être positif").max(100000)
    ),
    currency: z.enum(["CAD", "XOF"]).default("CAD"),
    label: z.string().trim().max(120).optional().nullable(),
});

async function requireAdmin() {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") return null;
    return session;
}

// GET — liste des suppléments du convoi
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const surcharges = await prisma.convoySurcharge.findMany({
        where: { convoyId: id },
        orderBy: { city: "asc" },
    });

    return NextResponse.json({
        ok: true,
        surcharges: surcharges.map((s) => ({ ...s, amount: Number(s.amount) })),
    });
}

// POST — ajoute ou met à jour le supplément d'une ville
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const convoy = await prisma.convoy.findUnique({ where: { id } });
    if (!convoy) {
        return NextResponse.json({ ok: false, error: "Convoi introuvable" }, { status: 404 });
    }

    const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json(
            { ok: false, error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { city, amount, currency, label } = parsed.data;

    // Une ville, un supplément par convoi : saisir deux fois la même ville
    // remplace le montant plutôt que d'empiler deux lignes de facture.
    const saved = await prisma.convoySurcharge.upsert({
        where: { convoyId_city: { convoyId: id, city } },
        update: { amount: new Prisma.Decimal(amount), currency, label: label || null },
        create: {
            convoyId: id,
            city,
            amount: new Prisma.Decimal(amount),
            currency,
            label: label || null,
        },
    });

    return NextResponse.json({ ok: true, surcharge: { ...saved, amount: Number(saved.amount) } });
}

// DELETE — retire le supplément d'une ville (?surchargeId=...)
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const surchargeId = new URL(req.url).searchParams.get("surchargeId");
    if (!surchargeId) {
        return NextResponse.json({ ok: false, error: "surchargeId requis" }, { status: 400 });
    }

    // Le convoyId est dans le filtre : on ne supprime pas le supplément d'un
    // autre convoi par un identifiant deviné.
    const { count } = await prisma.convoySurcharge.deleteMany({
        where: { id: surchargeId, convoyId: id },
    });

    if (count === 0) {
        return NextResponse.json({ ok: false, error: "Supplément introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}
