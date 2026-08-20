import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewComplaintForm from "./NewComplaintForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const [clients, lots] = await Promise.all([
        prisma.foodClient.findMany({
            where: { active: true },
            select: { id: true, customerCode: true, name: true, email: true, phone: true },
            orderBy: { name: "asc" },
            take: 500,
        }),
        prisma.foodLot.findMany({
            where: { active: true },
            select: { id: true, lotNumber: true, description: true },
            orderBy: { importDate: "desc" },
            take: 500,
        }),
    ]);

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/complaints" className="hover:underline">Plaintes</Link>
                <span>›</span>
                <span className="text-gray-900">Nouvelle (saisie admin)</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Nouvelle plainte — saisie admin</h1>
            <p className="text-sm text-gray-600 mb-6">
                Utilisez ce formulaire quand une plainte arrive par téléphone, email ou
                autre canal hors du formulaire client public.
            </p>
            <NewComplaintForm clients={clients} lots={lots} />
        </main>
    );
}
