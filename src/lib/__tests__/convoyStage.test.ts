// État d'un convoi déduit du statut de ses colis.
//
// Garde-fou contre le double envoi d'une même notification : si cette
// dérivation se trompe, l'écran annonce « étape suivante » sur une étape
// déjà faite et un second courriel part aux mêmes clients.

import { describe, it, expect } from "vitest";
import { convoyProgress, templateState } from "../convoyStage";

describe("convoyProgress", () => {
    it("part de l'étape Reçu sur un convoi neuf", () => {
        const p = convoyProgress({ RECEIVED_IN_NIGER: 10 });
        expect(p.lowest).toBe("RECEIVED");
        expect(p.total).toBe(10);
        expect(p.mixed).toBe(false);
    });

    it("traite les deux statuts de réception comme une seule étape", () => {
        // Le statut diffère selon le sens, l'étape est la même.
        const p = convoyProgress({ RECEIVED_IN_NIGER: 4, RECEIVED_IN_CANADA: 6 });
        expect(p.counts.RECEIVED).toBe(10);
        expect(p.mixed).toBe(false);
    });

    it("range l'escale avec le transit", () => {
        const p = convoyProgress({ IN_TRANSIT: 5, IN_TRANSIT_STOP: 5 });
        expect(p.counts.IN_TRANSIT).toBe(10);
        expect(p.mixed).toBe(false);
    });

    it("signale un convoi aux étapes mélangées", () => {
        // Cas réel : un envoi « prêt » filtré par ville n'a touché qu'une part.
        const p = convoyProgress({ IN_CUSTOMS: 7, READY_FOR_PICKUP: 3 });
        expect(p.mixed).toBe(true);
        expect(p.lowest).toBe("IN_CUSTOMS");
        expect(p.highest).toBe("READY");
    });

    it("tient le convoi vide sans planter", () => {
        const p = convoyProgress({});
        expect(p.total).toBe(0);
        expect(p.lowest).toBe("RECEIVED");
    });
});

describe("templateState", () => {
    it("marque l'étape franchie comme déjà envoyée", () => {
        const p = convoyProgress({ IN_TRANSIT: 10 });
        expect(templateState(p, "EN_ROUTE").state).toBe("done");
    });

    it("désigne l'étape qui suit", () => {
        const p = convoyProgress({ IN_TRANSIT: 10 });
        expect(templateState(p, "IN_CUSTOMS").state).toBe("next");
    });

    it("signale une étape qui en saute une", () => {
        const p = convoyProgress({ RECEIVED_IN_NIGER: 10 });
        expect(templateState(p, "OUT_FOR_DELIVERY").state).toBe("ahead");
    });

    it("rend compte d'un envoi partiel", () => {
        const p = convoyProgress({ IN_CUSTOMS: 7, READY_FOR_PICKUP: 3 });
        const st = templateState(p, "OUT_FOR_DELIVERY");
        expect(st.state).toBe("partial");
        expect(st.reached).toBe(3);
    });

    it("compte une étape dépassée comme faite", () => {
        // Des colis déjà récupérés ont forcément franchi « en route ».
        const p = convoyProgress({ DELIVERED: 10 });
        expect(templateState(p, "EN_ROUTE").state).toBe("done");
    });
});
