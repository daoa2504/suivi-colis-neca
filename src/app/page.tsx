// src/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
    const session = await getServerSession(authOptions);

    // Visiteur non connecté (clients) → page publique de suivi
    if (!session) redirect("/track");

    // Personnel connecté → tableau de bord selon le rôle
    const role = session.user.role;
    if (role === "ADMIN") redirect("/admin");
    if (role === "AGENT_CA") redirect("/agent/ca");
    if (role === "AGENT_NE") redirect("/agent/ne");

    // fallback
    redirect("/track");
}
