// src/app/admin/clients/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ClientsTable from "./ClientsTable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePhone(p: string | null): string {
    if (!p) return "";
    return p.replace(/\D/g, "");
}

export default async function AdminClientsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");
    if (session.user.role !== "ADMIN") redirect("/");

    // Récupère tous les shipments pour les agréger par client (téléphone)
    const shipments = await prisma.shipment.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            trackingId: true,
            receiverName: true,
            receiverEmail: true,
            receiverPhone: true,
            receiverCity: true,
            weightKg: true,
            paymentStatus: true,
            createdAt: true,
            convoy: { select: { direction: true } },
        },
    });

    // Agrégation par téléphone normalisé (ou email si pas de tél)
    type ClientAgg = {
        key: string;
        name: string;
        phone: string | null;
        email: string | null;
        city: string | null;
        shipmentsCount: number;
        totalWeight: number;
        lastShipmentDate: Date;
        unpaidCount: number;
        directions: Set<string>;
    };

    const map = new Map<string, ClientAgg>();
    for (const s of shipments) {
        const phoneN = normalizePhone(s.receiverPhone);
        const key = phoneN || (s.receiverEmail?.toLowerCase().trim() ?? "");
        if (!key) continue;

        const existing = map.get(key);
        if (existing) {
            existing.shipmentsCount += 1;
            existing.totalWeight += s.weightKg ?? 0;
            if (s.createdAt > existing.lastShipmentDate) {
                existing.lastShipmentDate = s.createdAt;
                existing.name = s.receiverName;
                existing.email = s.receiverEmail || existing.email;
                existing.phone = s.receiverPhone || existing.phone;
                existing.city = s.receiverCity || existing.city;
            }
            if (s.paymentStatus !== "PAID") existing.unpaidCount += 1;
            if (s.convoy?.direction) existing.directions.add(s.convoy.direction);
        } else {
            map.set(key, {
                key,
                name: s.receiverName,
                phone: s.receiverPhone,
                email: s.receiverEmail,
                city: s.receiverCity,
                shipmentsCount: 1,
                totalWeight: s.weightKg ?? 0,
                lastShipmentDate: s.createdAt,
                unpaidCount: s.paymentStatus !== "PAID" ? 1 : 0,
                directions: new Set(s.convoy?.direction ? [s.convoy.direction] : []),
            });
        }
    }

    const clients = Array.from(map.values())
        .map((c) => ({
            key: c.key,
            name: c.name,
            phone: c.phone,
            email: c.email,
            city: c.city,
            shipmentsCount: c.shipmentsCount,
            totalWeight: Number(c.totalWeight.toFixed(2)),
            lastShipmentDate: c.lastShipmentDate.toISOString(),
            unpaidCount: c.unpaidCount,
            directions: Array.from(c.directions),
        }))
        .sort((a, b) => (a.lastShipmentDate < b.lastShipmentDate ? 1 : -1));

    return (
        <main className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <Link href="/admin" className="text-sm text-blue-600 hover:underline">
                    ← Retour au dashboard admin
                </Link>
                <h1 className="text-2xl font-bold mt-2">👤 Clients</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Liste des clients uniques agrégés par téléphone. Clic sur un client pour voir son
                    historique complet de colis.
                </p>
            </div>

            <ClientsTable clients={clients} />
        </main>
    );
}
