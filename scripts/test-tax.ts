// scripts/test-tax.ts
//
// Tests unitaires pour lib/tax.ts (sans framework — tsx + assertions).
// Vérifie :
//   1. Round-trip TAX_INCLUDED : TTC → HT → taxes → TTC exact au cent
//   2. TAX_INCLUDED avec TPS+TVQ (100,00 $ TTC — cas courant)
//   3. TAX_EXCLUDED : ajout de taxes sur HT
//   4. ZERO_RATED / TAX_EXEMPT / OUT_OF_SCOPE : 0 taxe
//   5. Edge cases : 0 $, 33,33 $ (arrondi tricky), 1 $
//   6. Aucun taux trouvé pour codes donnés → 0 taxe + warning
//   7. Moteur de règles : détermination par priorité et critères
//
// Usage :
//   npx tsx scripts/test-tax.ts
//
// Sortie : "✅ N/N tests passed" ou "❌ N tests failed" avec détail.

import { Prisma } from "@prisma/client";
import {
    calculateTaxIncludedFromTotal,
    calculateTaxExcludedFromBase,
    calculateTax,
    determineTaxTreatment,
    loadTaxRates,
} from "../src/lib/tax";

const D = Prisma.Decimal;
type Rate = { id: string; name: string; code: string; rate: Prisma.Decimal; jurisdiction: string };

// ----- Framework maison ------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertEq(actual: string, expected: string, label: string) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${label}: ${actual}`);
    } else {
        failed++;
        const msg = `${label}: expected "${expected}", got "${actual}"`;
        failures.push(msg);
        console.log(`  ❌ ${msg}`);
    }
}

function assertTrue(cond: boolean, label: string) {
    if (cond) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        failures.push(label);
        console.log(`  ❌ ${label}`);
    }
}

function section(name: string) {
    console.log(`\n▸ ${name}`);
}

// Taux mockés (correspondent au seed : GST 5%, QST 9.975%)
const GST: Rate = {
    id: "rate-gst",
    name: "TPS",
    code: "GST",
    rate: new D("0.05"),
    jurisdiction: "CA-federal",
};
const QST: Rate = {
    id: "rate-qst",
    name: "TVQ",
    code: "QST",
    rate: new D("0.09975"),
    jurisdiction: "CA-QC",
};

async function main() {
// ----- 1. Round-trip invariant : TTC = HT + sum(taxes) ---------------------

section("Round-trip TAX_INCLUDED : TTC préservé au cent");

for (const total of ["100.00", "1.00", "33.33", "99.99", "1234.56", "0.01", "7.77"]) {
    const r = calculateTaxIncludedFromTotal(total, [GST, QST]);
    const ht = new D(r.amountBeforeTax);
    const sumTaxes = r.taxes.reduce((s, t) => s.plus(new D(t.amount)), new D(0));
    const reconstructed = ht.plus(sumTaxes).toFixed(2);
    assertEq(reconstructed, new D(total).toFixed(2), `TTC=${total} → HT+taxes = ${reconstructed}`);
    // Aussi vérifie totalIncludingTax et totalTax cohérents
    assertEq(r.totalIncludingTax, new D(total).toFixed(2), `  totalIncludingTax renvoyé`);
    assertEq(r.totalTax, sumTaxes.toFixed(2), `  totalTax = sum(taxes)`);
}

// ----- 2. Cas courant : 100,00 $ TTC avec GST + QST ------------------------

section("TAX_INCLUDED — 100,00 $ TTC avec TPS + TVQ");
{
    const r = calculateTaxIncludedFromTotal("100.00", [GST, QST]);
    // Ratio théorique : HT = 100 / 1.14975 ≈ 86.9754...
    // GST = 86.9754 * 0.05 ≈ 4.35, QST = 86.9754 * 0.09975 ≈ 8.68
    // sum = 13.03 → HT = 100 - 13.03 = 86.97
    assertEq(r.regime, "TAX_INCLUDED", "regime");
    assertEq(r.totalIncludingTax, "100.00", "totalIncludingTax");
    assertTrue(r.taxes.length === 2, "2 taxes appliquées");
    const gstAmt = r.taxes.find((t) => t.code === "GST")?.amount ?? "?";
    const qstAmt = r.taxes.find((t) => t.code === "QST")?.amount ?? "?";
    console.log(`     GST=${gstAmt}, QST=${qstAmt}, HT=${r.amountBeforeTax}, TTC=${r.totalIncludingTax}`);
    // Sanity : les taxes doivent être positives et proportionnelles
    assertTrue(new D(gstAmt).greaterThan(0), "GST > 0");
    assertTrue(new D(qstAmt).greaterThan(0), "QST > 0");
    // QST rate est ~2x GST → QST amount doit être ~2x GST amount
    const ratio = new D(qstAmt).dividedBy(new D(gstAmt)).toNumber();
    assertTrue(ratio > 1.9 && ratio < 2.1, `QST/GST ratio ≈ 2 (${ratio.toFixed(3)})`);
}

// ----- 3. TAX_EXCLUDED : 100 $ HT → taxes ajoutées -------------------------

section("TAX_EXCLUDED — 100,00 $ HT + TPS + TVQ");
{
    const r = calculateTaxExcludedFromBase("100.00", [GST, QST]);
    assertEq(r.regime, "TAX_EXCLUDED", "regime");
    assertEq(r.amountBeforeTax, "100.00", "amountBeforeTax");
    // GST = 100 * 0.05 = 5.00, QST = 100 * 0.09975 = 9.9750 → 9.98 (half up)
    assertEq(r.taxes.find((t) => t.code === "GST")!.amount, "5.00", "GST = 5.00");
    assertEq(r.taxes.find((t) => t.code === "QST")!.amount, "9.98", "QST = 9.98");
    assertEq(r.totalTax, "14.98", "totalTax = 14.98");
    assertEq(r.totalIncludingTax, "114.98", "TTC = 114.98");
}

// ----- 4. Régimes sans taxes ------------------------------------------------

section("Régimes sans taxes");
for (const regime of ["ZERO_RATED", "TAX_EXEMPT", "OUT_OF_SCOPE"] as const) {
    const r = await calculateTax({
        regime,
        amount: "150.00",
        taxRateCodes: ["GST", "QST"], // ignoré
    });
    assertEq(r.regime, regime, `regime=${regime}`);
    assertEq(r.totalTax, "0.00", `  totalTax=0.00`);
    assertEq(r.amountBeforeTax, "150.00", `  HT=150.00`);
    assertEq(r.totalIncludingTax, "150.00", `  TTC=150.00`);
    assertTrue(r.taxes.length === 0, `  taxes vide`);
}

// ----- 5. Edge cases --------------------------------------------------------

section("Edge cases");
{
    // Zéro
    const zero = calculateTaxIncludedFromTotal("0.00", [GST, QST]);
    assertEq(zero.totalIncludingTax, "0.00", "TTC 0 $ → 0");
    assertEq(zero.totalTax, "0.00", "  taxes 0");
    assertEq(zero.amountBeforeTax, "0.00", "  HT 0");
}
{
    // 33.33 $ TTC (rounding tricky)
    const r = calculateTaxIncludedFromTotal("33.33", [GST, QST]);
    const sum = r.taxes
        .reduce((s, t) => s.plus(new D(t.amount)), new D(0))
        .plus(new D(r.amountBeforeTax))
        .toFixed(2);
    assertEq(sum, "33.33", "33.33 $ TTC : HT + taxes = 33.33");
}
{
    // Un seul taux
    const r = calculateTaxIncludedFromTotal("105.00", [GST]);
    // HT = 105 / 1.05 = 100.00, GST = 5.00
    assertEq(r.amountBeforeTax, "100.00", "105 TTC / 1.05 → HT = 100.00");
    assertEq(r.taxes[0]?.amount, "5.00", "GST = 5.00");
}
{
    // Aucune taxe fournie → tout est HT
    const r = calculateTaxIncludedFromTotal("100.00", []);
    assertEq(r.amountBeforeTax, "100.00", "0 taxes → HT = TTC");
    assertEq(r.totalTax, "0.00", "  taxes = 0");
}

// ----- 6. calculateTax avec codes introuvables → warning + 0 taxes ---------

section("calculateTax : codes inconnus → 0 taxe (warning)");
{
    // ⚠️ Ce test peut logguer un warning dans la console — attendu
    const r = await calculateTax({
        regime: "TAX_INCLUDED",
        amount: "100.00",
        taxRateCodes: ["INEXISTANT_CODE_XYZ"],
    });
    assertEq(r.totalTax, "0.00", "totalTax = 0 quand codes introuvables");
    assertEq(r.amountBeforeTax, "100.00", "HT = TTC quand pas de taxes");
}

// ----- 7. Chargement de taux depuis la DB ----------------------------------

section("loadTaxRates : lit depuis la DB (nécessite seed)");
{
    const rates = await loadTaxRates(["GST", "QST"]);
    assertTrue(rates.length === 2, `2 taux chargés (${rates.length} trouvés)`);
    const gst = rates.find((r) => r.code === "GST");
    const qst = rates.find((r) => r.code === "QST");
    assertTrue(gst !== undefined, "GST présent");
    assertTrue(qst !== undefined, "QST présent");
    if (gst) assertEq(gst.rate.toString(), "0.05", "GST rate = 0.05");
    if (qst) assertEq(qst.rate.toString(), "0.09975", "QST rate = 0.09975");
}

// ----- 8. Moteur de règles (nécessite seed) --------------------------------

section("determineTaxTreatment : moteur de règles");
{
    // CA → NE : ZERO_RATED (priorité 100)
    const r1 = await determineTaxTreatment({
        originCountry: "CA",
        destinationCountry: "NE",
        serviceType: "SHIPPING",
    });
    assertTrue(r1 !== null, "règle trouvée pour CA→NE");
    if (r1) assertEq(r1.regime, "ZERO_RATED", "  CA→NE = ZERO_RATED");

    // NE → CA : ZERO_RATED (priorité 100)
    const r2 = await determineTaxTreatment({
        originCountry: "NE",
        destinationCountry: "CA",
        serviceType: "SHIPPING",
    });
    assertTrue(r2 !== null, "règle trouvée pour NE→CA");
    if (r2) assertEq(r2.regime, "ZERO_RATED", "  NE→CA = ZERO_RATED");

    // Client QC, service local : TAX_INCLUDED (priorité 10)
    const r3 = await determineTaxTreatment({
        clientProvince: "QC",
    });
    assertTrue(r3 !== null, "règle trouvée pour QC");
    if (r3) {
        assertEq(r3.regime, "TAX_INCLUDED", "  QC = TAX_INCLUDED");
        assertTrue(r3.taxRateCodes.includes("GST"), "  applique GST");
        assertTrue(r3.taxRateCodes.includes("QST"), "  applique QST");
    }

    // Contexte inconnu : aucune règle
    const r4 = await determineTaxTreatment({
        originCountry: "US",
        destinationCountry: "MX",
    });
    assertTrue(r4 === null, "aucune règle pour US→MX");
}

// ----- Résumé --------------------------------------------------------------

console.log("\n" + "═".repeat(60));
if (failed === 0) {
    console.log(`✅  ${passed}/${passed} tests passed`);
    process.exit(0);
} else {
    console.log(`❌  ${failed} test(s) failed out of ${passed + failed}`);
    console.log("\nÉchecs :");
    failures.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
}
}

main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
