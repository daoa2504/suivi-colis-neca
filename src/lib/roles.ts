// src/lib/roles.ts
//
// Point unique de vérité pour les rôles et leurs périmètres.
// Toute vérification d'accès (page, route API, middleware, nav) passe par ici
// afin qu'un nouveau rôle n'oblige pas à retrouver 40 tests éparpillés.

export type AppRole = "ADMIN" | "AGENT_CA" | "AGENT_NE" | "AGENT_MARCHANDISE";

/** Rôles autorisés sur le module Marchandises (food / traçabilité ACIA). */
export const FOOD_ROLES: AppRole[] = ["ADMIN", "AGENT_MARCHANDISE"];

/** Rôles autorisés sur le module Colis (shipments, convois, finances…). */
export const SHIPPING_ROLES: AppRole[] = ["ADMIN", "AGENT_CA", "AGENT_NE"];

/** Accès au module Marchandises : /admin/food/** et /api/food/**. */
export function canAccessFood(role?: string | null): boolean {
    return FOOD_ROLES.includes(role as AppRole);
}

/** Accès au module Colis : /dashboard/**, /agent/**, reste de /admin/**. */
export function canAccessShipping(role?: string | null): boolean {
    return SHIPPING_ROLES.includes(role as AppRole);
}

/** Rôle cantonné aux marchandises : aucune vue sur les colis. */
export function isFoodOnly(role?: string | null): boolean {
    return role === "AGENT_MARCHANDISE";
}

/** Page d'atterrissage après connexion, selon le rôle. */
export function homePathForRole(role?: string | null): string {
    switch (role) {
        case "ADMIN":
            return "/admin";
        case "AGENT_CA":
            return "/agent/ca";
        case "AGENT_NE":
            return "/agent/ne";
        case "AGENT_MARCHANDISE":
            return "/admin/food";
        default:
            return "/track";
    }
}

export const ROLE_LABEL: Record<string, string> = {
    ADMIN: "Admin",
    AGENT_CA: "Agent Canada",
    AGENT_NE: "Agent Niger",
    AGENT_MARCHANDISE: "Agent Marchandises",
};

export const ROLE_BADGE: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    AGENT_CA: "bg-red-100 text-red-800",
    AGENT_NE: "bg-green-100 text-green-800",
    AGENT_MARCHANDISE: "bg-emerald-100 text-emerald-800",
};
