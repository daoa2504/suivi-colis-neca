// src/lib/auth.ts
// Configuration NextAuth v4 (Credentials) + callbacks pour propager id/email/role

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
    session: { strategy: "jwt" },

    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Mot de passe", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });
                if (!user) return null;

                const ok = await bcrypt.compare(credentials.password, user.password);
                if (!ok) return null;

                // Objet User attendu par NextAuth (pas de password)
                return {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                } as any;
            },
        }),
    ],

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = (user as any).id;
                token.email = (user as any).email ?? token.email;
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                id: token.id as string,
                email: token.email as string,
                role: token.role as any,
            };
            return session;
        },
    },
};
