"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm() {
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setErr(null);

        const form = e.currentTarget as any;
        const email = form.email.value;
        const password = form.password.value;

        const res = await signIn("credentials", {
            redirect: true,
            callbackUrl: "/", // ← la home te redirige selon le rôle
            email,
            password,
        });

        // Si redirect:true, NextAuth gère la redirection.
        // En cas d’erreur sans redirection, tu peux lire res?.error ici.
        setLoading(false);
    }

    return (
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-3 bg-white p-6 rounded-xl shadow ring-1 ring-neutral-200">
            <h1 className="text-xl font-semibold mb-2">Connexion</h1>

            <label className="block text-sm">Email</label>
            <input name="email" type="email" required className="w-full border p-2 rounded" placeholder="email@example.com" />

            <label className="block text-sm">Mot de passe</label>
            <input name="password" type="password" required className="w-full border p-2 rounded" placeholder="••••••••" />

            <button disabled={loading} className="w-full bg-black text-white px-4 py-2 rounded">
                {loading ? "Connexion..." : "Se connecter"}
            </button>

            {err && <p className="text-sm text-red-600">{err}</p>}
            <p className="text-xs text-neutral-500">Utilisez les identifiants de votre compte (admin / agent).</p>
        </form>
    );
}
