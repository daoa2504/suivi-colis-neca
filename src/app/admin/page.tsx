import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN") {
        redirect("/");
    }

    return (
        <main className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Dashboard Admin</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                    href="/admin/convoys"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">🚚</div>
                    <h2 className="font-semibold text-lg mb-1">Gestion des convois</h2>
                    <p className="text-sm text-gray-600">
                        Créer, lister et supprimer les convois. Les agents ne peuvent enregistrer
                        que sur des convois existants.
                    </p>
                </Link>
                <Link
                    href="/dashboard/shipments"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">📦</div>
                    <h2 className="font-semibold text-lg mb-1">Tous les colis</h2>
                    <p className="text-sm text-gray-600">
                        Voir et gérer tous les colis (NE→CA et CA→NE).
                    </p>
                </Link>
                <Link
                    href="/dashboard/notify"
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all"
                >
                    <div className="text-3xl mb-2">📧</div>
                    <h2 className="font-semibold text-lg mb-1">Notifications convoi</h2>
                    <p className="text-sm text-gray-600">
                        Envoyer les emails "en route", "douane", "prêt à récupérer".
                    </p>
                </Link>
            </div>
        </main>
    );
}