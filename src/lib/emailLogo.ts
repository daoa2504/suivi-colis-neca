// src/lib/emailLogo.ts
//
// Logo NIMAPLEX intégré aux courriels, en pièce jointe « inline ».
//
// Pourquoi pas une simple URL : une balise <img src="https://…"> dépend de
// deux choses fragiles. D'abord que NEXT_PUBLIC_BASE_URL soit correctement
// renseignée sur l'environnement d'exécution — une valeur de développement
// oubliée suffit à casser toutes les images. Ensuite que le client de
// messagerie accepte de charger une image distante, ce que Gmail et Outlook
// refusent par défaut tant que le destinataire ne clique pas.
//
// Une pièce jointe inline référencée par « cid: » échappe aux deux :
// l'image voyage dans le message et s'affiche sans requête réseau.
//
// Module serveur uniquement (lecture disque) : ne pas l'importer depuis un
// composant client.

import fs from "node:fs";
import path from "node:path";
import type { EmailAttachment } from "@/lib/email";
import { EMAIL_LOGO_CID } from "@/lib/branding";

// undefined = pas encore tenté ; null = fichier introuvable, ne pas réessayer
let cached: EmailAttachment | null | undefined;

/**
 * Pièce jointe inline à ajouter à l'envoi, ou null si le fichier manque.
 * Dans ce cas le courriel part quand même, avec une image cassée plutôt
 * qu'un échec d'envoi.
 */
export function emailLogoAttachment(): EmailAttachment | null {
    if (cached !== undefined) return cached;

    try {
        const file = path.join(process.cwd(), "public", "logo-banner.png");
        cached = {
            filename: "groupe-nimaplex.png",
            content: fs.readFileSync(file),
            contentType: "image/png",
            inlineContentId: EMAIL_LOGO_CID,
        };
    } catch {
        console.warn("[emailLogo] public/logo-banner.png introuvable — courriels sans logo");
        cached = null;
    }

    return cached;
}

/**
 * Concatène le logo aux pièces jointes déjà prévues pour un envoi.
 * Rend l'appel sur les sites d'envoi tenant en une ligne.
 */
export function withEmailLogo(
    attachments?: EmailAttachment[] | null
): EmailAttachment[] | undefined {
    const logo = emailLogoAttachment();
    const list = [...(attachments ?? [])];
    if (logo) list.push(logo);
    return list.length > 0 ? list : undefined;
}
