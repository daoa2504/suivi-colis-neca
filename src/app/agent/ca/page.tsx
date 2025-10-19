// src/app/agent/ca/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CAForm from "./CAForm";

export const runtime = "nodejs";

export default async function AgentCAPage() {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session || !["ADMIN", "AGENT_CA"].includes(role || "")) redirect("/login");

    return (
        <main className="container-page">
            <div className="card">
                <h1 className="title">Réception — Agent Canada (départ vers Guinée)</h1>
                <p className="text-sm text-neutral-600">
                    Enregistrer un colis reçu au Canada (convoi CA → GN). Un email sera envoyé au destinataire en Guinée.
                </p>
                <CAForm />
            </div>
        </main>
    );
}
