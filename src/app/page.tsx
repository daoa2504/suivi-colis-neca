// src/app/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
    const session = await getServerSession(authOptions);

    if (!session) redirect("/login");

    const role = session.user.role;
    if (role === "ADMIN") redirect("/admin");
    if (role === "AGENT_CA") redirect("/agent/ca");
    if (role === "AGENT_GN") redirect("/agent/gn");

    // fallback (ne devrait pas arriver)
    return <main className="p-6">Rôle inconnu</main>;
}
