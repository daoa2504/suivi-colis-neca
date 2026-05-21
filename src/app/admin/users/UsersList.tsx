"use client";

import { useState } from "react";
import Link from "next/link";

type Row = {
    id: string;
    username: string;
    email: string | null;
    role: "ADMIN" | "AGENT_CA" | "AGENT_NE";
    shipmentsCount: number;
    paymentsCount: number;
    expensesCount: number;
    notificationsCount: number;
    lastActivity: string | null;
};

const ROLE_BADGE: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    AGENT_CA: "bg-red-100 text-red-800",
    AGENT_NE: "bg-green-100 text-green-800",
};

const ROLE_LABEL: Record<string, string> = {
    ADMIN: "Admin",
    AGENT_CA: "Agent Canada",
    AGENT_NE: "Agent Niger",
};

function fmtDate(s: string | null) {
    if (!s) return "—";
    const d = new Date(s);
    return d.toLocaleString("fr-CA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

export default function UsersList({ initialUsers }: { initialUsers: Row[] }) {
    const [resetting, setResetting] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<{
        username: string;
        password: string;
    } | null>(null);

    async function onResetPassword(id: string, username: string) {
        if (!confirm(`Réinitialiser le mot de passe de ${username} ?`)) return;
        setResetting(id);
        try {
            const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST" });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Erreur");
            setRevealed({ username: data.username, password: data.newPassword });
        } catch (e: any) {
            alert(`❌ ${e.message}`);
        } finally {
            setResetting(null);
        }
    }

    return (
        <>
            {/* Modal d'affichage du nouveau mot de passe */}
            {revealed && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <h2 className="text-lg font-bold mb-2">🔐 Nouveau mot de passe généré</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Voici le nouveau mot de passe de <strong>{revealed.username}</strong>.
                            Il ne sera <strong>plus affiché ensuite</strong> — copie-le et transmets-le par
                            un canal sécurisé.
                        </p>
                        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                            <code className="text-sm font-mono font-bold break-all">{revealed.password}</code>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(revealed.password);
                                    alert("Mot de passe copié dans le presse-papier");
                                }}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                            >
                                Copier
                            </button>
                            <button
                                onClick={() => setRevealed(null)}
                                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <section className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="text-left p-3">Utilisateur</th>
                            <th className="text-left p-3">Rôle</th>
                            <th className="text-center p-3">Colis créés</th>
                            <th className="text-center p-3">Paiements</th>
                            <th className="text-center p-3">Dépenses</th>
                            <th className="text-center p-3">Notifs</th>
                            <th className="text-left p-3">Dernière activité</th>
                            <th className="text-right p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {initialUsers.map((u) => (
                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                <td className="p-3">
                                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-blue-700 hover:underline">
                                        {u.username}
                                    </Link>
                                    {u.email && <p className="text-xs text-gray-500">{u.email}</p>}
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                                        {ROLE_LABEL[u.role]}
                                    </span>
                                </td>
                                <td className="p-3 text-center font-mono">{u.shipmentsCount}</td>
                                <td className="p-3 text-center font-mono">{u.paymentsCount}</td>
                                <td className="p-3 text-center font-mono">{u.expensesCount}</td>
                                <td className="p-3 text-center font-mono">{u.notificationsCount}</td>
                                <td className="p-3 text-xs text-gray-600">{fmtDate(u.lastActivity)}</td>
                                <td className="p-3 text-right space-x-3 whitespace-nowrap">
                                    <Link
                                        href={`/admin/users/${u.id}`}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Voir
                                    </Link>
                                    <button
                                        onClick={() => onResetPassword(u.id, u.username)}
                                        disabled={resetting === u.id}
                                        className="text-xs text-amber-700 hover:underline disabled:opacity-50"
                                    >
                                        {resetting === u.id ? "…" : "Réinit. MDP"}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {initialUsers.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">
                                    Aucun utilisateur.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>
        </>
    );
}
