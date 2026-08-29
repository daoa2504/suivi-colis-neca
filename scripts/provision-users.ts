// scripts/provision-users.ts
//
// Provisionnement ciblé — à lancer manuellement, y compris sur la base de production.
// Contrairement à `prisma db seed`, ce script ne touche QUE :
//   1. l'ajout de la valeur AGENT_MARCHANDISE à l'enum Role (idempotent) ;
//   2. les comptes listés dans TARGETS ci-dessous.
// Aucun autre utilisateur, aucune autre table, aucune synchronisation de schéma.
//
// ⚠️ Dépôt public : aucun mot de passe en clair dans ce fichier. Ils sont lus
// dans l'environnement, et le script refuse de s'exécuter s'ils manquent.
//
// Usage :
//   DATABASE_URL="postgresql://..." SODIK_PASSWORD="..." AASODIK_PASSWORD="..." \
//     npx tsx scripts/provision-users.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const TARGETS = [
    {
        username: "Sodik",
        email: "www.sodikabdouramane@gmail.com",
        role: "AGENT_MARCHANDISE",
        password: process.env.SODIK_PASSWORD,
    },
    {
        username: "AASodik",
        email: null as string | null,
        role: "AGENT_CA",
        password: process.env.AASODIK_PASSWORD,
    },
];

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    // --- 1. Enum Role -------------------------------------------------------
    const enumValues = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
        `SELECT e.enumlabel
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'Role'
          ORDER BY e.enumsortorder`
    );
    const labels = enumValues.map((r) => r.enumlabel);
    console.log(`📋 Enum Role avant : ${labels.join(", ")}`);

    if (!labels.includes("AGENT_MARCHANDISE")) {
        if (DRY_RUN) {
            console.log("   → ajouterait AGENT_MARCHANDISE");
        } else {
            // ADD VALUE ne peut pas être utilisé dans la même transaction que son usage :
            // exécuté seul, avant les upserts.
            await prisma.$executeRawUnsafe(
                `ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'AGENT_MARCHANDISE'`
            );
            console.log("   ✔ AGENT_MARCHANDISE ajouté à l'enum");
        }
    } else {
        console.log("   ✔ AGENT_MARCHANDISE déjà présent");
    }

    // --- 2. Comptes ---------------------------------------------------------
    console.log("");
    for (const t of TARGETS) {
        const before = await prisma.user.findUnique({
            where: { username: t.username },
            select: { id: true, username: true, email: true, role: true },
        });

        console.log(
            before
                ? `👤 ${t.username} : existe (rôle ${before.role}) → ${t.role}`
                : `👤 ${t.username} : à créer (rôle ${t.role})`
        );

        if (DRY_RUN) continue;

        if (!t.password) {
            throw new Error(
                `Mot de passe manquant pour ${t.username}. ` +
                `Définis la variable d'environnement correspondante avant de relancer.`
            );
        }

        const hash = await bcrypt.hash(t.password, 10);
        const user = await prisma.user.upsert({
            where: { username: t.username },
            update: { role: t.role as any, password: hash, email: t.email as any },
            create: {
                username: t.username,
                email: t.email as any,
                role: t.role as any,
                password: hash,
            },
            select: { id: true, username: true, role: true },
        });
        console.log(`   ✔ ${user.username} → ${user.role}`);
    }

    // --- 3. État final ------------------------------------------------------
    const all = await prisma.user.findMany({
        select: { username: true, role: true },
        orderBy: [{ role: "asc" }, { username: "asc" }],
    });
    console.log("\n📊 Utilisateurs en base :");
    for (const u of all) console.log(`   ${u.username.padEnd(14)} ${u.role}`);
}

main()
    .catch((e) => {
        console.error("❌", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
