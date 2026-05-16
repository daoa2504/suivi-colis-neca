import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ConvoysManager from "./ConvoysManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
    const date = new Date(d);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export default async function AdminConvoysPage({
    searchParams,
}: {
    searchParams: Promise<{ direction?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;
    const direction: "NE_TO_CA" | "CA_TO_NE" =
        sp.direction === "CA_TO_NE" ? "CA_TO_NE" : "NE_TO_CA";

    const convoys = await prisma.convoy.findMany({
        where: { direction },
        include: { _count: { select: { shipments: true } } },
        orderBy: { date: "desc" },
        take: 100,
    });

    const formatted = convoys.map((c) => ({
        id: c.id,
        date: fmtDate(c.date),
        direction: c.direction as "NE_TO_CA" | "CA_TO_NE",
        totalShipments: c._count.shipments,
    }));

    return (
        <main className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">Gestion des convois</h1>
            <p className="text-sm text-gray-600 mb-6">
                Créez les convois à l'avance. Les agents ne pourront enregistrer leurs colis que
                sur un convoi existant pour leur direction.
            </p>

            <ConvoysManager
                key={direction}
                initialConvoys={formatted}
                currentDirection={direction}
                tabs={
                    <div className="flex gap-2 bg-gray-100 p-1.5 rounded-lg">
                        <Link
                            href="/admin/convoys?direction=NE_TO_CA"
                            className={`flex-1 px-4 py-3 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
                                direction === "NE_TO_CA"
                                    ? "bg-white text-blue-600 shadow-sm ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-100"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            }`}
                        >
                            <img
                                src="/flags/ne.svg"
                                alt="NE"
                                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                            />
                            <span>Niger → Canada</span>
                            <img
                                src="/flags/ca.svg"
                                alt="CA"
                                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                            />
                        </Link>
                        <Link
                            href="/admin/convoys?direction=CA_TO_NE"
                            className={`flex-1 px-4 py-3 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-3 ${
                                direction === "CA_TO_NE"
                                    ? "bg-white text-blue-600 shadow-sm ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-100"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            }`}
                        >
                            <img
                                src="/flags/ca.svg"
                                alt="CA"
                                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                            />
                            <span>Canada → Niger</span>
                            <img
                                src="/flags/ne.svg"
                                alt="NE"
                                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
                            />
                        </Link>
                    </div>
                }
            />
        </main>
    );
}
