// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessFood, canAccessShipping, isFoodOnly } from "@/lib/roles";

// Protège ces espaces : admin + agents + dashboard colis
export const config = {
    matcher: [
        "/admin/:path*",
        "/agent/ca/:path*",
        "/agent/ne/:path*",
        "/dashboard/:path*",
        "/ai-assistant/:path*",
    ],
};

export default async function middleware(req: NextRequest) {
    // ⚠️ Nécessite NEXTAUTH_SECRET dans tes variables d'env
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const url = new URL(req.url);

    // Pas connecté → redirection login
    if (!token) {
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    const role = token.role as string;

    // --- Module Marchandises : ADMIN + AGENT_MARCHANDISE ---
    if (url.pathname.startsWith("/admin/food")) {
        if (!canAccessFood(role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.next();
    }

    // --- Reste de l'admin : ADMIN uniquement ---
    // L'agent marchandises est renvoyé vers son module plutôt que de recevoir un 403,
    // car il peut arriver là par un lien de navigation partagé.
    if (url.pathname.startsWith("/admin")) {
        if (isFoodOnly(role)) {
            url.pathname = "/admin/food";
            return NextResponse.redirect(url);
        }
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
    }

    // --- Espaces colis : jamais accessibles à l'agent marchandises ---
    if (url.pathname.startsWith("/agent/ca") && !["ADMIN", "AGENT_CA"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (url.pathname.startsWith("/agent/ne") && !["ADMIN", "AGENT_NE"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (url.pathname.startsWith("/dashboard") && !canAccessShipping(role)) {
        if (isFoodOnly(role)) {
            url.pathname = "/admin/food";
            return NextResponse.redirect(url);
        }
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (url.pathname.startsWith("/ai-assistant") && !canAccessShipping(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
}
