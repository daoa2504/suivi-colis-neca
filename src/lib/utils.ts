// src/lib/utils.ts
// Petites fonctions utilitaires réutilisables dans l'app

export function formatDate(input: string | Date) {
    const d = typeof input === "string" ? new Date(input) : input;
    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}
