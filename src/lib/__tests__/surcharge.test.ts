// Supplément de ville : tarif AU KILO, et montant réellement dû.
//
// Ces règles portent de l'argent facturé. Elles sont restées vérifiées à la
// main pendant leur mise au point ; ces cas figent ce qui avait été validé.

import { describe, it, expect } from "vitest";
import { amountDue, round2 } from "../surcharge";

describe("round2", () => {
    it("arrondit au cent", () => {
        expect(round2(6.999)).toBe(7);
        expect(round2(4.5)).toBe(4.5);
        expect(round2(0.1 + 0.2)).toBe(0.3); // le piège classique du flottant
    });
});

describe("amountDue", () => {
    it("ajoute le supplément au prix convenu", () => {
        expect(amountDue(50, 6)).toBe(56);
        expect(amountDue(219, 28.5)).toBe(247.5);
    });

    it("rend le prix convenu quand il n'y a pas de supplément", () => {
        expect(amountDue(50, null)).toBe(50);
        expect(amountDue(50, undefined)).toBe(50);
    });

    it("rend null si aucun prix n'est convenu", () => {
        // Un envoi sans montant ne doit pas devenir « 0 $ dû » : il n'a pas
        // encore de prix, ce qui n'est pas la même chose que gratuit.
        expect(amountDue(null, 6)).toBeNull();
    });

    it("n'accumule pas les erreurs de flottant", () => {
        expect(amountDue(10.1, 0.2)).toBe(10.3);
    });
});
