import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import GNForm from "@/app/agent/gn/GNForm";

export default async function AgentGNPage() {
    const session = await getServerSession(authOptions);

    // si pas connecté → redirection login
    if (!session) {
        redirect("/login");
    }

    // si connecté mais pas le bon rôle → optionnel : redirection accueil
    if (session.user.role !== "AGENT_GN" && session.user.role !== "ADMIN") {
        redirect("/");
    }

    return (
        <main className="p-6">
            <h1 className="text-2xl font-bold">Espace Agent Guinée</h1>
            <p>Bienvenue {session.user.email}</p>
            <GNForm/>
        </main>
    );
}