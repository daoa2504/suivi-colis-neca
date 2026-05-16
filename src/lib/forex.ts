// src/lib/forex.ts
// Récupération + cache des taux de change via frankfurter.app (gratuit, BCE)
import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type Currency = "CAD" | "XOF";

/**
 * Retourne le taux 1 {base} = X {target}, en utilisant le cache DB si frais (<24h).
 * Sinon fetch frankfurter.app et met à jour le cache.
 */
export async function getRate(base: Currency, target: Currency): Promise<number> {
    if (base === target) return 1;

    const cached = await prisma.exchangeRate.findUnique({
        where: { base_target: { base, target } },
    });

    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
        return cached.rate;
    }

    // Frankfurter ne supporte pas XOF directement → fallback via EUR si nécessaire
    const supported = ["EUR", "USD", "CAD", "GBP", "CHF", "JPY", "AUD", "CNY"];
    let rate: number;

    const baseStr: string = base;
    const targetStr: string = target;

    if (supported.includes(baseStr) && supported.includes(targetStr)) {
        rate = await fetchFrankfurter(baseStr, targetStr);
    } else {
        // Convertir via EUR (XOF a un peg fixe à l'EUR : 1 EUR = 655.957 XOF)
        const XOF_PER_EUR = 655.957;
        if (targetStr === "XOF") {
            const baseToEur = baseStr === "EUR" ? 1 : await fetchFrankfurter(baseStr, "EUR");
            rate = baseToEur * XOF_PER_EUR;
        } else if (baseStr === "XOF") {
            const eurToTarget = targetStr === "EUR" ? 1 : await fetchFrankfurter("EUR", targetStr);
            rate = eurToTarget / XOF_PER_EUR;
        } else {
            rate = await fetchFrankfurter(baseStr, targetStr);
        }
    }

    await prisma.exchangeRate.upsert({
        where: { base_target: { base, target } },
        update: { rate, fetchedAt: new Date() },
        create: { base, target, rate, fetchedAt: new Date() },
    });

    return rate;
}

async function fetchFrankfurter(from: string, to: string): Promise<number> {
    const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`frankfurter.app ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.[to];
    if (typeof rate !== "number") throw new Error(`Pas de taux ${from}->${to}`);
    return rate;
}

/** Convertit `amount` de `from` vers `to`. */
export async function convert(amount: number, from: Currency, to: Currency): Promise<number> {
    if (from === to) return amount;
    const rate = await getRate(from, to);
    return amount * rate;
}
