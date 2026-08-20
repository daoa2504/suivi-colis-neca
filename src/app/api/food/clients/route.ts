// src/app/api/food/clients/route.ts
//
// GET  /api/food/clients?q=&active=true    → liste (filtrable)
// POST /api/food/clients                    → création

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const activeParam = url.searchParams.get("active");
    const activeFilter: boolean | undefined =
        activeParam === "true" ? true : activeParam === "false" ? false : undefined;

    const where: any = {};
    if (activeFilter !== undefined) where.active = activeFilter;
    if (q) {
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { city: { contains: q, mode: "insensitive" } },
        ];
    }

    const clients = await prisma.foodClient.findMany({
        where,
        orderBy: { name: "asc" },
        take: 500,
    });

    return NextResponse.json({ ok: true, clients });
}

/** Génère le prochain code client au format FCL-YYYY-NNNN, séquentiel par année. */
async function nextCustomerCode(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `FCL-${year}-`;
    const last = await prisma.foodClient.findFirst({
        where: { customerCode: { startsWith: prefix } },
        orderBy: { customerCode: "desc" },
        select: { customerCode: true },
    });
    let seq = 1;
    if (last?.customerCode) {
        const parts = last.customerCode.split("-");
        const n = parseInt(parts[2] ?? "0", 10);
        if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name || name.length < 2) {
        return NextResponse.json({ ok: false, error: "Nom requis (min. 2 caractères)" }, { status: 400 });
    }

    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "Email invalide" }, { status: 400 });
    }

    const customerCode = await nextCustomerCode();

    const client = await prisma.foodClient.create({
        data: {
            customerCode,
            name,
            email,
            phone: body.phone ? String(body.phone).trim() : null,
            address: body.address ? String(body.address).trim() : null,
            city: body.city ? String(body.city).trim() : null,
            province: body.province ? String(body.province).trim() : null,
            postalCode: body.postalCode ? String(body.postalCode).trim() : null,
            country: body.country ? String(body.country).trim() : "Canada",
            notes: body.notes ? String(body.notes).trim() : null,
        },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "FoodClient",
        entityId: client.id,
        action: "CREATE",
        after: { name: client.name, email: client.email },
    });

    return NextResponse.json({ ok: true, client });
}
