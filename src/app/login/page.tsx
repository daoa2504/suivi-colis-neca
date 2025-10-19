// SERVER component
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
    const session = await getServerSession(authOptions);
    if (session) {
        const r = session.user.role;
        if (r === "ADMIN") redirect("/admin");
        if (r === "AGENT_CA") redirect("/agent/ca");
        if (r === "AGENT_NE") redirect("/agent/ne");
    }
    return (
        <main className="min-h-screen grid place-items-center p-6">
            <LoginForm />
        </main>
    );
}
