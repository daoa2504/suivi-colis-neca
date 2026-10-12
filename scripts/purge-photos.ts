// scripts/purge-photos.ts
//
// Conservation des photos de colis : jusqu'à la récupération du colis,
// plus trois mois.
//
// La photo sert à identifier un carton pendant le transit, puis à départager
// en cas de réclamation. Passé ce délai elle n'a plus d'usage, et un volume
// qui ne se vide jamais finit par coûter plus que le service lui-même.
//
// Un colis encore en cours n'est jamais touché, quel que soit son âge :
// c'est la livraison qui lance le compte à rebours, pas l'enregistrement.
//
// Usage :
//   DATABASE_URL="..." UPLOADS_DIR="/data" npx tsx scripts/purge-photos.ts --dry-run
//   DATABASE_URL="..." UPLOADS_DIR="/data" npx tsx scripts/purge-photos.ts
//
// À lancer périodiquement (cron Railway, ou à la main quelques fois par an).

import { PrismaClient } from "@prisma/client";
import { deletePhotoFile, STORAGE_ROOT } from "../src/lib/photoStorage";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

/** Mois de sursis après la livraison. */
const GRACE_MONTHS = 3;

function cutoff(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - GRACE_MONTHS);
    return d;
}

function formatBytes(n: number): string {
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} ko`;
    return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

async function main() {
    const limit = cutoff();
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;

    console.log(`🎯 Base : ${host}`);
    console.log(`📁 Stockage : ${STORAGE_ROOT}`);
    console.log(
        `🗓️  Photos des colis livrés avant le ${limit.toLocaleDateString("fr-CA")}` +
        ` (livraison + ${GRACE_MONTHS} mois)`
    );
    if (DRY_RUN) console.log("   (DRY RUN — rien ne sera supprimé)");
    console.log("");

    const stale = await prisma.shipmentPhoto.findMany({
        where: {
            shipment: {
                status: "DELIVERED",
                deliveredAt: { not: null, lt: limit },
            },
        },
        select: {
            id: true,
            storageKey: true,
            thumbKey: true,
            byteSize: true,
            shipment: { select: { trackingId: true, deliveredAt: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    if (stale.length === 0) {
        const total = await prisma.shipmentPhoto.count();
        console.log(`✔ Rien à purger. ${total} photo(s) conservée(s).`);
        return;
    }

    const bytes = stale.reduce((sum, p) => sum + p.byteSize, 0);
    const parcels = new Set(stale.map((p) => p.shipment.trackingId));
    console.log(
        `${stale.length} photo(s) à purger sur ${parcels.size} colis — ${formatBytes(bytes)}`
    );

    for (const trackingId of Array.from(parcels).slice(0, 20)) {
        console.log(`  · ${trackingId}`);
    }
    if (parcels.size > 20) console.log(`  … et ${parcels.size - 20} autres`);

    if (DRY_RUN) return;

    let removed = 0;
    for (const photo of stale) {
        // Base d'abord : une ligne effacée sans son fichier ne laisse qu'un
        // octet perdu, l'inverse laisse une vignette cassée dans la galerie.
        await prisma.shipmentPhoto.delete({ where: { id: photo.id } });
        await deletePhotoFile(photo.storageKey);
        if (photo.thumbKey) await deletePhotoFile(photo.thumbKey);
        removed++;
    }

    const left = await prisma.shipmentPhoto.count();
    console.log(`\n✔ ${removed} photo(s) purgée(s). ${left} conservée(s).`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
