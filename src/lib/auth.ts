import { NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import type { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Mot de passe", type: "password" },
            },
            // Important: on retourne un User NextAuth (pas l'objet Prisma)
            async authorize(credentials): Promise<NextAuthUser | null> {
                if (!credentials?.email || !credentials.password) return null;

                const dbUser = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });
                if (!dbUser) return null;

                const valid = await bcrypt.compare(credentials.password, dbUser.password);
                if (!valid) return null;

                // Adapter au type NextAuth.User (sans password)
                const user: NextAuthUser = {
                    id: dbUser.id,
                    email: dbUser.email,
                    // name/image restent optionnels
                    role: dbUser.role, // vient de ton schéma Prisma
                } as unknown as NextAuthUser; // si TS chipote sur role, on l’ajoute via l’augmentation (voir étape 1)

                return user;
            },
        }),
    ],

    session: { strategy: "jwt" },

    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: NextAuthUser }) {
            // Lors du login, `user` est défini : on hydrate le token
            if (user) {
                token.id = user.id;
                token.email = user.email ?? token.email;
                // @ts-expect-error: role est ajouté par l’augmentation
                token.role = (user as unknown).role;
            }
            return token;
        },

        async session({ session, token }) {
            // Hydrate la session depuis le JWT (les champs existent via l’augmentation)
            session.user = {
                ...(session.user ?? {}),
                id: token.id,
                email: token.email,
                role: token.role,
            };
            return session;
        },
    },
};
