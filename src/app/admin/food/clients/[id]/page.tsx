import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import FoodClientForm from "../FoodClientForm";
import FoodSaleSection from "./FoodSaleSection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(d: Date | string) {
    return new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
}

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

    // Charger l'historique des ventes + les lots disponibles (pour le formulaire)
    const [sales, availableLots] = await Promise.all([
        prisma.foodSale.findMany({
            where: { clientId: id },
            include: {
                lot: { select: { id: true, lotNumber: true, description: true } },
            },
            orderBy: { saleDate: "desc" },
        }),
        prisma.foodLot.findMany({
            where: { active: true, status: { not: "RECALLED" } },
            select: { id: true, lotNumber: true, description: true, quantityRemaining: true },
            orderBy: { importDate: "desc" },
            take: 200,
        }),
    ]);

    const totalKgAcheté = sales.reduce((s, x) => s + x.quantityKg, 0);
    const totalDépensé = sales.reduce((s, x) => s + (x.price ?? 0), 0);

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/clients" className="hover:underline">Clients</Link>
                <span>›</span>
                <span className="text-gray-900 truncate">{client.name}</span>
            </div>

            <div className="flex items-baseline gap-3 mb-6 flex-wrap">
                <span className="font-mono text-lg text-blue-800 bg-blue-50 px-3 py-1 rounded font-semibold">
                    {client.customerCode}
                </span>
                <h1 className="text-2xl font-bold">{client.name}</h1>
                {!client.active && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700">Désactivé</span>
                )}
            </div>

            {/* KPI du client */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Kpi label="Ventes" value={sales.length.toString()} />
                <Kpi label="Total acheté (kg)" value={totalKgAcheté.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} />
                <Kpi label="Total dépensé" value={totalDépensé > 0 ? totalDépensé.toLocaleString("fr-CA", { maximumFractionDigits: 2 }) + " $" : "—"} />
                <Kpi label="Client depuis" value={fmt(client.createdAt)} />
            </div>

            {/* Fiche client (édition) */}
            <section className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Coordonnées
                </h2>
                <FoodClientForm mode="edit" initial={client} />
            </section>

            {/* Ventes / historique + formulaire ajout */}
            <section>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Historique des ventes et enregistrement
                </h2>
                <FoodSaleSection
                    clientId={client.id}
                    clientCode={client.customerCode}
                    availableLots={availableLots}
                    initialSales={sales}
                />
            </section>
        </main>
    );
}

function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white p-3 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className="text-xl font-bold mt-1 text-gray-900 truncate">{value}</p>
        </div>
    );
}
