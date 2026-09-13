// src/lib/branding.ts
//
// Références au logo NIMAPLEX, en un seul endroit.
// Le fichier était codé en dur dans huit fichiers (en-têtes de courriels,
// header de l'application, page de suivi, PDF de facture) : changer de
// logo demandait de tous les retrouver.
//
// Deux déclinaisons, parce qu'un même fichier ne peut pas servir les deux :
//   - LE SYMBOLE seul, carré, pour les petites surfaces (header 48 px,
//     vignettes de courriel 60 px, favicon). Le verrouillage complet y
//     serait illisible.
//   - LE VERROUILLAGE complet (symbole + nom + signature), pour les
//     en-têtes de documents, où la largeur existe.

/** Symbole seul, carré — petites surfaces. */
export const LOGO_MARK = "/img.png";

/** Verrouillage complet — en-têtes de documents (facture, liste de colisage). */
export const LOGO_FULL = "/logo-full.png";

/** Base publique du site, pour les courriels qui exigent une URL absolue. */
export function siteBaseUrl(): string {
    const raw = process.env.NEXT_PUBLIC_BASE_URL || "https://nimaplex.com";
    return raw.replace(/\/+$/, "");
}

/**
 * URL absolue du symbole, pour les gabarits de courriel.
 * Un client de messagerie n'a aucun contexte d'origine : un chemin relatif
 * ne s'y affiche pas.
 */
export function logoMarkUrl(): string {
    return `${siteBaseUrl()}${LOGO_MARK}`;
}

/** URL absolue du verrouillage complet. */
export function logoFullUrl(): string {
    return `${siteBaseUrl()}${LOGO_FULL}`;
}
