import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    const shipments = await prisma.shipment.findMany({
        include: {
            events: true, // si tu veux aussi voir les événements
        },
        orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(shipments)
}
