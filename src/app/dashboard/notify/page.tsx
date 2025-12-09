// src/app/dashboard/notify/page.tsx
import NotifyByConvoyForm from "./NotifyByConvoyForm";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

type SearchParams = {
    direction?: string;
};

// ✅ IMPORTANT : export default
export default async function Page({
                                       searchParams,
                                   }: {
    searchParams: Promise<SearchParams>;
}) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as "ADMIN" | "AGENT_NE" | "AGENT_CA" | undefined;

    if (!session || !["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role ?? "")) {
        redirect("/login");
    }

    const sp = await searchParams;
    let direction = (sp.direction === "CA_TO_NE" ? "CA_TO_NE" : "NE_TO_CA") as "NE_TO_CA" | "CA_TO_NE";

    if (role === "AGENT_NE") {
        direction = "CA_TO_NE";
    }

    const directionLabel = direction === "NE_TO_CA" ? "Niger → Canada" : "Canada → Niger";
    const canSwitchDirection = role === "ADMIN" || role === "AGENT_CA";

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-6">
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        Notifier un convoi — {directionLabel}
                    </h1>

                    {canSwitchDirection && (
                        <div className="flex gap-2 border-b mb-6">
                            <Link
                                href="/dashboard/notify?direction=NE_TO_CA"
                                className={`px-4 py-2 ${
                                    direction === "NE_TO_CA"
                                        ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                                        : "text-gray-600 hover:text-gray-800"
                                }`}
                            >
                                Niger → Canada
                            </Link>
                            <Link
                                href="/dashboard/notify?direction=CA_TO_NE"
                                className={`px-4 py-2 ${
                                    direction === "CA_TO_NE"
                                        ? "border-b-2 border-blue-600 font-semibold text-blue-600"
                                        : "text-gray-600 hover:text-gray-800"
                                }`}
                            >
                                Canada → Niger
                            </Link>
                        </div>
                    )}

                    {role === "AGENT_NE" && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
                            <p className="text-sm text-blue-800">
                                ℹ️ En tant qu'agent Niger, vous pouvez uniquement notifier les convois <strong>Canada → Niger</strong>.
                            </p>
                        </div>
                    )}

                    <NotifyByConvoyForm direction={direction} />
                </div>
            </div>
        </main>
    );
}
