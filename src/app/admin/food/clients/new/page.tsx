import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FoodClientForm from "../FoodClientForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewFoodClientPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    // Lots disponibles pour la section "Première commande"
    const availableLots = await prisma.foodLot.findMany({
        where: { active: true, status: { not: "RECALLED" } },
        select: { id: true, lotNumber: true, description: true, quantityRemaining: true },
        orderBy: { importDate: "desc" },
        take: 200,
    });

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/clients" className="hover:underline">Clients</Link>
                <span>›</span>
                <span className="text-gray-900">Nouveau</span>
            </div>
            <h1 className="text-2xl font-bold mb-6">Nouveau client food</h1>
            <FoodClientForm mode="create" availableLots={availableLots} />
        </main>
    );
}
