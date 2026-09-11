// scripts/apply-item-kind.ts
//
// Applique la colonne « nature du contenu » (colis / appareil) à une base,
// y compris la production. Les fichiers de migration SQL étant gitignorés
// dans ce dépôt, le build Railway n'applique rien : ce script prend le relais.
//
// Purement additif et idempotent : un nouveau type enum et cinq colonnes
// nullables (sauf itemKind, qui a une valeur par défaut). Aucune colonne
// existante n'est modifiée ni supprimée, aucune ligne réécrite — les envois
// déjà en base deviennent des PARCEL, ce qu'ils sont.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-item-kind.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENTS = [
    `DO $$
     BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ItemKind') THEN
             CREATE TYPE "public"."ItemKind" AS ENUM ('PARCEL', 'DEVICE');
         END IF;
     END
     $$`,
    `ALTER TABLE "public"."Shipment"
         ADD COLUMN IF NOT EXISTS "itemKind"   "public"."ItemKind" NOT NULL DEFAULT 'PARCEL',
         ADD COLUMN IF NOT EXISTS "deviceType" TEXT,
         ADD COLUMN IF NOT EXISTS "lengthCm"   DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "widthCm"    DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "heightCm"   DOUBLE PRECISION`,
];

async function columns(): Promise<string[]> {
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Shipment'
            AND column_name IN ('itemKind','deviceType','lengthCm','widthCm','heightCm')
          ORDER BY column_name`
    );
    return rows.map((r) => r.column_name);
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    const before = await columns();
    console.log(`📋 Colonnes présentes avant : ${before.length ? before.join(", ") : "aucune"}`);

    if (DRY_RUN) {
        console.log("   → appliquerait le type ItemKind et les 5 colonnes manquantes");
        return;
    }

    for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
    }

    const after = await columns();
    console.log(`✔ Colonnes présentes après : ${after.join(", ")}`);

    const total = await prisma.shipment.count();
    const devices = await prisma.shipment.count({ where: { itemKind: "DEVICE" } });
    console.log(`\n📊 ${total} envois en base — ${total - devices} colis, ${devices} appareils`);
}

main()
    .catch((e) => {
        console.error("❌", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
