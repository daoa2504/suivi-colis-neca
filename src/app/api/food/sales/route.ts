// src/app/api/food/sales/route.ts
//
// GET  /api/food/sales?clientId=&lotId=   → liste (filtrable)
// POST /api/food/sales                     → crée une vente (client + lot + quantité)
//   Décrémente automatiquement lot.quantityRemaining.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Currency } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const lotId = url.searchParams.get("lotId") ?? undefined;

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (lotId) where.lotId = lotId;

    const sales = await prisma.foodSale.findMany({
        where,
        include: {
            client: { select: { id: true, customerCode: true, name: true } },
            lot: { select: { id: true, lotNumber: true, description: true } },
        },
        orderBy: { saleDate: "desc" },
        take: 500,
    });

    return NextResponse.json({ ok: true, sales });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = String(body.clientId ?? "").trim();
    const lotId = String(body.lotId ?? "").trim();
    const quantityKg = Number(body.quantityKg);
    const productDetails = body.productDetails ? String(body.productDetails).trim() : null;
    const saleDateRaw = body.saleDate;
    const priceNum = body.price !== undefined && body.price !== "" ? Number(body.price) : null;
    const currencyRaw = String(body.currency ?? "CAD").toUpperCase();
    const currency: Currency = currencyRaw === "XOF" ? "XOF" : "CAD";
    const notes = body.notes ? String(body.notes).trim() : null;

    // Validation
    if (!clientId) return NextResponse.json({ ok: false, error: "Client requis" }, { status: 400 });
    if (!lotId) return NextResponse.json({ ok: false, error: "Lot requis" }, { status: 400 });
    if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
        return NextResponse.json({ ok: false, error: "Quantité invalide (> 0)" }, { status: 400 });
    }
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
        return NextResponse.json({ ok: false, error: "Prix invalide" }, { status: 400 });
    }
    const saleDate = saleDateRaw ? new Date(saleDateRaw) : new Date();
    if (Number.isNaN(saleDate.getTime())) {
        return NextResponse.json({ ok: false, error: "Date de vente invalide" }, { status: 400 });
    }

    // Le client + le lot doivent exister
    const [client, lot] = await Promise.all([
        prisma.foodClient.findUnique({ where: { id: clientId } }),
        prisma.foodLot.findUnique({ where: { id: lotId } }),
    ]);
    if (!client) return NextResponse.json({ ok: false, error: "Client introuvable" }, { status: 404 });
    if (!lot) return NextResponse.json({ ok: false, error: "Lot introuvable" }, { status: 404 });

    // Vérifier qu'on ne vend pas plus que ce qui reste (soft-warning, on
    // laisse passer même en négatif — l'admin peut corriger).
    if (lot.quantityRemaining !== null && lot.quantityRemaining !== undefined) {
        if (quantityKg > lot.quantityRemaining) {
            // On log mais on laisse passer (l'admin peut avoir besoin de rattraper une saisie oubliée)
            console.warn(`[food-sale] vente ${quantityKg}kg > restant ${lot.quantityRemaining}kg sur ${lot.lotNumber}`);
        }
    }

    // Transaction : create sale + décrémenter quantityRemaining
    const sale = await prisma.$transaction(async (tx) => {
        const created = await tx.foodSale.create({
            data: {
                clientId,
                lotId,
                quantityKg,
                productDetails,
                saleDate,
                price: priceNum,
                currency,
                notes,
                createdById: session.user?.id ?? null,
            },
            include: {
                client: { select: { id: true, customerCode: true, name: true } },
                lot: { select: { id: true, lotNumber: true, description: true } },
            },
        });

        // Décrémenter quantityRemaining
        const currentRemaining = lot.quantityRemaining ?? lot.quantityKg;
        await tx.foodLot.update({
            where: { id: lotId },
            data: { quantityRemaining: currentRemaining - quantityKg },
        });

        return created;
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodSale",
        entityId: sale.id,
        action: "CREATE",
        after: {
            client: client.customerCode,
            lot: lot.lotNumber,
            quantityKg,
        },
    });

    return NextResponse.json({ ok: true, sale });
}
