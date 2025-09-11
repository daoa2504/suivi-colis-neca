import { Resend } from "resend";

export const FROM = process.env.EMAIL_FROM || "no-reply@migralex.net";
const client = new Resend(process.env.RESEND_API_KEY || "");

/**
 * Envoie un email avec retry (backoff) sur erreurs 429/5xx.
 * Retourne { ok, id?, error? }
 */
export async function sendEmailSafe(args: {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    reply_to?: string | string[];
}, maxRetries = 3) {
    if (!process.env.RESEND_API_KEY) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[email] RESEND_API_KEY manquante — envoi ignoré");
        }
        return { ok: true }; // no-op en dev sans clé
    }

    const payload = { from: args.from ?? FROM, ...args };

    let attempt = 0;
    while (true) {
        try {
            const res = await client.emails.send(payload as any);
            if ((res as any)?.error) throw new Error((res as any).error?.message || "Resend error");
            return { ok: true, id: (res as any)?.id };
        } catch (e: any) {
            attempt++;
            const msg = e?.message || String(e);
// Retry si 429/5xx (quand dispo dans e.status), sinon pas de retry
            const status = e?.status ?? e?.code;
            const retryable = status === 429 || (status >= 500 && status < 600);

            if (!retryable || attempt > maxRetries) {
                return { ok: false, error: msg };
            }
// backoff exponentiel simple
            const delay = Math.min(1500 * Math.pow(10, attempt - 1), 8000);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}