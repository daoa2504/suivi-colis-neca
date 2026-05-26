// src/app/admin/custom-email/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import CustomEmailLauncher from "./CustomEmailLauncher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminCustomEmailPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    return (
        <main className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← Retour au dashboard admin
                </Link>
                <h1 className="text-2xl font-bold mt-2">✉️ Email personnalisé aux clients</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez une direction et/ou un convoi, choisissez les destinataires et envoyez
                    un message personnalisé (retard, info exceptionnelle, etc.).
                </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-900">
                <p className="font-semibold mb-1">💡 Cas d'usage typique</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>
                        <strong>Annonce de retard</strong> sur un convoi bloqué (ex: colis CA → NE bloqués à
                        Casablanca)
                    </li>
                    <li>
                        <strong>Information importante</strong> à tous les clients d'une direction
                    </li>
                    <li>
                        <strong>Excuse / communication exceptionnelle</strong>
                    </li>
                </ul>
                <p className="mt-2">
                    Astuce : utilise <code className="bg-amber-100 px-1 rounded">{"{receiverName}"}</code> et{" "}
                    <code className="bg-amber-100 px-1 rounded">{"{trackingId}"}</code> dans le message pour le
                    personnaliser.
                </p>
            </div>

            <CustomEmailLauncher />
        </main>
    );
}
