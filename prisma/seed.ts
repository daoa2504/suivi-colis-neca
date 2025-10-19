// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    const users = [
        { email: "admin@example.com",    role: "ADMIN",    password: "admin123" },
        { email: "agent.ca@example.com", role: "AGENT_CA", password: "canada123" },
        { email: "agent.ne@example.com", role: "AGENT_NE", password: "guinea123" },
    ] as const;

    for (const u of users) {
        const hash = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { role: u.role as any, password: hash },
            create: { email: u.email, role: u.role as any, password: hash },
        });
        console.log(`✔ upsert user: ${user.email} (${user.role})`);
    }

    // (Optionnel) Créer un convoi de test
    // const convoy = await prisma.convoy.upsert({
    //   where: { date: new Date("2025-09-10") },
    //   update: {},
    //   create: { date: new Date("2025-09-10") },
    // });
    // console.log(`✔ convoy: ${convoy.date.toISOString().slice(0,10)}`);

    console.log("✅ Seed completed");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
