// scripts/apply-shipment-photos.ts
//
// Crée la table ShipmentPhoto : photos prises à la réception d'un colis et
// conservées comme preuve de son état et de son contenu.
//
// Seules les métadonnées vivent ici. Les fichiers sont sur le volume monté
// (UPLOADS_DIR) : une base alourdie de photos ralentirait chaque sauvegarde.
//
// Additif et idempotent : nouvelle table seule, aucune colonne existante
// touchée, aucune donnée réécrite.
//
// Usage :
//   DATABASE_URL="postgresql://..." npx tsx scripts/apply-shipment-photos.ts
//   ... --dry-run   pour n'afficher que l'état courant, sans rien écrire.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS "public"."ShipmentPhoto" (
        "id"          TEXT NOT NULL,
        "shipmentId"  INTEGER NOT NULL,
        "storageKey"  TEXT NOT NULL,
        "thumbKey"    TEXT,
        "mimeType"    TEXT NOT NULL,
        "byteSize"    INTEGER NOT NULL,
        "width"       INTEGER,
        "height"      INTEGER,
        "caption"     TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdById" TEXT,
        CONSTRAINT "ShipmentPhoto_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ShipmentPhoto_storageKey_key"
        ON "public"."ShipmentPhoto"("storageKey")`,
    `CREATE INDEX IF NOT EXISTS "ShipmentPhoto_shipmentId_idx"
        ON "public"."ShipmentPhoto"("shipmentId")`,
    // Suppression en cascade : effacer un colis doit emporter ses photos,
    // sinon la base garde des lignes qui ne désignent plus rien.
    `DO $$
     BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ShipmentPhoto_shipmentId_fkey'
        ) THEN
            ALTER TABLE "public"."ShipmentPhoto"
                ADD CONSTRAINT "ShipmentPhoto_shipmentId_fkey"
                FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
     END
     $$`,
    // L'auteur, en revanche, est seulement mis à NULL : supprimer un compte
    // d'agent ne doit pas faire disparaître la preuve qu'il a photographiée.
    `DO $$
     BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'ShipmentPhoto_createdById_fkey'
        ) THEN
            ALTER TABLE "public"."ShipmentPhoto"
                ADD CONSTRAINT "ShipmentPhoto_createdById_fkey"
                FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
                ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
     END
     $$`,
];

async function exists(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*)::bigint AS c FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ShipmentPhoto'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    console.log(`🎯 Base ciblée : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    console.log(`📋 Table ShipmentPhoto : ${(await exists()) ? "déjà présente" : "absente"}`);

    if (DRY_RUN) {
        console.log("   → créerait la table, ses index et ses deux clés étrangères");
        return;
    }

    for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
    }

    console.log(`✔ Table ShipmentPhoto : ${(await exists()) ? "présente" : "ÉCHEC"}`);

    const shipments = await prisma.shipment.count();
    const photos = await prisma.shipmentPhoto.count();
    console.log(`\n📊 ${shipments} colis, ${photos} photo(s) enregistrée(s)`);
    console.log(
        "\n⚠️  Côté Railway, le service doit avoir un volume monté et UPLOADS_DIR\n" +
        "   pointant dessus. Sans cela, les envois échoueront ou seront perdus\n" +
        "   au prochain déploiement."
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
