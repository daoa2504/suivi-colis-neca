// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function AdminPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") return <main className="p-6">403</main>;

    return (
        <main className="p-6">
            <h1 className="text-xl font-bold mb-2">Dashboard Admin</h1>
            <ul className="list-disc ml-5 space-y-2">
                <li><a className="underline" href="/agent/gn">Espace Agent Guinée</a></li>
                <li><a className="underline" href="/agent/ca">Espace Agent Canada</a></li>
            </ul>
        </main>
    );
}
