'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from "next/navigation";
type AppRole = 'ADMIN' | 'AGENT_NE' | 'AGENT_CA';

export default function Header() {
    const { data: session } = useSession();
    const role = session?.user?.role as AppRole | undefined;
    const pathname = usePathname();

    // Pages où le header doit être caché
    const hideHeaderRoutes = ["/track", "/tracking"];

    if (hideHeaderRoutes.includes(pathname)) {
        return null;
    }
    return (
        <header className="w-full bg-white shadow-md border-b-2 border-gray-100">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                {/* Logo / Titre */}
                {/* Logo / Titre - Sans lien */}
                <div className="flex items-center gap-3">
                    {/* ✅ Logo NIMAPLEX au lieu du SVG */}
                    <img
                        src="https://nimaplex.com/img.png"
                        alt="NIMAPLEX"
                        className="w-12 h-12 rounded-lg shadow-lg object-cover"
                    />

                    <div>
                        <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                NIMAPLEX
            </span>
                            {role === 'AGENT_CA' && (
                                <div className="flex items-center gap-1 text-xs">
                                    <img src="/flags/ca.svg" alt="CA" className="w-4 h-3 rounded" />
                                    <span>→</span>
                                    <img src="/flags/ne.svg" alt="NE" className="w-4 h-3 rounded" />
                                </div>
                            )}
                            {role === 'AGENT_NE' && (
                                <div className="flex items-center gap-1 text-xs">
                                    <img src="/flags/ne.svg" alt="NE" className="w-4 h-3 rounded" />
                                    <span>→</span>
                                    <img src="/flags/ca.svg" alt="CA" className="w-4 h-3 rounded" />
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500">Gestion de colis international</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-2">
                    {(role === 'ADMIN' || role === 'AGENT_NE' || role === 'AGENT_CA') && (
                        <Link
                            href="/dashboard/shipments"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span className="hidden sm:inline">Liste</span>
                        </Link>
                    )}

                    {["ADMIN", "AGENT_NE"].includes(role || "") && (
                        <Link
                            href="/agent/ne"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm font-medium"
                        >
                            <span className="hidden sm:inline">🇳🇪</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden md:inline">Niger</span>
                        </Link>
                    )}

                    {["ADMIN", "AGENT_CA"].includes(role || "") && (
                        <Link
                            href="/agent/ca"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all shadow-sm font-medium"
                        >
                            <span className="hidden sm:inline">🇨🇦</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden md:inline">Canada</span>
                        </Link>
                    )}

                    {["ADMIN", "AGENT_CA", "AGENT_NE"].includes(role || "") && (
                        <Link
                            href="/dashboard/notify"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span className="hidden lg:inline">Notifier</span>
                        </Link>
                    )}

                    {session && (
                        <>
                            <div className="w-px h-8 bg-gray-300 mx-2 hidden sm:block"></div>

                            <div className="flex items-center gap-3">
                                {/* ✅ Badge coloré avec drapeau */}
                                <div className="hidden lg:block text-right">
                                    <p className="text-sm font-semibold text-gray-800">{session.user.username}</p>
                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                        {role === 'ADMIN' ? (
                                            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Admin
                                            </span>
                                        ) : role === 'AGENT_CA' ? (
                                            <span className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium border border-red-200">
                                                <img src="/flags/ca.svg" alt="CA" className="w-4 h-3 rounded" />
                                                Canada
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium border border-orange-200">
                                                <img src="/flags/ne.svg" alt="NE" className="w-4 h-3 rounded" />
                                                Niger
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="hidden sm:inline">Déconnexion</span>
                                </button>
                            </div>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}