// src/lib/itemKind.ts
//
// Nature du contenu d'un envoi : colis ordinaire ou appareil.
// Partagé entre les formulaires agents, la validation serveur et l'affichage,
// pour qu'une seule liste de types d'appareils fasse foi.

export type ItemKind = "PARCEL" | "DEVICE" | "MIXED";

/** Nature d'une ligne de contenu : jamais MIXED, qui est un résumé d'envoi. */
export type LineKind = "PARCEL" | "DEVICE";

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
    PARCEL: "Colis",
    DEVICE: "Appareil",
    MIXED: "Colis + appareil",
};

/**
 * Résume la nature d'un envoi à partir de ses lignes.
 * Un envoi qui porte les deux natures est MIXED ; c'est ce résumé qui
 * s'affiche dans les listes, pas le détail ligne à ligne.
 */
export function summarizeKind(lines: { itemKind: string }[]): ItemKind {
    const hasParcel = lines.some((l) => l.itemKind !== "DEVICE");
    const hasDevice = lines.some((l) => l.itemKind === "DEVICE");
    if (hasParcel && hasDevice) return "MIXED";
    if (hasDevice) return "DEVICE";
    return "PARCEL";
}

/**
 * Types d'appareils proposés dans les formulaires.
 * La liste n'est pas fermée : « Autre » ouvre un champ libre, et la valeur
 * finalement enregistrée reste une chaîne — ajouter une entrée ici ne
 * demande aucune migration.
 */
export const DEVICE_TYPES = [
    "Téléphone",
    "Tablette",
    "Ordinateur portable",
    "Ordinateur de bureau",
    "Télévision",
    "Imprimante",
    "Console de jeux",
    "Appareil photo",
    "Trottinette électrique",
    "Vélo électrique",
    "Machine à laver",
    "Réfrigérateur",
    "Congélateur",
    "Cuisinière",
    "Climatiseur",
    "Ventilateur",
    "Groupe électrogène",
    "Panneau solaire",
    "Équipement médical",
    "Machine à coudre",
] as const;

/** Valeur du <select> qui déclenche la saisie libre. */
export const DEVICE_TYPE_OTHER = "__AUTRE__";

/** Poids et dimensions ne sont exigés que pour un colis ordinaire. */
export function requiresWeight(kind: ItemKind): boolean {
    return kind === "PARCEL";
}

/** Résumé court pour les listes et les exports : « Colis », « Appareil · TV »,
 *  ou « Colis + appareil » quand l'envoi porte les deux natures. */
export function describeContent(
    kind: string | null | undefined,
    deviceType: string | null | undefined
): string {
    if (kind === "MIXED") return "Colis + appareil";
    if (kind === "DEVICE") {
        return deviceType ? `Appareil · ${deviceType}` : "Appareil";
    }
    return "Colis";
}

/** « 60 × 40 × 30 cm », ou null si les trois dimensions ne sont pas connues. */
export function formatDimensions(
    lengthCm: number | null | undefined,
    widthCm: number | null | undefined,
    heightCm: number | null | undefined
): string | null {
    if (!lengthCm || !widthCm || !heightCm) return null;
    return `${lengthCm} × ${widthCm} × ${heightCm} cm`;
}
