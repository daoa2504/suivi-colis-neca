// scripts/apply-item-lines.ts
//
// Porte la nature du contenu au niveau de la ligne, pour qu'un envoi puisse
// contenir à la fois des colis et des appareils sous un seul numéro de suivi.
//
// Additif et idempotent :
//   - valeur MIXED ajoutée à l'enum ItemKind (résumé au niveau de l'envoi) ;
//   - colonnes itemKind / deviceType / lengthCm / widthCm / heightCm ajoutées
//     à ShipmentItem.
//
// Aucune colonne existante n'est modifiée. Les lignes déjà en base
// deviennent des PARCEL, ce qu'elles sont.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-item-lines.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENTS = [
    // ADD VALUE ne peut pas être utilisé dans la même transaction que son
    // usage : exécuté seul, avant les colonnes.
    `ALTER TYPE "public"."ItemKind" ADD VALUE IF NOT EXISTS 'MIXED'`,
    `ALTER TABLE "public"."ShipmentItem"
         ADD COLUMN IF NOT EXISTS "itemKind"   "public"."ItemKind" NOT NULL DEFAULT 'PARCEL',
         ADD COLUMN IF NOT EXISTS "deviceType" TEXT,
         ADD COLUMN IF NOT EXISTS "lengthCm"   DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "widthCm"    DOUBLE PRECISION,
         ADD COLUMN IF NOT EXISTS "heightCm"   DOUBLE PRECISION`,
];

async function state() {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ShipmentItem'
            AND column_name IN ('itemKind','deviceType','lengthCm','widthCm','heightCm')
          ORDER BY column_name`
    );
    const labels = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
        `SELECT e.enumlabel FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'ItemKind' ORDER BY e.enumsortorder`
    );
    return {
        cols: cols.map((c) => c.column_name),
        enums: labels.map((l) => l.enumlabel),
    };
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    const before = await state();
    console.log(`📋 Enum ItemKind : ${before.enums.join(", ")}`);
    console.log(`📋 Colonnes ShipmentItem : ${before.cols.length ? before.cols.join(", ") : "aucune"}`);

    if (DRY_RUN) {
        console.log("\n   → ajouterait MIXED et les 5 colonnes manquantes");
        return;
    }

    for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
    }

    const after = await state();
    console.log(`\n✔ Enum ItemKind : ${after.enums.join(", ")}`);
    console.log(`✔ Colonnes ShipmentItem : ${after.cols.join(", ")}`);

    const items = await prisma.shipmentItem.count();
    const shipments = await prisma.shipment.count();
    console.log(`\n📊 ${shipments} envois, ${items} lignes de contenu en base`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
