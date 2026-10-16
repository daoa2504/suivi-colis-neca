// scripts/purge-photos.ts
//
// Purge manuelle des photos hors délai.
//
// La règle elle-même vit dans src/lib/photoRetention.ts, où le serveur la
// repasse aussi tout seul une fois par jour. Ce script sert à la déclencher
// à la demande, et surtout à regarder ce qui partirait avant de le laisser
// partir.
//
// Usage :
//   DATABASE_URL="..." UPLOADS_DIR="/data/photos" npx tsx scripts/purge-photos.ts --dry-run
//   DATABASE_URL="..." UPLOADS_DIR="/data/photos" npx tsx scripts/purge-photos.ts

import { prisma } from "../src/lib/prisma";
import { STORAGE_ROOT } from "../src/lib/photoStorage";
import { GRACE_MONTHS, purgeExpiredPhotos } from "../src/lib/photoRetention";

const DRY_RUN = process.argv.includes("--dry-run");

function formatBytes(n: number): string {
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} ko`;
    return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;

    console.log(`🎯 Base : ${host}`);
    console.log(`📁 Stockage : ${STORAGE_ROOT}`);
    if (DRY_RUN) console.log("   (DRY RUN — rien ne sera supprimé)");

    const summary = await purgeExpiredPhotos({ dryRun: DRY_RUN });

    console.log(
        `🗓️  Photos des colis livrés avant le ${summary.cutoff.toLocaleDateString("fr-CA")}` +
        ` (livraison + ${GRACE_MONTHS} mois)\n`
    );

    if (summary.found === 0) {
        const total = await prisma.shipmentPhoto.count();
        console.log(`✔ Rien à purger. ${total} photo(s) conservée(s).`);
        return;
    }

    console.log(
        `${summary.found} photo(s) concernée(s) sur ${summary.shipments} colis` +
        ` — ${formatBytes(summary.bytes)}`
    );
    for (const trackingId of summary.trackingIds.slice(0, 20)) {
        console.log(`  · ${trackingId}`);
    }
    if (summary.trackingIds.length > 20) {
        console.log(`  … et ${summary.trackingIds.length - 20} autres`);
    }

    if (DRY_RUN) {
        console.log("\n(DRY RUN — relancez sans --dry-run pour supprimer.)");
        return;
    }

    const left = await prisma.shipmentPhoto.count();
    console.log(`\n✔ ${summary.deleted} photo(s) purgée(s). ${left} conservée(s).`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
