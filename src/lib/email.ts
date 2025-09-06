// src/lib/email.ts
// Petit wrapper autour de Resend (ou no-op si clé absente)

import type { Resend } from "resend";

let resend: Resend | null = null;

export function getResend() {
    if (!resend && process.env.RESEND_API_KEY) {
        // lazy import (pour éviter crash si pas installé en dev)
        const { Resend } = require("resend") as typeof import("resend");
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

export async function sendEmail(args: Parameters<NonNullable<Resend>["emails"]["send"]>[0]) {
    const r = getResend();
    if (!r) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[email] skipped (RESEND_API_KEY manquant)");
        }
        return;
    }
    return r.emails.send(args);
}
