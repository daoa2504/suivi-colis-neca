// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const users = [
        {
            username: "admin",
            email: "admin@example.com",
            role: "ADMIN",
            password: "admin123"
        },
        {
            username: "agent_ca",
            email: "agent.ca@example.com",
            role: "AGENT_CA",
            password: "canada123"
        },
        {
            username: "agent_ne",
            email: "agent.ne@example.com",
            role: "AGENT_NE",
            password: "niger123"
        },
        {
            // Agent Marchandises : accès au module food uniquement, aucun accès colis.
            // ⚠️ Dépôt public : jamais de mot de passe réel ici.
            // Définir AGENT_MARCHANDISE_PASSWORD pour un vrai mot de passe.
            username: "Sodik",
            email: "www.sodikabdouramane@gmail.com",
            role: "AGENT_MARCHANDISE",
            password: process.env.AGENT_MARCHANDISE_PASSWORD || "dev-changeme"
        },
        {
            // ⚠️ Dépôt public : définir AASODIK_PASSWORD pour un vrai mot de passe.
            username: "AASodik",
            email: null,
            role: "AGENT_CA",
            password: process.env.AASODIK_PASSWORD || "dev-changeme"
        },
        {
            username: "Mananou",
            email: "assoumanailloabdoulmananou@gmail.com",
            role: "AGENT_NE",
            password: "niger123"
        },
        {
            username: "Mananou",
            email: null, // ✅ Pas d'email valide
            role: "AGENT_NE",
            password: "niger123"
        },
    ] as const;

    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.upsert({
            where: { username: u.username }, // ✅ Changé de email à username
            update: {
                role: u.role as any,
                password: hash,
                email: u.email as any
            },
            create: {
                username: u.username,
                email: u.email as any,
                role: u.role as any,
                password: hash
            },
        });
        console.log(`✔ upsert user: ${user.username} (${user.role}) - ${user.email || 'no email'}`);
    }

    console.log("✅ Seed completed");
    console.log("\n📋 Identifiants de connexion:");
    console.log("  Admin:      username=admin, password=admin123");
    console.log("  Agent CA:   username=agent_ca, password=canada123");
    console.log("  Agent NE:   username=agent_ne, password=niger123");
    console.log("  Marchandises: username=Sodik (rôle AGENT_MARCHANDISE)");
    console.log("  Agent CA 2:   username=AASodik (rôle AGENT_CA)");
    console.log("  Assoumani:  username=assoumani, password=niger123");
    console.log("  Mananou:    username=Mananou, password=niger123");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });