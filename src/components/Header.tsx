'use client';

import { useSession, signOut } from 'next-auth/react';

type AppRole = 'ADMIN' | 'AGENT_NE' | 'AGENT_CA';

export default function Header() {
    const { data: session } = useSession();
    const role = session?.user?.role as AppRole | undefined;

    // 🔄 Déterminer le sens d'affichage
    const directionLabel =
        role === 'AGENT_CA'
            ? 'Suivi CA → NE'
            : 'Suivi NE → CA'; // par défaut (ADMIN et AGENT_GN)

    return (
        <header className="w-full bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                {/* Logo / Titre dynamique */}
                <a href="/" className="text-lg font-bold text-neutral-900 flex items-center gap-1">
                    📦 <span>{directionLabel}</span>
                </a>

                <nav className="flex items-center gap-4 text-sm">
                    {/* Lien visible pour ADMIN + AGENT_GN */}
                    {(role === 'ADMIN' || role === 'AGENT_NE' || role === 'AGENT_CA' ) && (
                        <a
                            href="/dashboard/shipments"
                            className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800">
                            Liste des Colis
                        </a>
                    )}

                    {/* Ajouter GN */}
                    {["ADMIN", "AGENT_NE"].includes(role || "") && (
                        <a
                            href="/agent/ne"
                            className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800">
                            Ajouter (NE)
                        </a>
                    )}

                    {/* Ajouter CA */}
                    {["ADMIN", "AGENT_CA"].includes(role || "") && (
                        <a
                            href="/agent/ca"
                            className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800">
                            Ajouter (CA)
                        </a>

                    )}
                    {["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role || "") && (
                        <a href="/dashboard/notify" className="px-3 py-1 rounded-md bg-black text-white hover:bg-neutral-800">
                            Notifier convoi (CA)
                        </a>
                    )}



                    {/* Liens ADMIN */}
                    {role === 'ADMIN' && (
                        <>
                            <a href="/admin" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Admin
                            </a>
                            <a href="/agent/ne" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Agent Niger
                            </a>
                            <a href="/agent/ca" className="text-sm font-medium text-neutral-700 hover:text-black">
                                Agent Canada
                            </a>
                        </>
                    )}

                    {/* Bouton déconnexion */}
                    {session && (
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="btn-primary text-sm px-3 py-1 rounded-lg">
                            Déconnexion
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
}
