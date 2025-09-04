import { customAlphabet } from 'nanoid'

// Format trackingId : GNC-1234567
const nano = customAlphabet('0123456789', 7)

export function generateTrackingId() {
    return `GNC-${nano()}`
}

export function formatDate(d: string | Date) {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}
