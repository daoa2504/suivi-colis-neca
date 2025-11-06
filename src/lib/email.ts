// src/lib/email.ts
import { Resend } from "resend";

export const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const client = new Resend(process.env.RESEND_API_KEY || "");

// ✅ Ajoutez ceci pour vérifier au démarrage
console.log("📧 Email config loaded:");
console.log("  - FROM:", FROM);
console.log("  - API Key:", process.env.RESEND_API_KEY ? `✅ Set (${process.env.RESEND_API_KEY.substring(0, 10)}...)` : "❌ Missing");

export type Direction = "NE_TO_CA" | "CA_TO_NE";

export function inferDirection(opts: {
    convoyDirection?: Direction | null;
    originCountry?: string | null;
    destinationCountry?: string | null;
}): Direction {
    if (opts.convoyDirection) return opts.convoyDirection;
    const o = (opts.originCountry || "").toLowerCase();
    const d = (opts.destinationCountry || "").toLowerCase();
    if (o.includes("niger") && d.includes("canada")) return "NE_TO_CA";
    if (o.includes("canada") && d.includes("niger")) return "CA_TO_NE";
    return "NE_TO_CA";
}

export function footerFor(direction: Direction) {
    return direction === "NE_TO_CA" ? "— Équipe NE → CA" : "— Équipe CA → NE";
}

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
            console.warn("[email] ⚠️ RESEND_API_KEY manquante — envoi ignoré");
        }
        return { ok: true }; // no-op en dev sans clé
    }

    const payload = { from: args.from ?? FROM, ...args };

    // ✅ Log l'envoi
    console.log("📧 Sending email:");
    console.log("  - From:", payload.from);
    console.log("  - To:", args.to);
    console.log("  - Subject:", args.subject);

    let attempt = 0;
    while (true) {
        try {
            const res = await client.emails.send(payload as any);

            if ((res as any)?.error) {
                console.error("❌ Resend error:", (res as any).error);
                throw new Error((res as any).error?.message || "Resend error");
            }

            console.log("✅ Email sent successfully! ID:", (res as any)?.id);
            return { ok: true, id: (res as any)?.id };
        } catch (e: any) {
            attempt++;
            const msg = e?.message || String(e);
            const status = e?.status ?? e?.code;
            const retryable = status === 429 || (status >= 500 && status < 600);

            console.error(`❌ Attempt ${attempt} failed:`, msg);

            if (!retryable || attempt > maxRetries) {
                console.error("❌ Max retries reached or non-retryable error");
                return { ok: false, error: msg };
            }

            const delay = Math.min(1500 * Math.pow(2, attempt - 1), 8000);
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}