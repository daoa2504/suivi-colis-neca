import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import '@/lib/email'
export const metadata: Metadata = {
    title: 'Suivi de colis GN → CA',
    description: 'Création et suivi de colis entre la Guinée et le Canada',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
        <body className="bg-neutral-50 text-neutral-900">
        <div className="mx-auto max-w-5xl p-6">
            <header className="mb-6 flex items-center justify-between">
                <Link href="/" className="text-2xl font-bold">📦 Suivi GN → CA</Link>
                <nav className="flex items-center gap-4 text-sm">
                    <Link href="/" className="underline hover:no-underline">Accueil</Link>
                    <Link href="/admin" className="underline hover:no-underline">Espace agents</Link>
                </nav>
            </header>
            {children}
            <footer className="mt-12 text-center text-xs text-neutral-500">
                Fait avec Next.js · Prisma · Resend
            </footer>
        </div>
        </body>
        </html>
    )
}
