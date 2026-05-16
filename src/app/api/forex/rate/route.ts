// src/app/api/forex/rate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRate } from "@/lib/forex";

export const runtime = "nodejs";

// GET /api/forex/rate?from=CAD&to=XOF
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = (searchParams.get("from") || "CAD").toUpperCase();
    const to = (searchParams.get("to") || "XOF").toUpperCase();

    if (!["CAD", "XOF"].includes(from) || !["CAD", "XOF"].includes(to)) {
        return NextResponse.json(
            { ok: false, error: "Devises supportées : CAD, XOF" },
            { status: 400 }
        );
    }

    try {
        const rate = await getRate(from as any, to as any);
        return NextResponse.json({
            ok: true,
            from,
            to,
            rate,
            fetchedAt: new Date().toISOString(),
        });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message ?? "Erreur taux" },
            { status: 500 }
        );
    }
}
