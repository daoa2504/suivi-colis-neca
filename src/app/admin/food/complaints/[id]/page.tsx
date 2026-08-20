// src/app/admin/food/complaints/[id]/page.tsx
// Détail + workflow enquête d'une plainte (Article 82 RSAC).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ComplaintWorkflow from "./ComplaintWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const { id } = await params;
    const complaint = await prisma.foodComplaint.findUnique({
        where: { id },
        include: {
            client: true,
            lot: true,
            createdBy: { select: { id: true, username: true } },
            handledBy: { select: { id: true, username: true } },
        },
    });
    if (!complaint) notFound();

    return (
        <main className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/complaints" className="hover:underline">Plaintes</Link>
                <span>›</span>
                <span className="text-gray-900 font-mono">{complaint.complaintNumber}</span>
            </div>

            <ComplaintWorkflow initial={complaint as any} />
        </main>
    );
}
