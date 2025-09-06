// src/app/login/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function LoginPage() {
    const session = await getServerSession(authOptions);
    if (session) {
        // Redirige selon le rôle
        const role = session.user.role;
        if (role === "ADMIN") redirect("/admin");
        if (role === "AGENT_CA") redirect("/agent/ca");
        if (role === "AGENT_GN") redirect("/agent/gn");
    }

    return (
        <main className="min-h-screen grid place-items-center p-6">
            <LoginForm />
        </main>
    );
}

function LoginForm() {
    async function action(formData: FormData) {
        "use server";
        // ⚠️ NextAuth v4 : on ne peut pas appeler signIn côté server action,
        // on redirige vers l’endpoint /api/auth/callback/credentials via POST.
        const email = String(formData.get("email") || "");
        const password = String(formData.get("password") || "");

        // On utilise la redirection classique de NextAuth:
        // /api/auth/callback/credentials?csrf=true (gérée automatiquement par <form action> côté client)
    }

    return (
        <form
            method="post"
            action="/api/auth/callback/credentials"
            className="w-full max-w-sm space-y-3 bg-white p-6 rounded-xl shadow ring-1 ring-neutral-200"
        >
            <h1 className="text-xl font-semibold mb-2">Connexion</h1>
            <input name="csrfToken" type="hidden" />
            <label className="block text-sm">Email</label>
            <input
                name="email"
                type="email"
                required
                className="w-full border p-2 rounded"
                placeholder="email@example.com"
            />
            <label className="block text-sm">Mot de passe</label>
            <input
                name="password"
                type="password"
                required
                className="w-full border p-2 rounded"
                placeholder="••••••••"
            />
            <button className="w-full bg-black text-white px-4 py-2 rounded">
                Se connecter
            </button>
            <p className="text-xs text-neutral-500">
                Utilisez les identifiants de votre compte (admin / agent).
            </p>
        </form>
    );
}
