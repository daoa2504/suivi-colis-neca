// src/app/agent/ne/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import GNForm from "@/app/agent/ne/GNForm";

export default async function AgentGNPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "AGENT_NE" && session.user.role !== "ADMIN") {
        redirect("/");
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
            <div className="max-w-5xl mx-auto p-6">
                {/* Header avec bienvenue */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6 border-l-4 border-orange-500">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <img
                                    src="/flags/ne.svg"
                                    alt="Niger"
                                    className="w-12 h-8 object-cover rounded border-2 border-gray-200 shadow-sm"
                                />
                                <h1 className="text-3xl font-bold text-gray-800">
                                    Espace Agent Niger
                                </h1>
                            </div>
                            <p className="text-gray-600 text-lg">
                                Bienvenue <span className="font-semibold text-orange-600">{session.user.username}</span> 👋
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                Enregistrez les colis reçus au Niger à destination du Canada
                            </p>
                        </div>

                        {/* Option 2 - Drapeaux collés aux noms */}
                        <div className="flex items-center gap-2 bg-gradient-to-r from-orange-100 to-green-100 px-4 py-2 rounded-lg">
                            <div className="flex items-center gap-1.5">
                                <img
                                    src="/flags/ne.svg"
                                    alt="NE"
                                    className="w-6 h-4 object-cover rounded border border-gray-200"
                                />
                                <span className="text-sm font-semibold text-gray-700">Niger</span>
                            </div>
                            <span className="text-gray-400 text-lg">→</span>
                            <div className="flex items-center gap-1.5">
                                <img
                                    src="/flags/ca.svg"
                                    alt="CA"
                                    className="w-6 h-4 object-cover rounded border border-gray-200"
                                />
                                <span className="text-sm font-semibold text-gray-700">Canada</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Formulaire */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <GNForm />
                </div>
            </div>
        </main>
    );
}