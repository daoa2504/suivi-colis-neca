// src/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { homePathForRole } from "@/lib/roles";

export default async function HomePage() {
    const session = await getServerSession(authOptions);

    // Visiteur non connecté (clients) → page publique de suivi
    if (!session) redirect("/track");

    // Personnel connecté → tableau de bord selon le rôle
    redirect(homePathForRole(session.user.role));
}
