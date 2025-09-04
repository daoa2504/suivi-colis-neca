import { NextResponse } from 'next/server'
import { generateTrackingId, formatDate } from '@/lib/utils'

export async function GET() {
    return NextResponse.json({
        trackingId: generateTrackingId(),
        now: formatDate(new Date()),
    })
}
