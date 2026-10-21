// src/lib/__tests__/pricing.test.ts
//
// Le montant d'une facture ne se vérifie pas à l'œil : il est calculé une
// fois dans le navigateur, pour que l'agent le voie, et une seconde fois sur
// le serveur, qui tranche. Ces tests gardent les deux sur la même formule.

import { describe, expect, it } from "vitest";
import {
    currencyForDirection,
    formatMoney,
    quote,
    roundMoney,
    totalWeightKg,
} from "../pricing";
import { decidePricing } from "../pricingServer";

describe("currencyForDirection", () => {
    it("facture en FCFA depuis le Niger et en dollars depuis le Canada", () => {
        // C'est l'expéditeur qui paie, et il paie chez lui.
        expect(currencyForDirection("NE_TO_CA")).toBe("XOF");
        expect(currencyForDirection("CA_TO_NE")).toBe("CAD");
    });

    it("retombe sur le FCFA sans direction connue", () => {
        expect(currencyForDirection(null)).toBe("XOF");
    });
});

describe("roundMoney", () => {
    it("ne laisse pas de centimes en FCFA", () => {
        // Le franc CFA n'a pas de sous-unité : annoncer 3 325,40 FCFA
        // promet une précision qui n'existe pas à la caisse.
        expect(roundMoney(3325.4, "XOF")).toBe(3325);
        expect(roundMoney(3325.6, "XOF")).toBe(3326);
    });

    it("garde le cent en dollars", () => {
        expect(roundMoney(12.345, "CAD")).toBe(12.35);
        expect(roundMoney(0.1 + 0.2, "CAD")).toBe(0.3);
    });
});

describe("totalWeightKg", () => {
    it("multiplie le poids par la quantité", () => {
        // Le poids d'une ligne est unitaire — trois cartons de 2 kg font 6 kg.
        expect(totalWeightKg([{ weightKg: 2, quantity: 3 }])).toBe(6);
    });

    it("additionne les lignes", () => {
        expect(
            totalWeightKg([
                { weightKg: 2, quantity: 2 },
                { weightKg: 1.5, quantity: 1 },
            ])
        ).toBe(5.5);
    });

    it("accepte les champs de formulaire, virgule comprise", () => {
        expect(totalWeightKg([{ weightKg: "1,5", quantity: "2" }])).toBe(3);
    });

    it("ignore les lignes non pesées sans perdre les autres", () => {
        // Un appareil non pesé accompagne souvent un carton pesé.
        expect(
            totalWeightKg([
                { weightKg: null, quantity: 1 },
                { weightKg: 4, quantity: 1 },
            ])
        ).toBe(4);
    });

    it("rend null quand rien n'est pesé", () => {
        expect(totalWeightKg([{ weightKg: null, quantity: 1 }])).toBeNull();
        expect(totalWeightKg([])).toBeNull();
        expect(totalWeightKg(null)).toBeNull();
    });

    it("traite une quantité absente comme 1", () => {
        expect(totalWeightKg([{ weightKg: 3 }])).toBe(3);
    });
});

describe("quote", () => {
    it("chiffre un envoi en FCFA", () => {
        expect(quote(2500, 4.5, "XOF")).toMatchObject({ amount: 11250, currency: "XOF" });
    });

    it("chiffre un envoi en dollars", () => {
        expect(quote(12.5, 2, "CAD")).toMatchObject({ amount: 25, currency: "CAD" });
    });

    it("refuse de chiffrer sans poids", () => {
        // Un appareil non pesé ne se tarifie pas au kilo. Mieux vaut laisser
        // l'agent saisir le prix qu'inventer un poids.
        expect(quote(2500, null, "XOF")).toBeNull();
        expect(quote(2500, 0, "XOF")).toBeNull();
    });

    it("refuse de chiffrer sans tarif", () => {
        expect(quote(null, 4, "XOF")).toBeNull();
        expect(quote(0, 4, "XOF")).toBeNull();
    });
});

describe("decidePricing", () => {
    const lines = [{ weightKg: 2, quantity: 2 }]; // 4 kg

    it("impose le tarif, quoi qu'annonce le formulaire", () => {
        // Le navigateur peut envoyer n'importe quel montant : c'est le
        // serveur qui arrête le prix.
        const d = decidePricing({
            direction: "NE_TO_CA",
            pricePerKg: 2500,
            lines,
            submittedAmount: 1,
        });
        expect(d.totalAmount).toBe(10000);
        expect(d.currency).toBe("XOF");
        expect(d.overridden).toBe(false);
    });

    it("impose la devise du sens, même si le client en annonce une autre", () => {
        const d = decidePricing({
            direction: "CA_TO_NE",
            pricePerKg: 10,
            lines,
            submittedAmount: null,
        });
        expect(d.currency).toBe("CAD");
        expect(d.totalAmount).toBe(40);
    });

    it("suit la correction explicite de l'agent et la signale", () => {
        const d = decidePricing({
            direction: "NE_TO_CA",
            pricePerKg: 2500,
            lines,
            submittedAmount: 8000,
            priceOverridden: true,
        });
        expect(d.totalAmount).toBe(8000);
        expect(d.quoted).toBe(10000);
        expect(d.overridden).toBe(true);
    });

    it("ne signale rien si la correction retombe sur le tarif", () => {
        const d = decidePricing({
            direction: "NE_TO_CA",
            pricePerKg: 2500,
            lines,
            submittedAmount: 10000,
            priceOverridden: true,
        });
        expect(d.overridden).toBe(false);
    });

    it("laisse la main à l'agent quand le convoi n'a pas de tarif", () => {
        // L'ancien fonctionnement doit survivre : les convois déjà créés
        // n'ont pas de tarif, leurs colis doivent rester enregistrables.
        const d = decidePricing({
            direction: "CA_TO_NE",
            pricePerKg: null,
            lines,
            submittedAmount: 75,
        });
        expect(d.totalAmount).toBe(75);
        expect(d.quoted).toBeNull();
    });

    it("laisse la main à l'agent quand rien n'est pesé", () => {
        const d = decidePricing({
            direction: "CA_TO_NE",
            pricePerKg: 10,
            lines: [{ weightKg: null, quantity: 1 }],
            submittedAmount: 60,
        });
        expect(d.totalAmount).toBe(60);
        expect(d.quoted).toBeNull();
    });
});

describe("formatMoney", () => {
    it("sépare les milliers — un tarif en FCFA se compte en milliers", () => {
        expect(formatMoney(11250, "XOF")).toContain("FCFA");
        expect(formatMoney(11250, "XOF")).not.toContain(",00");
    });

    it("garde deux décimales en dollars", () => {
        expect(formatMoney(25, "CAD")).toBe("25,00 $");
    });
});
