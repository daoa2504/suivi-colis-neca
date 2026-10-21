// scripts/apply-convoy-price.ts
//
// Ajoute Convoy.pricePerKg : le tarif au kilo que l'administrateur fixe à la
// création du convoi, et dont se déduit le montant de chaque colis.
//
// Additif et idempotent : une colonne nullable, aucune donnée réécrite,
// aucune facture déjà émise touchée. Les convois existants restent sans
// tarif — les agents y saisissent le prix à la main, comme avant, jusqu'à
// ce qu'un tarif soit renseigné.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-convoy-price.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENTS = [
    `ALTER TABLE "public"."Convoy" ADD COLUMN IF NOT EXISTS "pricePerKg" DOUBLE PRECISION`,
];

async function hasColumn(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*)::bigint AS c FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Convoy'
            AND column_name = 'pricePerKg'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    console.log(`📋 Colonne Convoy.pricePerKg : ${(await hasColumn()) ? "déjà présente" : "absente"}`);

    if (DRY_RUN) {
        console.log("   → ajouterait la colonne (nullable, aucune valeur par défaut)");
        return;
    }

    for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
    }

    console.log(`✔ Colonne Convoy.pricePerKg : ${(await hasColumn()) ? "présente" : "ÉCHEC"}`);

    const total = await prisma.convoy.count();
    const priced = await prisma.convoy.count({ where: { pricePerKg: { not: null } } });
    console.log(`\n📊 ${total} convois — ${priced} avec un tarif au kilo`);
    console.log(
        "\nℹ️  Les convois sans tarif continuent de fonctionner comme avant :\n" +
        "   l'agent saisit le montant à la main. Renseignez le tarif dans\n" +
        "   Admin → Convois pour que le calcul devienne automatique."
    );
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
