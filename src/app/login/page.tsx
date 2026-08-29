// SERVER component
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { homePathForRole } from "@/lib/roles";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    const session = await getServerSession(authOptions);
    if (session) {
        const r = session.user.role;
        redirect(homePathForRole(r));
    }
    return (
        <main className="min-h-screen grid place-items-center p-6">
            <LoginForm />
        </main>
    );
}
