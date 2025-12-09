// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                console.log("🔐 Tentative de connexion avec:", credentials?.username);

                // ✅ Vérification avec typage correct
                if (!credentials || !credentials.username || !credentials.password) {
                    console.log("❌ Identifiants manquants");
                    return null; // ✅ Retourner null au lieu de throw
                }

                try {
                    // Chercher par username
                    const user = await prisma.user.findUnique({
                        where: { username: credentials.username },
                    });

                    console.log("👤 Utilisateur trouvé:", user ? `${user.username} (${user.role})` : "NULL");

                    if (!user) {
                        console.log("❌ Utilisateur introuvable");
                        return null;
                    }

                    const isValid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    );

                    console.log("🔑 Mot de passe valide:", isValid);

                    if (!isValid) {
                        console.log("❌ Mot de passe incorrect");
                        return null;
                    }

                    console.log("✅ Connexion réussie");

                    // ✅ Retourner l'objet user correctement typé
                    return {
                        id: user.id,
                        username: user.username,
                        email: user.email || "",
                        role: user.role,
                    };
                } catch (error) {
                    console.error("❌ Erreur lors de l'authentification:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.username = (user as any).username;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
                (session.user as any).role = token.role;
                (session.user as any).username = token.username;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET, // ✅ Important !
};