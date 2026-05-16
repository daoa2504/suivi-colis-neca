// src/app/admin/expenses/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExpensesManager from "./ExpensesManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
    return new Date(d).toISOString().slice(0, 10);
}

export default async function ExpensesPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const [expenses, convoys] = await Promise.all([
        prisma.expense.findMany({
            orderBy: { date: "desc" },
            include: { convoy: { select: { id: true, date: true, direction: true } } },
        }),
        prisma.convoy.findMany({
            orderBy: { date: "desc" },
            take: 50,
            select: { id: true, date: true, direction: true },
        }),
    ]);

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="mb-6">
                <Link
                    href="/admin/finances"
                    className="text-sm text-blue-600 hover:underline"
                >
                    ← Retour à la trésorerie
                </Link>
                <h1 className="text-2xl font-bold mt-2">💸 Dépenses</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Saisir et gérer les salaires, dédouanement, emballage, carburant, etc.
                </p>
            </div>

            <ExpensesManager
                initialExpenses={expenses.map((e) => ({
                    id: e.id,
                    category: e.category as any,
                    subcategory: e.subcategory,
                    amount: e.amount,
                    currency: e.currency as any,
                    date: fmtDate(e.date),
                    convoyId: e.convoyId,
                    convoyLabel: e.convoy ? `${fmtDate(e.convoy.date)} (${e.convoy.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"})` : null,
                    notes: e.notes,
                }))}
                convoys={convoys.map((c) => ({
                    id: c.id,
                    label: `${fmtDate(c.date)} (${c.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA"})`,
                }))}
            />
        </main>
    );
}
