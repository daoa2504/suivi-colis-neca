// src/app/admin/finances/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FinancesPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">💰 Trésorerie</h1>
            <p className="text-sm text-gray-600 mb-6">
                Suivi des paiements clients (entrées) et des dépenses (sorties).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Link
                    href="/admin/expenses"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-red-400 transition-all"
                >
                    <div className="text-3xl mb-2">💸</div>
                    <h2 className="font-semibold text-lg mb-1">Dépenses</h2>
                    <p className="text-sm text-gray-600">
                        Saisir et gérer les salaires, dédouanement, frais d'expédition…
                    </p>
                </Link>

                <Link
                    href="/admin/finances/dashboard"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">📊</div>
                    <h2 className="font-semibold text-lg mb-1">Dashboard</h2>
                    <p className="text-sm text-gray-600">
                        Graphes entrées / sorties (mensuel ou par convoi).
                    </p>
                </Link>

                <div className="block p-6 bg-white rounded-lg border shadow-sm">
                    <div className="text-3xl mb-2">🔄</div>
                    <h2 className="font-semibold text-lg mb-1">Taux de change</h2>
                    <ForexBadge />
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-900">
                ⚙️ Module en cours de construction. Les pages Dépenses et Dashboard arrivent
                dans les prochaines mises à jour.
            </div>
        </main>
    );
}

async function ForexBadge() {
    try {
        const { getRate } = await import("@/lib/forex");
        const rate = await getRate("CAD", "XOF");
        return (
            <div className="space-y-1">
                <p className="text-sm text-gray-700">
                    <strong>1 CAD</strong> = <span className="text-blue-600 font-semibold">{rate.toFixed(2)} XOF</span>
                </p>
                <p className="text-xs text-gray-500">
                    Source : frankfurter.app (BCE) · cache 24h
                </p>
            </div>
        );
    } catch (e: any) {
        return (
            <p className="text-xs text-red-600">
                Erreur de récupération du taux : {e?.message ?? "inconnue"}
            </p>
        );
    }
}
