# `lib/tax.ts` — Service de calcul et détermination fiscale

Phase 1 des fondations comptables NIMAPLEX. Ce service **ne dépend d'aucune UI** et peut être appelé depuis n'importe quelle Server Action, API Route ou script.

---

## ⚠️ Points à valider par un comptable / fiscaliste

Aucun taux n'est hardcodé dans le code — tout vit en base (`TaxRate`, `TaxRule`). Le seed initial (`prisma/seed-tax.ts`) insère des **placeholders `TODO`** qui doivent être révisés :

1. **Traitement des services de transport internationaux (CA↔NE)** — hypothèse actuelle : `ZERO_RATED` sous l'Annexe VI Partie VII LTA. **À CONFIRMER**.
2. **Application de la TVQ pour clients hors QC** (Ontario, Alberta, etc.) — aucune règle configurée par défaut ⇒ fallback `OUT_OF_SCOPE`.
3. **Compounding TPS/TVQ** : depuis 2013 la TVQ n'est **pas** appliquée sur la TPS au Québec — le module suit cette règle.
4. **Mentions obligatoires sur facture** — voir Loi ARC / Revenu Québec (numéro TPS, TVQ, NEQ, adresse, etc.).
5. **Profil entreprise** (`CompanyProfile`) : NEQ, numéros TPS/TVQ, adresse d'établissement à saisir.

---

## Modèle de données (`prisma/schema.prisma`)

- `TaxRegime` (enum) : `TAX_INCLUDED`, `TAX_EXCLUDED`, `ZERO_RATED`, `TAX_EXEMPT`, `OUT_OF_SCOPE`
- `CompanyProfile` : singleton entreprise (identité, NEQ, TPS/TVQ, adresse, exercice fiscal)
- `TaxRate` : taux configurables (code, rate `Decimal(7,5)`, juridiction, période de validité)
- `TaxRule` : règles configurables — priorité + critères (origine, destination, province, service) → régime + codes de taxes
- `AuditLog` : journal générique (entityType, entityId, action, before, after, reason, userId, ipAddress)

---

## API publique

### Types

```ts
type TaxRegimeValue =
    | "TAX_INCLUDED" | "TAX_EXCLUDED"
    | "ZERO_RATED"   | "TAX_EXEMPT"
    | "OUT_OF_SCOPE";

interface AppliedTax {
    taxRateId: string;
    code: string;          // "GST", "QST"
    name: string;          // "TPS", "TVQ"
    rate: string;          // "0.05" — sérialisé (snapshot immuable)
    jurisdiction: string;
    amount: string;        // "4.35" — 2 décimales, arrondi commercial
}

interface TaxCalculation {
    regime: TaxRegimeValue;
    amountBeforeTax: string;       // HT
    totalTax: string;              // somme des taxes arrondies
    totalIncludingTax: string;     // TTC exact (source de vérité)
    taxes: AppliedTax[];
}

interface TaxContext {
    originCountry?: string | null;      // "CA", "NE"
    destinationCountry?: string | null;
    clientProvince?: string | null;     // "QC", "ON"...
    serviceType?: string | null;        // "SHIPPING", "STORAGE"...
}
```

### Fonctions

#### `calculateTax(input)` — point d'entrée principal

```ts
const r = await calculateTax({
    regime: "TAX_INCLUDED",
    amount: 100,
    taxRateCodes: ["GST", "QST"],
});
// → { amountBeforeTax: "86.97", totalTax: "13.03",
//     totalIncludingTax: "100.00", taxes: [GST 4.35, QST 8.68], ... }
```

- Charge les taux actifs à la date donnée (`at`, défaut = maintenant)
- Retourne 0 taxes pour `ZERO_RATED` / `TAX_EXEMPT` / `OUT_OF_SCOPE`
- Retourne 0 taxes + warning console si aucun taux actif trouvé pour les codes

#### `determineTaxTreatment(ctx)` — moteur de règles

Consulte `TaxRule` par priorité descendante, retourne la première dont **tous les critères non-nuls** matchent le contexte.

```ts
const rule = await determineTaxTreatment({
    originCountry: "CA",
    destinationCountry: "NE",
    serviceType: "SHIPPING",
});
// → { regime: "ZERO_RATED", taxRateCodes: [], ruleName: "...", notes: "..." }
```

#### `determineAndCalculate(ctx, amount, at?)` — combo

Détermine + calcule en un appel. Si aucune règle ne match ⇒ fallback `OUT_OF_SCOPE` (fail-safe : mieux vaut ne pas taxer que taxer à tort).

#### `calculateTaxIncludedFromTotal(total, rates)` — bas niveau

Extrait HT + taxes d'un TTC. **Invariant garanti** : `HT + Σ(taxes) === TTC` (exact au cent, quel que soit l'arrondi individuel des taxes).

Algo :
1. `rawHT = TTC / (1 + Σ rates)`
2. Chaque taxe = `round(rawHT × rate, 2)` (half up)
3. `HT = TTC − Σ(taxes arrondies)` ⇒ cale la somme au cent près

#### `calculateTaxExcludedFromBase(ht, rates)` — bas niveau

Ajoute les taxes à un HT. Chaque taxe arrondie indépendamment.

#### `loadTaxRates(codes, at?)`

Retourne les `TaxRate` actifs pour les codes fournis à une date donnée (respecte `validFrom` / `validTo`).

---

## Précision numérique

- Utilise `Prisma.Decimal` (via `decimal.js`) — jamais `Float`
- `ROUND_HALF_UP` (arrondi commercial)
- `TaxRate.rate` = `Decimal(7, 5)` en base — 5 décimales pour rates type TVQ 9,975 %
- Montants sérialisés en `string` à 2 décimales (`"100.00"`) pour éviter les erreurs float et pour servir de snapshot immuable dans les factures (Phase 2)

---

## Journal d'audit (`lib/audit.ts`)

```ts
import { logAudit } from "@/lib/audit";

await logAudit({
    userId: session.user?.id,
    entityType: "Invoice",
    entityId: invoice.id,
    action: "CANCEL",
    before: { status: "ISSUED" },
    after:  { status: "CANCELLED" },
    reason: "Erreur de saisie — client jamais servi",
});
```

- `logAudit()` **ne lance jamais d'exception** — l'audit ne doit pas faire échouer l'opération métier. Erreurs → `console.warn`.
- `getAuditHistory(entityType, entityId)` — historique d'une entité
- `getUserAuditActivity(userId)` — activité d'un utilisateur

---

## Seed et initialisation

```bash
npx tsx prisma/seed-tax.ts                        # local
DATABASE_URL='postgres://...' npx tsx prisma/seed-tax.ts   # prod
```

Idempotent : ne remplace jamais un enregistrement existant. À exécuter une fois pour bootstrapper `CompanyProfile`, taux (GST/QST) et règles fiscales.

---

## Tests

```bash
npx tsx scripts/test-tax.ts
```

72 assertions couvrant :
- Round-trip TTC préservé au cent (7 valeurs différentes dont 33,33 $, 0,01 $, 1234,56 $)
- Calcul TAX_INCLUDED 100 $ TTC avec ratios attendus (QST ≈ 2× GST)
- Calcul TAX_EXCLUDED
- Régimes sans taxes
- Edge cases (0 $, taux inconnu, taxes vides)
- Chargement depuis la DB
- Moteur de règles (CA→NE, NE→CA, QC, contexte inconnu)

---

## Étapes suivantes (Phase 2)

- Modèle `Invoice` + `InvoiceItem` avec numérotation séquentielle
- Snapshot immuable des taxes appliquées sur la facture émise
- UI facturation (client simplifié / accounting détaillé)
- Rapports de taxes (journal des ventes, TPS/TVQ à remettre)
- CTI/RTI sur dépenses
- Attachements reçus (Cloudflare R2 / S3)
