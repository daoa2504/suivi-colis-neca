// src/app/agent/ca/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import CANotifyForm from "./CANotifyForm";

export default async function CAPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (!["ADMIN", "AGENT_CA"].includes(session.user.role))
        return <main className="p-6">403</main>;

    return (
        <main className="p-6">
            <CANotifyForm />
        </main>
    );
}
