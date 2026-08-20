import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FoodClientForm from "../FoodClientForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EditFoodClientPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const { id } = await params;
    const client = await prisma.foodClient.findUnique({ where: { id } });
    if (!client) notFound();

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/clients" className="hover:underline">Clients</Link>
                <span>›</span>
                <span className="text-gray-900 truncate">{client.name}</span>
            </div>
            <h1 className="text-2xl font-bold mb-6">{client.name}</h1>
            <FoodClientForm mode="edit" initial={client} />
        </main>
    );
}
