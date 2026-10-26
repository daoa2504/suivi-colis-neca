// src/lib/cityServer.ts
//
// Normalisation de la ville au moment d'enregistrer un envoi.
//
// Nettoyer l'affichage ne suffit pas : tant que chaque saisie ajoute sa
// propre graphie, la base continue de diverger et le moindre écran qui
// oublie de regrouper réaffiche des doublons. On arrête donc le mal à
// l'entrée.
//
// Le principe : une ville déjà connue de la base impose son orthographe à
// toutes les saisies suivantes. Le formulaire Canada → Niger laisse l'agent
// taper librement ; « montreal » tapé à la hâte devient « Montréal » parce
// que 125 colis l'écrivent déjà ainsi.

import { prisma } from "./prisma";
import { bestCitySpelling, cityVariantsOf, tidyCityName } from "./city";

/**
 * Orthographe à enregistrer pour une ville saisie.
 *
 * Renvoie `null` pour une saisie vide. Une ville inconnue est simplement
 * nettoyée de ses espaces superflus : c'est peut-être une nouvelle
 * destination, et la corriger d'office serait présumer d'une faute.
 */
export async function resolveCityName(
    raw: string | null | undefined
): Promise<string | null> {
    const tidy = tidyCityName(raw);
    if (!tidy) return null;

    const known = await prisma.shipment.findMany({
        where: { receiverCity: { not: null } },
        select: { receiverCity: true },
        distinct: ["receiverCity"],
    });

    const variants = cityVariantsOf(tidy, known.map((k) => k.receiverCity));

    // La saisie entre en concurrence avec les graphies déjà en base : si
    // l'agent écrit mieux que l'existant (« Gatineau » quand la base ne
    // connaît que « GATINEAU »), c'est sa version qui l'emporte, et la
    // suivante s'alignera dessus.
    return bestCitySpelling([tidy, ...variants]);
}
