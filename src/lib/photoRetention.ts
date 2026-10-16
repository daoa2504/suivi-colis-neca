// src/lib/photoRetention.ts
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
// Ce module porte la règle ; deux choses l'appellent :
//   · scripts/purge-photos.ts, pour une purge manuelle (avec --dry-run) ;
//   · src/instrumentation.ts, qui la repasse une fois par jour.

import { prisma } from "./prisma";
import { deletePhotoFile } from "./photoStorage";

/** Mois de sursis après la livraison. */
export const GRACE_MONTHS = 3;

/** Date avant laquelle une livraison rend ses photos purgeables. */
export function retentionCutoff(now: Date = new Date()): Date {
    const d = new Date(now);
    d.setMonth(d.getMonth() - GRACE_MONTHS);
    return d;
}

export type PurgeSummary = {
    cutoff: Date;
    /** Photos concernées par la règle. */
    found: number;
    /** Photos effectivement supprimées (0 en simulation). */
    deleted: number;
    /** Colis distincts concernés. */
    shipments: number;
    bytes: number;
    trackingIds: string[];
};

/**
 * Supprime les photos hors délai.
 *
 * `dryRun` ne fait que regarder : c'est ce qui permet de vérifier ce qui
 * partirait avant de le laisser partir.
 */
export async function purgeExpiredPhotos(
    options: { dryRun?: boolean; now?: Date } = {}
): Promise<PurgeSummary> {
    const cutoff = retentionCutoff(options.now);

    const stale = await prisma.shipmentPhoto.findMany({
        where: {
            shipment: {
                status: "DELIVERED",
                deliveredAt: { not: null, lt: cutoff },
            },
        },
        select: {
            id: true,
            storageKey: true,
            thumbKey: true,
            byteSize: true,
            shipment: { select: { trackingId: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    const summary: PurgeSummary = {
        cutoff,
        found: stale.length,
        deleted: 0,
        shipments: new Set(stale.map((p) => p.shipment.trackingId)).size,
        bytes: stale.reduce((sum, p) => sum + p.byteSize, 0),
        trackingIds: Array.from(new Set(stale.map((p) => p.shipment.trackingId))),
    };

    if (options.dryRun) return summary;

    for (const photo of stale) {
        try {
            // Base d'abord : une ligne effacée sans son fichier ne laisse
            // qu'un octet perdu, l'inverse laisse une vignette cassée.
            await prisma.shipmentPhoto.delete({ where: { id: photo.id } });
            await deletePhotoFile(photo.storageKey);
            if (photo.thumbKey) await deletePhotoFile(photo.thumbKey);
            summary.deleted++;
        } catch (e) {
            // Une photo récalcitrante — déjà supprimée par ailleurs, fichier
            // verrouillé — ne doit pas arrêter la purge des autres. Elle
            // repassera au prochain tour.
            console.warn(`[photos] purge impossible pour ${photo.id}`, e);
        }
    }

    return summary;
}

// ─── Passage automatique ─────────────────────────────────────────────────

/** Une fois par jour. La règle porte sur une date, pas sur une fréquence :
 *  repasser souvent ne supprime rien de plus, cela évite seulement qu'un
 *  arriéré s'accumule si le service redémarre peu. */
const EVERY_DAY_MS = 24 * 60 * 60 * 1000;

/** Laisser le service démarrer avant de lancer quoi que ce soit de lourd. */
const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;

let started = false;

async function runOnce() {
    try {
        const summary = await purgeExpiredPhotos();
        if (summary.found > 0) {
            console.log(
                `[photos] purge : ${summary.deleted}/${summary.found} photo(s) supprimée(s)` +
                ` sur ${summary.shipments} colis livrés avant le ` +
                summary.cutoff.toISOString().slice(0, 10)
            );
        }
    } catch (e) {
        // Jamais de throw ici : une purge ratée ne doit pas faire tomber le
        // service. Elle repassera demain.
        console.error("[photos] purge automatique en échec", e);
    }
}

/**
 * Démarre le passage quotidien. Appelé une seule fois, au démarrage du
 * serveur, depuis src/instrumentation.ts.
 *
 * Pourquoi ici et non dans un service cron Railway : un volume Railway ne
 * se monte que sur un seul service. Un cron séparé verrait bien les lignes
 * en base, mais pas les fichiers à supprimer — il laisserait le volume se
 * remplir en croyant le vider.
 */
export function startPhotoRetention(): void {
    // En développement, le serveur redémarre à chaque modification : armer
    // une purge à chaque fois n'apporte rien et encombrerait les journaux.
    // Pour l'essayer en local : npx tsx scripts/purge-photos.ts --dry-run
    if (process.env.NODE_ENV !== "production") return;
    if (started) return;
    started = true;

    setTimeout(() => {
        void runOnce();
        // `unref` : ce minuteur ne doit jamais retenir le processus en vie.
        setInterval(() => void runOnce(), EVERY_DAY_MS).unref();
    }, FIRST_RUN_DELAY_MS).unref();

    console.log("[photos] purge automatique armée (passage quotidien)");
}
