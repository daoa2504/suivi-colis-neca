import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RecallWorkflow from "./RecallWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RecallDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    const { id } = await params;
    const recall = await prisma.foodRecall.findUnique({
        where: { id },
        include: {
            lot: true,
            triggeringComplaint: {
                select: { id: true, complaintNumber: true, natureCategory: true },
            },
            createdBy: { select: { id: true, username: true } },
            contacts: {
                include: {
                    client: {
                        select: {
                            id: true, customerCode: true, name: true,
                            email: true, phone: true,
                        },
                    },
                },
                orderBy: { clientNameSnapshot: "asc" },
            },
        },
    });
    if (!recall) notFound();

    return (
        <main className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Link href="/admin" className="hover:underline">Admin</Link>
                <span>›</span>
                <Link href="/admin/food" className="hover:underline">Traçabilité alimentaire</Link>
                <span>›</span>
                <Link href="/admin/food/recalls" className="hover:underline">Rappels</Link>
                <span>›</span>
                <span className="text-gray-900 font-mono">{recall.recallNumber}</span>
            </div>

            <RecallWorkflow initial={recall as any} />
        </main>
    );
}
