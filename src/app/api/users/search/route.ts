// src/app/api/users/autocomplete/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔥 Normalisation : supprimer tout sauf les chiffres
function normalize(phone: string) {
    return phone.replace(/\D/g, "");
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
        return NextResponse.json({ ok: true, results: [] });
    }

    const normalized = normalize(q);

    try {
        // 1️⃣ Récupérer tous les shipments avec téléphone (plus large pour bien filtrer)
        const all = await prisma.shipment.findMany({
            where: {
                receiverPhone: { not: null },
            },
            orderBy: { createdAt: "desc" },
            select: {
                receiverName: true,
                receiverEmail: true,
                receiverPhone: true,
                receiverAddress: true,
                receiverCity: true,
                receiverPoBox: true,
                pickupLastName: true,
                pickupFirstName: true,
                pickupQuartier: true,
                pickupPhone: true,
                createdAt: true,
            },
        });

        // 2️⃣ Filtrer par téléphone normalisé
        const matched = all.filter(u => {
            if (!u.receiverPhone) return false;
            return normalize(u.receiverPhone).includes(normalized);
        });

        // 3️⃣ Dédupliquer par téléphone (garder le plus récent pour chaque numéro)
        const uniqueMap = new Map<string, typeof matched[0]>();

        for (const item of matched) {
            const phone = normalize(item.receiverPhone!);

            // Si ce numéro n'existe pas encore OU si ce colis est plus récent
            if (!uniqueMap.has(phone)) {
                uniqueMap.set(phone, item);
            }
        }

        // 4️⃣ Convertir en tableau et limiter à 6 résultats
        const results = Array.from(uniqueMap.values())
            .slice(0, 6)
            .map(({ createdAt, ...rest }) => rest); // Retirer createdAt du résultat

        return NextResponse.json({ ok: true, results });
    } catch (error) {
        console.error("Autocomplete error:", error);
        return NextResponse.json({ ok: false, results: [] }, { status: 500 });
    }
}