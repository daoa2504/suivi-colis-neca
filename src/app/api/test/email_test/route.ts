import { NextResponse } from 'next/server'
import { resend, FROM } from '@/lib/email'

export async function GET() {
    try {
        const result = await resend.emails.send({
            from: FROM,
            to: 'abdourahime336@gmail.com', // ⚠️ mets ici l’email validé dans Resend
            subject: 'Test Resend',
            text: 'Ceci est un test d’email depuis mon projet Next.js 🚀'
        })

        return NextResponse.json({ ok: true, result })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
    }
}
