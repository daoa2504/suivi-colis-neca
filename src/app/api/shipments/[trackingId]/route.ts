import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ trackingId: string }> }
) {
    // ✅ Next 14.2+ : params est une Promise
    const { trackingId } = await params

    const shipment = await prisma.shipment.findUnique({
        where: { trackingId },
        include: { events: { orderBy: { occurredAt: 'desc' } } },
    })

    if (!shipment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
        id: shipment.id,
        trackingId: shipment.trackingId,
        senderName: shipment.senderName,
        receiverName: shipment.receiverName,
        receiverEmail: shipment.receiverEmail,
        originCountry: shipment.originCountry,
        destinationCountry: shipment.destinationCountry,
        status: shipment.status,
        events: shipment.events,
    })
}
