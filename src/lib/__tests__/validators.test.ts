// Validation des envois.
//
// Le premier cas ci-dessous est une régression qui a atteint la production :
// toute création de colis Niger→Canada échouait. Le formulaire NE→CA lit son
// contenu avec Object.fromEntries(FormData), qui n'emporte pas les champs
// absents de l'écran — le schéma recevait `undefined` pour les dimensions,
// que le préprocesseur ne traitait pas, et Number(undefined) vaut NaN.
//
// Ni le typage ni le build ne voient ça. Seul un cas d'essai le voit.

import { describe, it, expect } from "vitest";
import { createShipmentByGN, createShipmentByCA, contentLineSchema } from "../validators";

const baseNE = {
    receiverName: "Amadou Diallo",
    receiverEmail: "amadou@example.com",
    convoyId: "ck123",
    packageCount: "1",
};

const colis = { itemKind: "PARCEL", label: "Vêtements", quantity: "1", weightKg: "22" };

describe("createShipmentByGN", () => {
    it("accepte un colis dont les champs non affichés sont absents", () => {
        // Régression : aucune clé lengthCm/widthCm/heightCm, comme le fait
        // réellement le formulaire quand le contenu est un colis.
        const r = createShipmentByGN.safeParse({ ...baseNE, items: [colis] });
        expect(r.success).toBe(true);
    });

    it("accepte les champs facultatifs vides", () => {
        const r = createShipmentByGN.safeParse({
            ...baseNE,
            receiverPhone: "",
            receiverCity: "",
            packageCount: "",
            items: [colis],
        });
        expect(r.success).toBe(true);
    });

    it("exige au moins une ligne de contenu", () => {
        const r = createShipmentByGN.safeParse({ ...baseNE, items: [] });
        expect(r.success).toBe(false);
    });
});

describe("contentLineSchema", () => {
    it("exige le poids d'un colis", () => {
        const r = contentLineSchema.safeParse({
            itemKind: "PARCEL",
            label: "Vêtements",
            quantity: 1,
        });
        expect(r.success).toBe(false);
        if (!r.success) {
            expect(r.error.flatten().fieldErrors.weightKg).toBeDefined();
        }
    });

    it("exige la description d'un colis", () => {
        const r = contentLineSchema.safeParse({
            itemKind: "PARCEL",
            quantity: 1,
            weightKg: 5,
        });
        expect(r.success).toBe(false);
    });

    it("exige le type d'un appareil, mais pas son poids", () => {
        // Un appareil n'est pas toujours pesé à la prise en charge.
        const sansType = contentLineSchema.safeParse({ itemKind: "DEVICE", quantity: 1 });
        expect(sansType.success).toBe(false);

        const avecType = contentLineSchema.safeParse({
            itemKind: "DEVICE",
            deviceType: "Télévision",
            quantity: 1,
        });
        expect(avecType.success).toBe(true);
    });

    it("accepte un envoi mêlant colis et appareil", () => {
        const r = createShipmentByGN.safeParse({
            ...baseNE,
            items: [colis, { itemKind: "DEVICE", deviceType: "Télévision", quantity: "1" }],
        });
        expect(r.success).toBe(true);
    });
});

describe("createShipmentByCA", () => {
    it("exige les informations du récupérateur au Niger", () => {
        const r = createShipmentByCA.safeParse({ ...baseNE, items: [colis] });
        expect(r.success).toBe(false);
        if (!r.success) {
            const f = r.error.flatten().fieldErrors;
            expect(f.pickupLastName).toBeDefined();
            expect(f.pickupPhone).toBeDefined();
        }
    });

    it("accepte quand elles sont fournies", () => {
        const r = createShipmentByCA.safeParse({
            ...baseNE,
            items: [colis],
            pickupLastName: "Diallo",
            pickupFirstName: "Fatima",
            pickupPhone: "+227 90 00 00 00",
        });
        expect(r.success).toBe(true);
    });
});
