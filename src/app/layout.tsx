import "./globals.css";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import Header from "@/components/Header";
import Providers from "@/components/Providers"; // ✅

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "Suivi-Colis NIMAPLEX",
    icons: {
        icon: "/img.png", // ou /logo.png
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
