import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM =
    process.env.RESEND_FROM || 'Colis GN-CA <no-reply@example.com>'
console.log('[email] FROM =', FROM)
export const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

   // 👈 ajoute ici

if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY manquant — les envois échoueront.')
}
