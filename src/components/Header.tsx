'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

type AppRole = 'ADMIN' | 'AGENT_GN' | 'AGENT_CA';

export default function Header() {
    const { data: session } = useSession();
    const role = session?.user?.role as AppRole | undefined;

    return (
        <header className="w-full bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                {/* Logo / Titre */}
                <Link href="/" className="text-lg font-bold text-neutral-900 flex items-center gap-1">
                    📦 <span>Suivi GN → CA</span>
                </Link>

                <nav className="flex items-center gap-4 text-sm">
                    {/* Lien visible pour ADMIN + AGENT_GN */}
                    {(role === 'ADMIN' || role === 'AGENT_GN') && (
                        <Link
                            href="/dashboard/shipments"
                            className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800">
                            Liste des Colis
                        </Link>
                    )}
                    {/* Bouton Ajouter un colis (visible que si ADMIN ou AGENT_GN) */}
                    {["ADMIN", "AGENT_GN"].includes(role || "") && (
                        <Link
                            href="/agent/gn"
                            className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800"
                        >
                            Ajouter un colis
                        </Link>
                    )}

                    {/* Liens réservés ADMIN (si tu veux les garder) */}
                    {role === 'ADMIN' && (
                        <>
                            <Link href="/admin" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Admin
                            </Link>
                            <Link href="/agent/gn" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Agent Guinée
                            </Link>
                            <Link href="/agent/ca" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Agent Canada
                            </Link>
                        </>
                    )}

                    {/* Tous les rôles voient Déconnexion quand ils sont connectés */}
                    {session && (
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="btn-primary text-sm px-3 py-1 rounded-lg"
                        >
                            Déconnexion
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
}