import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

export default async function AdminConvoysPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const convoys = await prisma.convoy.findMany({
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
            <h1 className="text-2xl font-bold mb-6">Gestion des convois</h1>
            <p className="text-sm text-gray-600 mb-6">
                Créez les convois à l'avance. Les agents ne pourront enregistrer leurs colis que
                sur un convoi existant pour leur direction.
            </p>
            <ConvoysManager initialConvoys={formatted} />
        </main>
    );
}
