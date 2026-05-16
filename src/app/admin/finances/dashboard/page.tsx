// src/app/admin/finances/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import FinanceDashboard from "./FinanceDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FinanceDashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <Link href="/admin/finances" className="text-sm text-blue-600 hover:underline">
                    ← Retour à la trésorerie
                </Link>
                <h1 className="text-2xl font-bold mt-2">📊 Dashboard trésorerie</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Entrées (paiements clients) vs sorties (dépenses). Conversion auto via les
                    taux de change.
                </p>
            </div>

            <FinanceDashboard />
        </main>
    );
}
