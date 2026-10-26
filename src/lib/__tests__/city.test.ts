// src/lib/__tests__/city.test.ts
//
// Les cas de ce fichier sont ceux trouvés en production : 24 graphies pour
// 14 villes. Ils font foi — si l'un d'eux casse, un document de douane
// repartira avec deux sous-totaux pour la même destination.

import { describe, expect, it } from "vitest";
import {
    bestCitySpelling,
    cityKey,
    cityVariantsOf,
    dedupeCityNames,
    groupByCity,
    groupCityNames,
    sameCity,
} from "../city";

/** Échantillon réel relevé en base. */
const PRODUCTION = [
    "Montréal", "Montréal ", "Montreal ",
    "Québec", "Québec ", "Quebec",
    "Sherbrooke", "Sherbrooke ",
    "Niamey", "NIAMEY", "Niamey ",
    "Longueuil", "Longueuil ",
    "Gatineau", "GATINEAU",
    "Laval ",
    "Trois rivières ", "Trois-Rivières",
    "Drummondville", "Rimouski", "Victoriaville", "Mahdia",
    "Sherbooke", "Nia",
];

describe("cityKey", () => {
    it("ignore la casse, les accents et les espaces", () => {
        expect(cityKey("Montréal ")).toBe(cityKey("Montreal"));
        expect(cityKey("NIAMEY")).toBe(cityKey("Niamey "));
    });

    it("ignore le trait d'union et l'apostrophe", () => {
        expect(cityKey("Trois-Rivières")).toBe(cityKey("Trois rivières "));
        expect(cityKey("L'Assomption")).toBe(cityKey("L Assomption"));
    });

    it("ne rapproche pas deux villes différentes", () => {
        // « Sherbooke » est une faute de frappe, pas une variante : deviner
        // l'orthographe d'une destination de douane serait plus risqué que
        // de laisser l'anomalie visible.
        expect(cityKey("Sherbooke")).not.toBe(cityKey("Sherbrooke"));
        expect(cityKey("Nia")).not.toBe(cityKey("Niamey"));
    });

    it("rend une chaîne vide pour une ville absente", () => {
        expect(cityKey(null)).toBe("");
        expect(cityKey("   ")).toBe("");
    });
});

describe("sameCity", () => {
    it("reconnaît les variantes", () => {
        expect(sameCity("Quebec", "Québec ")).toBe(true);
    });

    it("ne considère jamais deux absences comme la même ville", () => {
        expect(sameCity(null, null)).toBe(false);
        expect(sameCity("", "")).toBe(false);
    });
});

describe("bestCitySpelling", () => {
    it("préfère les accents", () => {
        expect(bestCitySpelling(["Quebec", "Québec", "Québec "])).toBe("Québec");
    });

    it("écarte les majuscules intégrales", () => {
        expect(bestCitySpelling(["GATINEAU", "Gatineau"])).toBe("Gatineau");
        expect(bestCitySpelling(["NIAMEY", "Niamey ", "Niamey"])).toBe("Niamey");
    });

    it("préfère la forme composée correctement", () => {
        expect(bestCitySpelling(["Trois rivières ", "Trois-Rivières"])).toBe("Trois-Rivières");
    });

    it("retire les espaces superflus", () => {
        expect(bestCitySpelling(["Laval "])).toBe("Laval");
        expect(bestCitySpelling(["Montréal ", "Montreal "])).toBe("Montréal");
    });

    it("ne dépend pas de l'ordre reçu", () => {
        const a = bestCitySpelling(["Quebec", "Québec"]);
        const b = bestCitySpelling(["Québec", "Quebec"]);
        expect(a).toBe(b);
    });
});

describe("dedupeCityNames", () => {
    it("ramène les 24 graphies de production à 14 villes", () => {
        const cities = dedupeCityNames(PRODUCTION);
        expect(cities).toHaveLength(14);
        expect(cities).toContain("Montréal");
        expect(cities).toContain("Québec");
        expect(cities).toContain("Trois-Rivières");
        // Les deux fautes de frappe restent visibles, à corriger à la main.
        expect(cities).toContain("Sherbooke");
        expect(cities).toContain("Nia");
    });

    it("ne laisse aucun doublon de casse ou d'accent", () => {
        const cities = dedupeCityNames(PRODUCTION);
        const keys = cities.map(cityKey);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("trie en français", () => {
        const cities = dedupeCityNames(["Victoriaville", "Église", "Alma"]);
        expect(cities[0]).toBe("Alma");
        expect(cities[1]).toBe("Église");
    });

    it("ignore les valeurs vides", () => {
        expect(dedupeCityNames([null, "", "  ", undefined])).toEqual([]);
    });
});

describe("cityVariantsOf", () => {
    it("retrouve toutes les graphies d'une ville choisie", () => {
        // Choisir « Montréal » doit ramener les colis saisis « Montreal » :
        // sinon le filtre en cacherait une partie sans le dire.
        const variants = cityVariantsOf("Montréal", PRODUCTION);
        expect(variants.sort()).toEqual(["Montreal ", "Montréal", "Montréal "].sort());
    });

    it("se rabat sur le choix lui-même si rien ne correspond", () => {
        expect(cityVariantsOf("Alma", PRODUCTION)).toEqual(["Alma"]);
    });
});

describe("groupByCity", () => {
    const shipments = [
        { id: 1, city: "Québec", kg: 2 },
        { id: 2, city: "Quebec", kg: 1 },
        { id: 3, city: "Québec ", kg: 3 },
        { id: 4, city: "Montréal ", kg: 6 },
        { id: 5, city: null, kg: 1 },
    ];

    it("réunit les variantes sous un seul sous-total", () => {
        const groups = groupByCity(shipments, (s) => s.city);
        const quebec = groups.find((g) => g.label === "Québec");
        expect(quebec?.items).toHaveLength(3);
        expect(quebec?.items.reduce((n, s) => n + s.kg, 0)).toBe(6);
    });

    it("ne produit qu'un groupe par ville réelle", () => {
        const groups = groupByCity(shipments, (s) => s.city);
        expect(groups.map((g) => g.label)).toEqual(["Montréal", "Québec", "Sans ville"]);
    });

    it("range les colis sans ville à la fin", () => {
        const groups = groupByCity(shipments, (s) => s.city);
        expect(groups[groups.length - 1].label).toBe("Sans ville");
    });

    it("n'oublie aucun élément", () => {
        const groups = groupByCity(shipments, (s) => s.city);
        expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(shipments.length);
    });
});

describe("groupCityNames", () => {
    it("conserve les graphies d'origine pour pouvoir filtrer en base", () => {
        const groups = groupCityNames(["Québec", "Quebec", "Québec "]);
        expect(groups).toHaveLength(1);
        expect(groups[0].label).toBe("Québec");
        expect(groups[0].variants.sort()).toEqual(["Quebec", "Québec", "Québec "].sort());
    });
});
