// src/instrumentation.ts
//
// Point d'entrée appelé une fois par Next.js au démarrage du serveur.
// C'est ici que vivent les travaux de fond, faute d'un processus séparé.
//
// Le test `NEXT_RUNTIME === "nodejs"` n'est pas qu'une précaution
// d'exécution : Next compile aussi ce fichier pour le runtime Edge, et
// c'est cette forme exacte qui lui permet d'écarter l'import du paquet
// Edge. Sans elle, le build échoue sur node:crypto, absent là-bas.
// Le reste des conditions (production, etc.) vit donc dans le module
// importé, pas ici.

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startPhotoRetention } = await import("./lib/photoRetention");
        startPhotoRetention();
    }
}
