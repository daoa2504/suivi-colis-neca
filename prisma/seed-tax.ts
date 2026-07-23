// prisma/seed-tax.ts
//
// Seed idempotent pour les fondations fiscales (Phase 1).
// Toutes les valeurs sont des PLACEHOLDERS à valider par un comptable.
//
// Usage :
//   npx tsx prisma/seed-tax.ts                 # DB locale
//   DATABASE_URL='postgres://...' npx tsx prisma/seed-tax.ts  # prod
//
// Le script ne remplace jamais des enregistrements existants.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const dbInfo = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    console.log(`→ Connecté à : ${dbInfo[0]?.current_database}`);

    // ------------------------------------------------------------
    // 1. Profil entreprise (singleton)
    // ------------------------------------------------------------
    const existingCompany = await prisma.companyProfile.findFirst({ where: { active: true } });
    if (!existingCompany) {
        await prisma.companyProfile.create({
            data: {
                legalName: "NIMAPLEX INC.",                    // TODO comptable : dénomination exacte au registre
                displayName: "NIMAPLEX",
                neq: null,                                     // TODO comptable : NEQ à saisir
                gstNumber: null,                               // TODO comptable : numéro TPS (RT0001)
                qstNumber: null,                               // TODO comptable : numéro TVQ (TQ0001)
                address: "1280 Rue de Kingston-Sherbrooke",
                city: "Sherbrooke",
                province: "QC",
                postalCode: "TODO",                            // TODO — code postal à saisir
                country: "Canada",
                email: "contact@nimaplex.com",                 // TODO — email officiel
                phone: null,
                registeredAt: new Date("2026-06-06"),          // Date d'incorporation
                fiscalYearStart: 1,                            // TODO comptable : janvier ?
            },
        });
        console.log("✅ CompanyProfile créé (placeholders TODO)");
    } else {
        console.log("• CompanyProfile déjà présent — pas de modification");
    }

    // ------------------------------------------------------------
    // 2. Taux de taxes (TPS + TVQ)
    // TODO comptable : confirmer les taux exacts et leur date d'entrée en vigueur.
    // Valeurs actuelles :
    //   - TPS/GST : 5,00 % (fédérale, en vigueur depuis 2008)
    //   - TVQ/QST : 9,975 % (Québec, en vigueur depuis 2013)
    // ------------------------------------------------------------
    const rates = [
        {
            code: "GST",
            name: "TPS",
            rate: "0.0500",
            jurisdiction: "CA-federal",
            validFrom: new Date("2008-01-01"),
            notes: "Taxe fédérale sur les produits et services — Loi sur la taxe d'accise. À VÉRIFIER PAR COMPTABLE.",
        },
        {
            code: "QST",
            name: "TVQ",
            rate: "0.09975",
            jurisdiction: "CA-QC",
            validFrom: new Date("2013-01-01"),
            notes: "Taxe de vente du Québec. Depuis 2013, non appliquée sur la TPS. À VÉRIFIER PAR COMPTABLE.",
        },
    ];

    for (const r of rates) {
        const existing = await prisma.taxRate.findFirst({
            where: { code: r.code, active: true, jurisdiction: r.jurisdiction },
        });
        if (!existing) {
            await prisma.taxRate.create({ data: r as any });
            console.log(`✅ TaxRate ${r.code} (${r.rate}) créé`);
        } else {
            console.log(`• TaxRate ${r.code} déjà présent`);
        }
    }

    // ------------------------------------------------------------
    // 3. Règles fiscales (moteur de détermination)
    // TODO comptable : ces règles sont des HYPOTHÈSES.
    //   - Transport international : Annexe VI Partie VII LTA pourrait rendre
    //     les services de transport de marchandises hors Canada ZERO_RATED.
    //     À CONFIRMER pour CA→NE ET NE→CA.
    //   - Client au Québec, service local : TPS+TVQ.
    //   - Client hors QC (ON, AB, etc.) : régime différent.
    // Les règles sont évaluées par priorité descendante ; la première qui
    // match s'applique.
    // ------------------------------------------------------------
    const rules = [
        {
            name: "TODO — Transport international CA→NE (probable ZERO_RATED)",
            priority: 100,
            originCountry: "CA",
            destinationCountry: "NE",
            clientProvince: null,
            serviceType: "SHIPPING",
            regime: "ZERO_RATED" as const,
            taxRateCodes: [],
            notes:
                "À VALIDER PAR COMPTABLE. Hypothèse : les services de transport internationaux de marchandises sont détaxés (Annexe VI Partie VII LTA). Si confirmé, aucune TPS/TVQ à percevoir.",
        },
        {
            name: "TODO — Transport international NE→CA (probable ZERO_RATED)",
            priority: 100,
            originCountry: "NE",
            destinationCountry: "CA",
            clientProvince: null,
            serviceType: "SHIPPING",
            regime: "ZERO_RATED" as const,
            taxRateCodes: [],
            notes: "À VALIDER PAR COMPTABLE. Même hypothèse que CA→NE.",
        },
        {
            name: "TODO — Service local Québec (fallback TAX_INCLUDED avec TPS+TVQ)",
            priority: 10,
            originCountry: null,
            destinationCountry: null,
            clientProvince: "QC",
            serviceType: null,
            regime: "TAX_INCLUDED" as const,
            taxRateCodes: ["GST", "QST"],
            notes:
                "À VALIDER PAR COMPTABLE. Fallback pour clients québécois si aucune règle plus spécifique ne s'applique.",
        },
    ];

    for (const rule of rules) {
        const existing = await prisma.taxRule.findFirst({
            where: {
                originCountry: rule.originCountry,
                destinationCountry: rule.destinationCountry,
                clientProvince: rule.clientProvince,
                serviceType: rule.serviceType,
                active: true,
            },
        });
        if (!existing) {
            await prisma.taxRule.create({ data: rule as any });
            console.log(`✅ TaxRule "${rule.name}" créée`);
        } else {
            console.log(`• TaxRule pour (${rule.originCountry ?? "*"}→${rule.destinationCountry ?? "*"}) déjà présente`);
        }
    }

    console.log("\n✅ Seed terminé");
    console.log("⚠️  Toutes les valeurs marquées TODO doivent être validées par un comptable.");
}

main()
    .catch((e) => {
        console.error("ERREUR :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
