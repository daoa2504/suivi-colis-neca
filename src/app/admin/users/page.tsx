// src/app/admin/users/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import UsersList from "./UsersList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const users = await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { username: "asc" }],
        include: {
            _count: {
                select: {
                    shipmentsCreated: true,
                    paymentsCreated: true,
                    expensesCreated: true,
                    notificationsSent: true,
                },
            },
            shipmentsCreated: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
            },
            notificationsSent: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
            },
        },
    });

    const formatted = users.map((u) => {
        const dates = [
            u.shipmentsCreated[0]?.createdAt,
            u.notificationsSent[0]?.createdAt,
        ].filter(Boolean) as Date[];
        const lastActivity = dates.length > 0
            ? new Date(Math.max(...dates.map((d) => new Date(d).getTime())))
            : null;
        return {
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            shipmentsCount: u._count.shipmentsCreated,
            paymentsCount: u._count.paymentsCreated,
            expensesCount: u._count.expensesCreated,
            notificationsCount: u._count.notificationsSent,
            lastActivity: lastActivity?.toISOString() ?? null,
        };
    });

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← Retour au dashboard admin
                </Link>
                <h1 className="text-2xl font-bold mt-2">👥 Gestion des utilisateurs</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Liste des utilisateurs avec l'activité de chacun. Clic sur un utilisateur pour voir
                    le détail (colis créés, paiements enregistrés, notifications envoyées).
                </p>
            </div>

            <UsersList initialUsers={formatted} />
        </main>
    );
}
