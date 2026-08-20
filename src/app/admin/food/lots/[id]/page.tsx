import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FoodLotForm from "../FoodLotForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditFoodLotPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const { id } = await params;
    const lot = await prisma.foodLot.findUnique({ where: { id } });
    if (!lot) notFound();

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/lots" className="hover:underline">Lots</Link>
                <span>›</span>
                <span className="text-gray-900 font-mono">{lot.lotNumber}</span>
            </div>
            <h1 className="text-2xl font-bold mb-1 font-mono">{lot.lotNumber}</h1>
            <p className="text-sm text-gray-600 mb-6 truncate">{lot.description}</p>
            <FoodLotForm mode="edit" initial={{
                id: lot.id,
                lotNumber: lot.lotNumber,
                description: lot.description,
                awbNumber: lot.awbNumber,
                supplier: lot.supplier,
                supplierCity: lot.supplierCity,
                importDate: lot.importDate,
                quantityKg: lot.quantityKg,
                quantityRemaining: lot.quantityRemaining ?? undefined,
                status: lot.status,
                notes: lot.notes,
                active: lot.active,
            }} />
        </main>
    );
}
