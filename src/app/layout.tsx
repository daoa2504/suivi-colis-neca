import "./globals.css";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import Header from "@/components/Header";
import Providers from "@/components/Providers"; // ✅

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "NIMAPLEX — Suivi de colis Niger ↔ Canada",
    description:
        "Suivez en direct votre colis entre le Niger et le Canada : statut, étape actuelle, date de récupération prévue. Entrez votre numéro de suivi pour voir où en est votre envoi.",
    icons: {
        icon: "/img.png",
    },
    openGraph: {
        title: "NIMAPLEX — Suivi de colis Niger ↔ Canada",
        description:
            "Suivez en direct votre colis entre le Niger et le Canada. Plus qu'une solution, un service d'excellence globale.",
        type: "website",
        locale: "fr_CA",
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="fr" className={inter.className}>
        <body>
        <Providers>
            <Header />
            <main>{children}</main>
        </Providers>
        </body>
        </html>
    );
}
