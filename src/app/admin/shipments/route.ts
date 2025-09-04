import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
    const shipments = await prisma.shipment.findMany()
    return NextResponse.json(shipments)
}
