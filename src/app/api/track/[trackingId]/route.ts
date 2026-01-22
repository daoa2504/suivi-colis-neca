import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    try {
        const { trackingId: raw } = await params;
        const trackingId = raw.trim().toUpperCase();

        const shipment = await prisma.shipment.findUnique({
            where: { trackingId },
            select: {
                id: true,
                trackingId: true,
                status: true,
                originCountry: true,
                destinationCountry: true,
                weightKg: true,
                currentLocation: true,
                receiverCity: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!shipment) {
            return NextResponse.json(
                { ok: false, error: "Colis introuvable" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            ok: true,
            shipment: {
                ...shipment,
                origin: shipment.originCountry || "N/A",
                destination: shipment.destinationCountry || "N/A",
                pieces: 1,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error?.message || "Erreur serveur" },
            { status: 500 }
        );
    }
}
