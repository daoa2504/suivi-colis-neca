// src/lib/__tests__/photoRetention.test.ts
//
// La purge efface des preuves : si la date de bascule est fausse, elle
// efface trop tôt, et c'est irrattrapable. D'où ces vérifications sur le
// seul calcul qui ne touche pas la base.

import { describe, expect, it } from "vitest";
import { GRACE_MONTHS, retentionCutoff } from "../photoRetention";

describe("retentionCutoff", () => {
    it("recule de trois mois", () => {
        expect(GRACE_MONTHS).toBe(3);
        const cutoff = retentionCutoff(new Date("2026-10-15T12:00:00Z"));
        expect(cutoff.toISOString().slice(0, 10)).toBe("2026-07-15");
    });

    it("passe correctement d'une année à l'autre", () => {
        const cutoff = retentionCutoff(new Date("2026-01-20T08:30:00Z"));
        expect(cutoff.toISOString().slice(0, 10)).toBe("2025-10-20");
    });

    it("reste toujours dans le passé", () => {
        const now = new Date();
        expect(retentionCutoff(now).getTime()).toBeLessThan(now.getTime());
    });

    it("ne modifie pas la date qu'on lui passe", () => {
        // Le piège de setMonth : il mute. Un appel qui décalerait « maintenant »
        // de trois mois chez l'appelant corromprait tout ce qui suit.
        const now = new Date("2026-10-15T12:00:00Z");
        retentionCutoff(now);
        expect(now.toISOString()).toBe("2026-10-15T12:00:00.000Z");
    });

    it("laisse au moins 80 jours de sursis quel que soit le mois", () => {
        // Trois mois civils, c'est entre 89 et 92 jours. Un colis livré
        // hier ne doit jamais tomber du bon côté de la bascule.
        for (let month = 0; month < 12; month++) {
            const now = new Date(Date.UTC(2026, month, 28));
            const days = (now.getTime() - retentionCutoff(now).getTime()) / 86_400_000;
            expect(days).toBeGreaterThan(80);
        }
    });
});
