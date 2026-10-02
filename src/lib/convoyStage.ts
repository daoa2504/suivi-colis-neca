// src/lib/convoyStage.ts
//
// Où en est un convoi, déduit du statut de ses colis.
//
// Il n'existe pas de champ « état » sur Convoy, et il n'en faut pas un : la
// notification fait avancer le statut des colis, qui est donc déjà la source
// de vérité. En dériver l'état du convoi évite d'avoir deux vérités à tenir
// synchronisées.

/** Étapes dans l'ordre du parcours réel. */
export const STAGES = ["RECEIVED", "IN_TRANSIT", "IN_CUSTOMS", "READY", "DELIVERED"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
    RECEIVED: "Reçu",
    IN_TRANSIT: "En route",
    IN_CUSTOMS: "À la douane",
    READY: "Prêt pour récupération",
    DELIVERED: "Récupéré",
};

/** Étape atteinte par une notification donnée. */
export const TEMPLATE_STAGE: Record<string, Stage> = {
    EN_ROUTE: "IN_TRANSIT",
    IN_CUSTOMS: "IN_CUSTOMS",
    OUT_FOR_DELIVERY: "READY",
};

/** Les deux statuts de réception, selon le sens, désignent la même étape. */
function stageOf(status: string): Stage {
    switch (status) {
        case "IN_TRANSIT":
        case "IN_TRANSIT_STOP":
            return "IN_TRANSIT";
        case "IN_CUSTOMS":
            return "IN_CUSTOMS";
        case "READY_FOR_PICKUP":
            return "READY";
        case "DELIVERED":
            return "DELIVERED";
        default:
            return "RECEIVED";
    }
}

export type ConvoyProgress = {
    /** Nombre de colis par étape. */
    counts: Record<Stage, number>;
    total: number;
    /** Étape la moins avancée parmi les colis : ce qu'il reste à faire. */
    lowest: Stage;
    /** Étape la plus avancée atteinte. */
    highest: Stage;
    /** Vrai si tous les colis ne sont pas à la même étape. */
    mixed: boolean;
};

export function convoyProgress(statusCounts: Record<string, number>): ConvoyProgress {
    const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;

    let total = 0;
    for (const [status, n] of Object.entries(statusCounts ?? {})) {
        counts[stageOf(status)] += n;
        total += n;
    }

    const present = STAGES.filter((s) => counts[s] > 0);
    const lowest = present[0] ?? "RECEIVED";
    const highest = present[present.length - 1] ?? "RECEIVED";

    return { counts, total, lowest, highest, mixed: present.length > 1 };
}

/**
 * Comment se situe une notification par rapport à l'état du convoi.
 *   done     — tous les colis ont déjà dépassé ou atteint cette étape
 *   partial  — une partie seulement, typiquement après un envoi filtré par ville
 *   next     — l'étape qui suit logiquement
 *   ahead    — saute une ou plusieurs étapes
 */
export type TemplateState = "done" | "partial" | "next" | "ahead";

export function templateState(
    progress: ConvoyProgress,
    template: string
): { state: TemplateState; reached: number } {
    const target = TEMPLATE_STAGE[template];
    if (!target) return { state: "next", reached: 0 };

    const targetIndex = STAGES.indexOf(target);
    const reached = STAGES.filter((_, i) => i >= targetIndex).reduce(
        (acc, s) => acc + progress.counts[s],
        0
    );

    if (progress.total === 0) return { state: "next", reached: 0 };
    if (reached >= progress.total) return { state: "done", reached };
    if (reached > 0) return { state: "partial", reached };

    // Aucun colis à cette étape : est-ce bien la suivante ?
    const lowestIndex = STAGES.indexOf(progress.lowest);
    return { state: targetIndex === lowestIndex + 1 ? "next" : "ahead", reached: 0 };
}
