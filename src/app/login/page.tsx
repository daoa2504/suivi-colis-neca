'use client'

import { signIn } from "next-auth/react"
import { useState } from "react"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()

        const res = await signIn("credentials", {
            redirect: false,
            email,
            password,
        })

        if (res?.error) {
            setError("Email ou mot de passe invalide")
        } else {
            // Récupérer la session pour savoir le rôle
            const sessionRes = await fetch("/api/auth/session")
            const session = await sessionRes.json()

            if (session?.user?.role === "ADMIN") {
                window.location.href = "/admin"
            } else if (session?.user?.role === "AGENT_GN") {
                window.location.href = "/admin/gn/new-shipment"
            } else if (session?.user?.role === "AGENT_CA") {
                window.location.href = "/admin/ca"
            } else {
                window.location.href = "/"
            }
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <form
                onSubmit={handleLogin}
                className="space-y-4 p-6 rounded-xl border bg-white shadow"
            >
                <h1 className="text-lg font-semibold">Connexion</h1>
                {error && <p className="text-red-600 text-sm">{error}</p>}

                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full rounded-lg border px-3 py-2 text-black"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    className="w-full rounded-lg border px-3 py-2 text-black"
                />

                <button
                    type="submit"
                    className="w-full rounded-lg bg-black px-3 py-2 text-white hover:bg-neutral-800"
                >
                    Se connecter
                </button>
            </form>
        </main>
    )
}
