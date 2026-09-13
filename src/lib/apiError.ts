// src/lib/apiError.ts
//
// Met en forme l'erreur renvoyée par une route API pour l'afficher à l'agent.
//
// Une erreur de validation Zod arrive sous la forme d'un objet
// { formErrors: [...], fieldErrors: { champ: [messages] } }. Interpolé
// directement dans une chaîne, il s'affiche « [object Object] » et l'agent
// n'a aucune idée du champ fautif.

/** Libellés lisibles des champs, pour ne pas afficher les noms techniques. */
const FIELD_LABEL: Record<string, string> = {
    receiverName: "Nom du destinataire",
    receiverEmail: "Courriel du destinataire",
    receiverPhone: "Téléphone",
    receiverAddress: "Adresse",
    receiverCity: "Ville",
    receiverPoBox: "Code postal / boîte postale",
    weightKg: "Poids",
    itemKind: "Nature du contenu",
    deviceType: "Type d'appareil",
    lengthCm: "Longueur",
    widthCm: "Largeur",
    heightCm: "Hauteur",
    packageCount: "Nombre de cartons",
    pickupLastName: "Nom du récupérateur",
    pickupFirstName: "Prénoms du récupérateur",
    pickupQuartier: "Quartier du récupérateur",
    pickupPhone: "Téléphone du récupérateur",
    convoyId: "Convoi",
    notes: "Notes",
};

/**
 * Transforme le corps d'une réponse d'erreur en message affichable.
 * Accepte une chaîne, un objet Zod aplati, ou n'importe quoi d'autre.
 */
export function formatApiError(error: unknown, fallback = "Opération échouée"): string {
    if (!error) return fallback;
    if (typeof error === "string") return error;

    if (typeof error === "object") {
        const e = error as any;

        // Erreur applicative { message: "..." }
        if (typeof e.message === "string" && e.message) return e.message;

        // Sortie de ZodError.flatten()
        const parts: string[] = [];

        const fieldErrors = e.fieldErrors as Record<string, string[]> | undefined;
        if (fieldErrors) {
            for (const [field, messages] of Object.entries(fieldErrors)) {
                if (!messages?.length) continue;
                parts.push(`${FIELD_LABEL[field] ?? field} : ${messages.join(", ")}`);
            }
        }

        const formErrors = e.formErrors as string[] | undefined;
        if (formErrors?.length) parts.push(...formErrors);

        if (parts.length > 0) return parts.join(" · ");
    }

    return fallback;
}
