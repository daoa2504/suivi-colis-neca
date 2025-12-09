// src/app/agent/ca/page.tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CAForm from "./CAForm";
import SendEmailButton from "./SendEmailButton";

export const runtime = "nodejs";

export default async function AgentCAPage() {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session || !["ADMIN", "AGENT_CA"].includes(role || "")) {
        redirect("/login");
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
            <div className="max-w-5xl mx-auto p-6">
                {/* Header avec bienvenue */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-l-4 border-red-600">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <img
                                    src="/flags/ca.svg"
                                    alt="Canada"
                                    className="w-12 h-8 object-cover rounded border-2 border-gray-200 shadow-sm"
                                />
                                <h1 className="text-3xl font-bold text-gray-800">
                                    Espace Agent Canada
                                </h1>
                            </div>
                            <p className="text-gray-600 text-lg">
                                Bienvenue <span className="font-semibold text-red-600">{session.user.username}</span> 👋
                            </p>
                        </div>

                        {/* ✅ Bouton seul à droite */}
                        <SendEmailButton />
                    </div>

                    {/* ✅ Description et badge en dessous */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-500">
                            Enregistrez les colis reçus au Canada à destination du Niger
                        </p>

                        <div className="flex items-center gap-2 bg-gradient-to-r from-red-100 to-orange-100 px-4 py-2 rounded-lg">
                            <div className="flex items-center gap-1.5">
                                <img
                                    src="/flags/ca.svg"
                                    alt="CA"
                                    className="w-6 h-4 object-cover rounded border border-gray-200"
                                />
                                <span className="text-sm font-semibold text-gray-700">Canada</span>
                            </div>
                            <span className="text-gray-400 text-lg">→</span>
                            <div className="flex items-center gap-1.5">
                                <img
                                    src="/flags/ne.svg"
                                    alt="NE"
                                    className="w-6 h-4 object-cover rounded border border-gray-200"
                                />
                                <span className="text-sm font-semibold text-gray-700">Niger</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Formulaire */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <CAForm />
                </div>
            </div>
        </main>
    );
}