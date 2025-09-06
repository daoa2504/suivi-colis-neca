import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// adresse par défaut (définie dans tes variables Railway)
export const FROM = process.env.EMAIL_FROM || "noreply@example.com";
