import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewRecallForm from "./NewRecallForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NewRecallPage({
    searchParams,
}: {
    searchParams: Promise<{ complaintId?: string; lotId?: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const sp = await searchParams;

    // Charger les lots avec un aperçu du nombre de clients affectés
    const lots = await prisma.foodLot.findMany({
        where: { active: true },
        select: {
            id: true,
            lotNumber: true,
            description: true,
            status: true,
            _count: { select: { sales: true } },
        },
        orderBy: { importDate: "desc" },
        take: 500,
    });

    // Pré-remplir depuis une plainte si ?complaintId=
    let triggeringComplaint: { id: string; complaintNumber: string; lotId: string | null; natureCategory: string; natureDescription: string } | null = null;
    if (sp.complaintId) {
        const c = await prisma.foodComplaint.findUnique({
            where: { id: sp.complaintId },
            select: {
                id: true, complaintNumber: true, lotId: true,
                natureCategory: true, natureDescription: true,
            },
        });
        if (c) triggeringComplaint = c;
    }

    return (
        <main className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/recalls" className="hover:underline">Rappels</Link>
                <span>›</span>
                <span className="text-gray-900">Nouveau</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Initier un rappel</h1>
            <p className="text-sm text-gray-600 mb-6">
                La liste des clients affectés sera générée automatiquement depuis le
                registre des ventes du lot sélectionné.
            </p>
            <NewRecallForm
                lots={lots}
                preselectedLotId={sp.lotId ?? triggeringComplaint?.lotId ?? null}
                triggeringComplaint={triggeringComplaint}
            />
        </main>
    );
}
