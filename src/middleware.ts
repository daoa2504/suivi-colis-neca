// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protège ces espaces : admin + agents
export const config = {
    matcher: ["/admin/:path*", "/agent/ca/:path*", "/agent/ne/:path*"],
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

    const role = token.role as "ADMIN" | "AGENT_CA" | "AGENT_NE";

    // RBAC simple selon le chemin
    if (url.pathname.startsWith("/admin") && role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (url.pathname.startsWith("/agent/ca") && !["ADMIN", "AGENT_CA"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (url.pathname.startsWith("/agent/ne") && !["ADMIN", "AGENT_NE"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next();
}
