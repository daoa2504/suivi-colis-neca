// src/app/admin/food/page.tsx
//
// Dashboard du module Traçabilité alimentaire (ACIA).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FoodDashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const [clientsCount, lotsCount, inTransitCount, recalledCount, openComplaints, highRiskComplaints] = await Promise.all([
        prisma.foodClient.count({ where: { active: true } }),
        prisma.foodLot.count({ where: { active: true } }),
        prisma.foodLot.count({ where: { active: true, status: "IN_TRANSIT" } }),
        prisma.foodLot.count({ where: { active: true, status: "RECALLED" } }),
        prisma.foodComplaint.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
        prisma.foodComplaint.count({ where: { riskLevel: "HIGH", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    ]);

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Link href="/admin" className="hover:underline">Admin</Link>
                    <span>›</span>
                    <span className="text-gray-900">Traçabilité alimentaire</span>
                </div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    🌾 Traçabilité alimentaire
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                    Registre clients + lots importés du Niger. Base de la conformité ACIA.
                </p>
            </div>

            {/* KPI */}
            <section className="mb-8">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Kpi label="Clients actifs" value={clientsCount.toString()} accent="text-blue-700" />
                    <Kpi label="Lots enregistrés" value={lotsCount.toString()} accent="text-emerald-700" />
                    <Kpi label="Lots en transit" value={inTransitCount.toString()} accent="text-amber-700" />
                    <Kpi label="Lots rappelés" value={recalledCount.toString()} accent="text-red-700" />
                    <Kpi label="Plaintes ouvertes" value={openComplaints.toString()} accent="text-red-700" />
                    <Kpi label="Risque élevé" value={highRiskComplaints.toString()} accent="text-red-900" />
                </div>
            </section>

            {/* Cartes */}
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Sections
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card
                    href="/admin/food/clients"
                    icon="👥"
                    title="Clients"
                    desc="Registre complet des clients (nom, adresse, téléphone, email). Historique des achats à venir."
                    color="blue"
                />
                <Card
                    href="/admin/food/lots"
                    icon="📦"
                    title="Lots importés"
                    desc="Registre des lots (n° unique, produit, AWB, fournisseur, quantité, statut)."
                    color="emerald"
                />
                <CardDisabled
                    icon="🧾"
                    title="Ventes (Phase 3.2)"
                    desc="Enregistrer une vente : associe un client à un lot avec quantité."
                />
                <Card
                    href="/admin/food/complaints"
                    icon="⚠️"
                    title="Plaintes"
                    desc="Registre Article 82 RSAC : biologique/chimique/physique/qualité + risque + résolution + notification ACIA."
                    color="red"
                />
                <Card
                    href="/admin/food/recalls"
                    icon="🔔"
                    title="Rappels"
                    desc="Initier un rappel : liste auto des clients affectés, suivi contact + retour, ACIA + rapport de clôture. Simulation annuelle Article 7."
                    color="red"
                />
            </div>
        </main>
    );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
        </div>
    );
}

function Card({
    href, icon, title, desc, color,
}: { href: string; icon: string; title: string; desc: string; color: "blue" | "emerald" | "amber" | "red" }) {
    const border = {
        blue: "hover:border-blue-400",
        emerald: "hover:border-emerald-400",
        amber: "hover:border-amber-400",
        red: "hover:border-red-400",
    }[color];
    return (
        <Link
            href={href}
            className={`block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md transition-all ${border}`}
        >
            <div className="text-3xl mb-2">{icon}</div>
            <h3 className="font-semibold text-lg mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{desc}</p>
        </Link>
    );
}

function CardDisabled({ icon, title, desc }: { icon: string; title: string; desc: string }) {
    return (
        <div className="p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 opacity-70">
            <div className="text-3xl mb-2 grayscale">{icon}</div>
            <h3 className="font-semibold text-lg mb-1 text-gray-700">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
        </div>
    );
}
