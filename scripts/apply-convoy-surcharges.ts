// scripts/apply-convoy-surcharges.ts
//
// Crée la table ConvoySurcharge : supplément facturé aux clients d'une ville
// donnée, pour un convoi donné (livraison vers Québec, par exemple).
//
// Additif et idempotent : nouvelle table seule, aucune colonne existante
// touchée, aucune facture déjà émise modifiée.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-convoy-surcharges.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS "public"."ConvoySurcharge" (
        "id"        TEXT NOT NULL,
        "convoyId"  TEXT NOT NULL,
        "city"      TEXT NOT NULL,
        "amount"    DECIMAL(12,2) NOT NULL,
        "currency"  "public"."Currency" NOT NULL DEFAULT 'CAD',
        "label"     TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ConvoySurcharge_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ConvoySurcharge_convoyId_city_key"
        ON "public"."ConvoySurcharge"("convoyId", "city")`,
    `CREATE INDEX IF NOT EXISTS "ConvoySurcharge_convoyId_idx"
        ON "public"."ConvoySurcharge"("convoyId")`,
    `DO $$
     BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ConvoySurcharge_convoyId_fkey'
        ) THEN
            ALTER TABLE "public"."ConvoySurcharge"
                ADD CONSTRAINT "ConvoySurcharge_convoyId_fkey"
                FOREIGN KEY ("convoyId") REFERENCES "public"."Convoy"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
     END
     $$`,
];

async function exists(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*)::bigint AS c FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ConvoySurcharge'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    console.log(`📋 Table ConvoySurcharge : ${(await exists()) ? "déjà présente" : "absente"}`);

    if (DRY_RUN) {
        console.log("   → créerait la table, ses index et sa clé étrangère");
        return;
    }

    for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
    }

    console.log(`✔ Table ConvoySurcharge : ${(await exists()) ? "présente" : "ÉCHEC"}`);

    const convoys = await prisma.convoy.count();
    const rows = await prisma.convoySurcharge.count();
    console.log(`\n📊 ${convoys} convois, ${rows} supplément(s) configuré(s)`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
