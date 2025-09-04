import {NextAuthOptions, User} from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import {JWT} from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Mot de passe", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) return null

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                })
                if (!user) return null

                const valid = await bcrypt.compare(credentials.password, user.password)
                if (!valid) return null

                return { id: user.id, email: user.email, role: user.role }
            },
        }),
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async session({ session, token }) {
            if (token) {
                session.user = {
                    id: token.id as string,
                    email: token.email as string,
                    role: token.role as string,
                }
            }
            return session
        },


        async jwt({ token, user }: { token: JWT; user?: User }) {
            if (user) {
        token.id = user.id
        token.email = user.email
        token.role = user.role
    }
        return token

        },
    },
}
