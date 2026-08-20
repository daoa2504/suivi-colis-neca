import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import FoodLotForm from "../FoodLotForm";

export const runtime = "nodejs";

export default async function NewFoodLotPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/lots" className="hover:underline">Lots</Link>
                <span>›</span>
                <span className="text-gray-900">Nouveau</span>
            </div>
            <h1 className="text-2xl font-bold mb-6">Nouveau lot importé</h1>
            <FoodLotForm mode="create" initial={{ importDate: new Date() }} />
        </main>
    );
}
