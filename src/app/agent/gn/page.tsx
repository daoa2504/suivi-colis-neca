// src/app/agent/gn/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import GNForm from "./GNForm";

export default async function GNPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (!["ADMIN", "AGENT_GN"].includes(session.user.role))
        return <main className="p-6">403</main>;

    return (
        <main className="p-6">
            <GNForm />
        </main>
    );
}
