// src/lib/email.ts
import { Resend } from "resend";

// adresse par défaut (peut être écrasée à l'appel)
export const FROM = process.env.EMAIL_FROM || "no-reply@migralex.net";

// Client Resend (si la clé manque, on crée quand même l'instance mais on ne tente pas d'envoyer)
const client = new Resend(process.env.RESEND_API_KEY || "");

/**
 * Petit helper pour envoyer un email. Utilise FROM par défaut.
 * N'échoue pas le build si RESEND_API_KEY est absente (log + no-op en dev).
 */
export async function sendEmail(args: {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    reply_to?: string | string[];
}) {
    if (!process.env.RESEND_API_KEY) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[email] RESEND_API_KEY manquante — envoi ignoré");
        }
        return;
    }

    // applique l'expéditeur par défaut si non fourni
    const payload = { from: args.from ?? FROM, ...args };

    return client.emails.send(payload as any);
}
