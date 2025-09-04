'use client'

import { useEffect, useState } from "react"

type User = {
    id: string
    email: string
    role: string
}

type Shipment = {
    id: string
    trackingId: string
    senderName: string
    receiverName: string
    receiverEmail: string
    status: string
}

export default function AdminDashboard() {
    const [users, setUsers] = useState<User[]>([])
    const [newEmail, setNewEmail] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [newRole, setNewRole] = useState("AGENT_CA")
    const [shipments, setShipments] = useState<Shipment[]>([])

    useEffect(() => {
        fetch("/api/admin/users")
            .then((res) => res.json())
            .then(setUsers)
    }, [])
    useEffect(() => {
        fetch("/api/admin/shipments")
            .then(res => res.json())
            .then(setShipments)
    }, [])
    async function addUser() {
        const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: newEmail,
                password: newPassword,
                role: newRole,
            }),
        })
        if (res.ok) {
            const user = await res.json()
            setUsers([...users, user]) // on met à jour la liste
            setNewEmail("")
            setNewPassword("")
            setNewRole("AGENT_CA")
        }
    }

    return (
        <main className="p-6 space-y-6 text-neutral-100">
            <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>

            {/* Section Utilisateurs */}
            <section>
                <h2 className="text-lg font-semibold">Utilisateurs</h2>
                <table className="mt-2 w-full border text-sm text-neutral-200">
                    <thead className="bg-neutral-800">
                    <tr>
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Rôle</th>
                        <th className="border p-2">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {users.map((u) => (
                        <tr key={u.id}>
                            <td className="border p-2">{u.email}</td>
                            <td className="border p-2">{u.role}</td>
                            <td className="border p-2">[à compléter plus tard]</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {/* 👉 Ici on met ton formulaire d’ajout utilisateur */}
                <div className="mt-4 flex gap-2">
                    <input
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Email"
                        className="rounded border px-2 py-1 text-black bg-white"
                    />

                    <input
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mot de passe"
                        type="password"
                        className="rounded border px-2 py-1 text-black bg-white"
                    />

                    <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="rounded border px-2 py-1 text-black bg-white"
                    >
                        <option value="AGENT_GN">Agent Guinée</option>
                        <option value="AGENT_CA">Agent Canada</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <button
                        onClick={addUser}
                        className="rounded bg-green-600 px-3 py-1 text-white"
                    >
                        Ajouter utilisateur
                    </button>
                </div>
            </section>

            {/* Section Colis (à compléter ensuite) */}
            <section>
                <h2 className="text-lg font-semibold">Colis</h2>
                <table className="mt-2 w-full border text-sm text-neutral-200">
                    <thead className="bg-neutral-800">
                    <tr>
                        <th className="border p-2">Tracking</th>
                        <th className="border p-2">Expéditeur</th>
                        <th className="border p-2">Destinataire</th>
                        <th className="border p-2">Statut</th>
                    </tr>
                    </thead>
                    <tbody>
                    {shipments.map((s) => (
                        <tr key={s.id}>
                            <td className="border p-2">{s.trackingId}</td>
                            <td className="border p-2">{s.senderName}</td>
                            <td className="border p-2">{s.receiverName}</td>
                            <td className="border p-2">{s.status}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </section>
        </main>
    )
}
