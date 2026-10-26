// scripts/normalize-cities.ts
//
// Unifie l'orthographe des villes déjà enregistrées.
//
// Les villes sont saisies à la main : la base contenait 24 graphies pour
// 14 villes réelles — « Montréal », « Montreal », « Montréal » avec une
// espace finale. D'où des villes en double dans les filtres, et des
// sous-totaux dédoublés sur les documents de douane.
//
// Deux cas, traités différemment :
//
//   · Variantes de casse, d'accent ou d'espace — regroupées d'office, sans
//     risque : « NIAMEY » et « Niamey » désignent le même endroit.
//
//   · Fautes de frappe — « Sherbooke » pour « Sherbrooke », « Nia » pour
//     « Niamey ». Celles-là ne sont JAMAIS corrigées automatiquement : une
//     destination de douane devinée vaut moins qu'une anomalie visible.
//     Le script les signale, et ne les applique que si on les lui nomme
//     explicitement avec --alias.
//
// Usage :
//   DATABASE_URL="..." npx tsx scripts/normalize-cities.ts --dry-run
//   DATABASE_URL="..." npx tsx scripts/normalize-cities.ts
//   ... --alias "Sherbooke=Sherbrooke" --alias "Nia=Niamey"

import { PrismaClient } from "@prisma/client";
import { bestCitySpelling, cityKey, tidyCityName } from "../src/lib/city";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

/** --alias "Sherbooke=Sherbrooke" → { "sherbooke": "Sherbrooke" } */
function parseAliases(): Map<string, string> {
    const map = new Map<string, string>();
    const argv = process.argv;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] !== "--alias") continue;
        const pair = argv[i + 1] ?? "";
        const at = pair.indexOf("=");
        if (at < 1) {
            throw new Error(`--alias attend "Faute=Correct", reçu « ${pair} »`);
        }
        map.set(cityKey(pair.slice(0, at)), tidyCityName(pair.slice(at + 1)));
    }
    return map;
}

/** Distance de Levenshtein, pour repérer les graphies proches. */
function distance(a: string, b: string): number {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diagonal = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = prev[j];
            prev[j] = Math.min(
                prev[j] + 1,
                prev[j - 1] + 1,
                diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
            diagonal = current;
        }
    }
    return prev[b.length];
}

async function main() {
    const host = new URL(process.env.DATABASE_URL || "postgresql://none/none").host;
    const aliases = parseAliases();

    console.log(`🎯 Base : ${host}${DRY_RUN ? "  (DRY RUN — aucune écriture)" : ""}\n`);

    const rows = await prisma.shipment.groupBy({
        by: ["receiverCity"],
        _count: { _all: true },
        where: { receiverCity: { not: null } },
    });

    // Regroupement par clé, enrichi des alias demandés.
    const clusters = new Map<string, { variant: string; count: number }[]>();
    for (const row of rows) {
        const raw = row.receiverCity!;
        const base = cityKey(raw);
        const key = aliases.has(base) ? cityKey(aliases.get(base)!) : base;
        if (!key) continue;
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key)!.push({ variant: raw, count: row._count._all });
    }

    console.log(`${rows.length} graphies en base → ${clusters.size} villes\n`);

    const plan: { from: string; to: string; count: number }[] = [];

    for (const [key, variants] of [...clusters.entries()].sort()) {
        // L'alias impose la cible ; sinon on retient la plus présentable.
        const aliasTarget = [...aliases.values()].find((v) => cityKey(v) === key);
        const target = aliasTarget ?? bestCitySpelling(variants.map((v) => v.variant));

        for (const v of variants) {
            if (v.variant !== target) plan.push({ from: v.variant, to: target, count: v.count });
        }

        // Afficher aussi le cas d'une graphie unique mais à nettoyer, comme
        // « Laval » suivi d'une espace : sinon elle disparaît du compte rendu
        // tout en figurant dans le plan.
        if (variants.length > 1 || variants[0].variant !== target) {
            const total = variants.reduce((n, v) => n + v.count, 0);
            console.log(`${target}  (${total} colis)`);
            for (const v of variants.sort((a, b) => b.count - a.count)) {
                const mark = v.variant === target ? "✔" : "→";
                console.log(`   ${mark} ${JSON.stringify(v.variant)} ×${v.count}`);
            }
        }
    }

    // Graphies proches mais non regroupées : vraisemblablement des fautes.
    const keys = [...clusters.keys()];
    const suspects: string[] = [];
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const a = keys[i];
            const b = keys[j];
            // Proches à deux caractères près, ou l'une préfixe de l'autre
            // dans un sens ou dans l'autre (« Nia » / « Niamey »).
            const prefix =
                (a.length >= 3 && b.startsWith(a)) || (b.length >= 3 && a.startsWith(b));
            if (distance(a, b) <= 2 || prefix) {
                suspects.push(`${a} ↔ ${b}`);
            }
        }
    }

    if (suspects.length > 0) {
        console.log("\n⚠️  Graphies proches, NON regroupées — fautes de frappe probables :");
        for (const s of suspects) console.log(`   ${s}`);
        console.log(
            "   Elles ne seront corrigées que si vous le demandez, par exemple :\n" +
            '   --alias "Sherbooke=Sherbrooke" --alias "Nia=Niamey"'
        );
    }

    if (plan.length === 0) {
        console.log("\n✔ Rien à unifier.");
        return;
    }

    const touched = plan.reduce((n, p) => n + p.count, 0);
    console.log(`\n${plan.length} graphie(s) à réécrire, ${touched} colis concernés.`);

    if (DRY_RUN) {
        console.log("(DRY RUN — relancez sans --dry-run pour appliquer.)");
        return;
    }

    for (const p of plan) {
        const res = await prisma.shipment.updateMany({
            where: { receiverCity: p.from },
            data: { receiverCity: p.to },
        });
        console.log(`   ${JSON.stringify(p.from)} → ${JSON.stringify(p.to)} (${res.count})`);
    }

    const after = await prisma.shipment.groupBy({
        by: ["receiverCity"],
        where: { receiverCity: { not: null } },
    });
    console.log(`\n✔ ${after.length} graphies en base après unification.`);
}

main()
    .catch((e) => {
        console.error("❌", e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
