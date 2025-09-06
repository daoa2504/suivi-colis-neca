"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Header() {
    const { data: session } = useSession();
    const role = session?.user?.role;

    return (
        <header className="w-full bg-white shadow-sm ring-1 ring-neutral-200">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                {/* Logo / Titre */}
                <Link href="/" className="text-lg font-bold text-neutral-900 flex items-center gap-1">
                    📦 Suivi GN → CA
                </Link>

                <div className="flex items-center gap-4">
                    {/* ✅ Liens visibles uniquement si ADMIN */}
                    {role === "ADMIN" && (
                        <>
                            <Link
                                href="/admin"
                                className="text-sm font-medium text-neutral-700 hover:text-black"
                            >
                                Admin
                            </Link>
                            <Link
                                href="/agent/gn"
                                className="text-sm font-medium text-neutral-700 hover:text-black"
                            >
                                Agent Guinée
                            </Link>
                            <Link
                                href="/agent/ca"
                                className="text-sm font-medium text-neutral-700 hover:text-black"
                            >
                                Agent Canada
                            </Link>
                        </>
                    )}

                    {/* ✅ Tous les rôles voient Déconnexion */}
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="btn-primary text-sm px-3 py-1"
                    >
                        Déconnexion
                    </button>
                </div>
            </div>
        </header>
    );
}
