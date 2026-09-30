// scripts/apply-shipment-surcharge.ts
//
// Ajoute Shipment.surchargeAmount : instantané du supplément de ville figé au
// moment de l'enregistrement. Stocké à part de totalAmount, qui reste le prix
// convenu — sans quoi réenregistrer un colis l'ajouterait une seconde fois.
//
// Additif et idempotent. Les envois existants restent à NULL, donc sans
// supplément : aucune facture ni aucun montant dû ne change rétroactivement.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-shipment-surcharge.ts
//   ... --dry-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENT = `ALTER TABLE "public"."Shipment"
    ADD COLUMN IF NOT EXISTS "surchargeAmount" DOUBLE PRECISION`;

async function present(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*)::bigint AS c FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Shipment'
            AND column_name = 'surchargeAmount'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    console.log(`📋 Colonne surchargeAmount : ${(await present()) ? "déjà présente" : "absente"}`);

    if (DRY_RUN) {
        console.log("   → ajouterait la colonne");
        return;
    }

    await prisma.$executeRawUnsafe(STATEMENT);
    console.log(`✔ Colonne surchargeAmount : ${(await present()) ? "présente" : "ÉCHEC"}`);

    const total = await prisma.shipment.count();
    const withSurcharge = await prisma.shipment.count({
        where: { surchargeAmount: { not: null } },
    });
    console.log(`\n📊 ${total} envois — ${withSurcharge} avec supplément`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
