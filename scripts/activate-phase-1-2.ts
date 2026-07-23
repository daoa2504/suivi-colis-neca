// scripts/activate-phase-1-2.ts
//
// Activation Phase 1 + Phase 2 en un seul script — pour Railway.
// Applique les migrations SQL en mode IDEMPOTENT (IF NOT EXISTS partout)
// puis exécute le seed initial des taux et règles fiscales.
//
// Usage :
//   DATABASE_URL='postgres://.../railway' npx tsx scripts/activate-phase-1-2.ts
//
// Sûr à ré-exécuter : le script détecte ce qui existe déjà et ne modifie rien.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* eslint-disable no-console */

async function main() {
    const dbInfo = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    console.log(`\n🎯 Connecté à : ${dbInfo[0]?.current_database}`);
    console.log(`   ${new Date().toISOString()}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  PHASE 1 — Fondations fiscales");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await applyPhase1Schema();
    await seedPhase1();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  PHASE 2 — Facturation");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await applyPhase2Schema();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  PHASE 2.8 — Colonnes paiement sur Shipment");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await applyPhase28Schema();

    console.log("\n✅ Activation terminée");
    console.log("⚠️  Les valeurs marquées TODO (NEQ, TPS, TVQ, code postal) doivent être saisies.");
}

async function applyPhase1Schema() {
    console.log("→ Application schéma Phase 1 (idempotent)...");

    // Enum TaxRegime
    await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            CREATE TYPE "TaxRegime" AS ENUM ('TAX_INCLUDED','TAX_EXCLUDED','ZERO_RATED','TAX_EXEMPT','OUT_OF_SCOPE');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // CompanyProfile
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CompanyProfile" (
            "id" TEXT PRIMARY KEY,
            "legalName" TEXT NOT NULL,
            "displayName" TEXT NOT NULL,
            "neq" TEXT,
            "gstNumber" TEXT,
            "qstNumber" TEXT,
            "address" TEXT NOT NULL,
            "city" TEXT NOT NULL,
            "province" TEXT NOT NULL,
            "postalCode" TEXT NOT NULL,
            "country" TEXT NOT NULL DEFAULT 'Canada',
            "email" TEXT,
            "phone" TEXT,
            "registeredAt" TIMESTAMP(3) NOT NULL,
            "fiscalYearStart" INTEGER NOT NULL DEFAULT 1,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        );
    `);

    // TaxRate (avec précision 7,5 pour supporter TVQ 9,975 %)
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TaxRate" (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "code" TEXT NOT NULL,
            "rate" DECIMAL(7,5) NOT NULL,
            "jurisdiction" TEXT NOT NULL,
            "validFrom" TIMESTAMP(3) NOT NULL,
            "validTo" TIMESTAMP(3),
            "active" BOOLEAN NOT NULL DEFAULT true,
            "notes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        );
    `);
    // Si TaxRate existait déjà avec DECIMAL(6,4), passer à (7,5)
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "TaxRate" ALTER COLUMN "rate" TYPE DECIMAL(7,5);
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TaxRate_code_active_idx" ON "TaxRate"("code","active");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TaxRate_jurisdiction_active_idx" ON "TaxRate"("jurisdiction","active");`);

    // TaxRule
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TaxRule" (
            "id" TEXT PRIMARY KEY,
            "name" TEXT NOT NULL,
            "priority" INTEGER NOT NULL DEFAULT 0,
            "originCountry" TEXT,
            "destinationCountry" TEXT,
            "clientProvince" TEXT,
            "serviceType" TEXT,
            "regime" "TaxRegime" NOT NULL,
            "taxRateCodes" TEXT[],
            "notes" TEXT,
            "active" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TaxRule_active_priority_idx" ON "TaxRule"("active","priority");`);

    // AuditLog
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuditLog" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT,
            "entityType" TEXT NOT NULL,
            "entityId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "before" JSONB,
            "after" JSONB,
            "reason" TEXT,
            "ipAddress" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType","entityId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId","createdAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action","createdAt");`);

    console.log("  ✅ Tables Phase 1 (CompanyProfile, TaxRate, TaxRule, AuditLog)");
}

async function seedPhase1() {
    console.log("→ Seed initial (idempotent)...");

    // Profil entreprise
    const existingCompany = await prisma.companyProfile.findFirst({ where: { active: true } });
    if (!existingCompany) {
        await prisma.companyProfile.create({
            data: {
                legalName: "NIMAPLEX INC.",
                displayName: "NIMAPLEX",
                neq: null,
                gstNumber: null,
                qstNumber: null,
                address: "1280 Rue de Kingston-Sherbrooke",
                city: "Sherbrooke",
                province: "QC",
                postalCode: "TODO",  // TODO — à saisir
                country: "Canada",
                email: "contact@nimaplex.com",
                phone: null,
                registeredAt: new Date("2026-06-06"),
                fiscalYearStart: 1,
            },
        });
        console.log("  ✅ CompanyProfile créé");
    } else {
        console.log("  • CompanyProfile déjà présent");
    }

    // Taux TPS et TVQ
    const rates = [
        {
            code: "GST", name: "TPS", rate: "0.05000",
            jurisdiction: "CA-federal", validFrom: new Date("2008-01-01"),
            notes: "Taxe fédérale sur les produits et services (Loi sur la taxe d'accise). À VÉRIFIER PAR COMPTABLE.",
        },
        {
            code: "QST", name: "TVQ", rate: "0.09975",
            jurisdiction: "CA-QC", validFrom: new Date("2013-01-01"),
            notes: "Taxe de vente du Québec (depuis 2013, non appliquée sur la TPS). À VÉRIFIER PAR COMPTABLE.",
        },
    ];
    for (const r of rates) {
        const exists = await prisma.taxRate.findFirst({
            where: { code: r.code, active: true, jurisdiction: r.jurisdiction },
        });
        if (!exists) {
            await prisma.taxRate.create({ data: r as any });
            console.log(`  ✅ TaxRate ${r.code} (${r.rate}) créé`);
        } else {
            console.log(`  • TaxRate ${r.code} déjà présent`);
        }
    }

    // Règles fiscales
    const rules = [
        {
            name: "TODO — Transport international CA→NE (probable ZERO_RATED)",
            priority: 100,
            originCountry: "CA", destinationCountry: "NE",
            clientProvince: null, serviceType: "SHIPPING",
            regime: "ZERO_RATED" as const,
            taxRateCodes: [],
            notes: "À VALIDER PAR COMPTABLE. Hypothèse : services de transport internationaux de marchandises détaxés (Annexe VI Partie VII LTA). Si confirmé, aucune TPS/TVQ à percevoir.",
        },
        {
            name: "TODO — Transport international NE→CA (probable ZERO_RATED)",
            priority: 100,
            originCountry: "NE", destinationCountry: "CA",
            clientProvince: null, serviceType: "SHIPPING",
            regime: "ZERO_RATED" as const,
            taxRateCodes: [],
            notes: "À VALIDER PAR COMPTABLE. Même hypothèse que CA→NE.",
        },
        {
            name: "TODO — Service local Québec (fallback TAX_INCLUDED avec TPS+TVQ)",
            priority: 10,
            originCountry: null, destinationCountry: null,
            clientProvince: "QC", serviceType: null,
            regime: "TAX_INCLUDED" as const,
            taxRateCodes: ["GST", "QST"],
            notes: "À VALIDER PAR COMPTABLE. Fallback pour clients québécois si aucune règle plus spécifique.",
        },
    ];
    for (const rule of rules) {
        const exists = await prisma.taxRule.findFirst({
            where: {
                originCountry: rule.originCountry,
                destinationCountry: rule.destinationCountry,
                clientProvince: rule.clientProvince,
                serviceType: rule.serviceType,
                active: true,
            },
        });
        if (!exists) {
            await prisma.taxRule.create({ data: rule as any });
            console.log(`  ✅ TaxRule "${rule.name.slice(0, 60)}..." créée`);
        } else {
            console.log(`  • TaxRule (${rule.originCountry ?? "*"}→${rule.destinationCountry ?? "*"}) déjà présente`);
        }
    }
}

async function applyPhase2Schema() {
    console.log("→ Application schéma Phase 2 (idempotent)...");

    // Enum InvoiceStatus
    await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','ISSUED','PARTIAL','PAID','CANCELLED','REFUNDED');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Invoice
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Invoice" (
            "id" TEXT PRIMARY KEY,
            "number" TEXT NOT NULL UNIQUE,
            "fiscalYear" INTEGER NOT NULL,
            "sequence" INTEGER NOT NULL,
            "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
            "clientName" TEXT NOT NULL,
            "clientEmail" TEXT,
            "clientPhone" TEXT,
            "clientProvince" TEXT,
            "clientCountry" TEXT,
            "shipmentId" INTEGER UNIQUE,
            "shipmentTrackingId" TEXT,
            "regime" "TaxRegime" NOT NULL,
            "amountBeforeTax" DECIMAL(12,2) NOT NULL,
            "totalTax" DECIMAL(12,2) NOT NULL,
            "totalIncludingTax" DECIMAL(12,2) NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'CAD',
            "companyName" TEXT NOT NULL,
            "companyAddress" TEXT NOT NULL,
            "companyCity" TEXT NOT NULL,
            "companyProvince" TEXT NOT NULL,
            "companyPostalCode" TEXT,
            "companyCountry" TEXT NOT NULL,
            "companyEmail" TEXT,
            "companyGstNumber" TEXT,
            "companyQstNumber" TEXT,
            "companyNeq" TEXT,
            "taxRuleId" TEXT,
            "taxRuleName" TEXT,
            "taxRuleNotes" TEXT,
            "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "dueDate" TIMESTAMP(3),
            "paidAt" TIMESTAMP(3),
            "cancelledAt" TIMESTAMP(3),
            "cancelledReason" TEXT,
            "refundedAt" TIMESTAMP(3),
            "createdById" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
        );
    `);

    // Foreign keys (best effort)
    await execIgnoreDup(`
        ALTER TABLE "Invoice"
        ADD CONSTRAINT "Invoice_shipmentId_fkey"
        FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    await execIgnoreDup(`
        ALTER TABLE "Invoice"
        ADD CONSTRAINT "Invoice_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // Unique + Indexes Invoice
    await execIgnoreDup(`ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_fiscalYear_sequence_key" UNIQUE ("fiscalYear","sequence");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_status_issuedAt_idx" ON "Invoice"("status","issuedAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_shipmentId_idx" ON "Invoice"("shipmentId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Invoice_fiscalYear_sequence_idx" ON "Invoice"("fiscalYear","sequence");`);

    // InvoiceItem
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InvoiceItem" (
            "id" TEXT PRIMARY KEY,
            "invoiceId" TEXT NOT NULL,
            "description" TEXT NOT NULL,
            "detailedDescription" TEXT,
            "quantity" DECIMAL(10,4) NOT NULL DEFAULT 1,
            "unitPrice" DECIMAL(12,2) NOT NULL,
            "amountBeforeTax" DECIMAL(12,2) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
    await execIgnoreDup(`
        ALTER TABLE "InvoiceItem"
        ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");`);

    // InvoiceTaxSnapshot
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "InvoiceTaxSnapshot" (
            "id" TEXT PRIMARY KEY,
            "invoiceId" TEXT NOT NULL,
            "taxRateId" TEXT,
            "code" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "rate" DECIMAL(7,5) NOT NULL,
            "jurisdiction" TEXT NOT NULL,
            "amount" DECIMAL(12,2) NOT NULL
        );
    `);
    await execIgnoreDup(`
        ALTER TABLE "InvoiceTaxSnapshot"
        ADD CONSTRAINT "InvoiceTaxSnapshot_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InvoiceTaxSnapshot_invoiceId_idx" ON "InvoiceTaxSnapshot"("invoiceId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InvoiceTaxSnapshot_code_invoiceId_idx" ON "InvoiceTaxSnapshot"("code","invoiceId");`);

    console.log("  ✅ Tables Phase 2 (Invoice, InvoiceItem, InvoiceTaxSnapshot)");
}

async function applyPhase28Schema() {
    console.log("→ Ajout colonnes paiement sur Shipment (idempotent)...");

    // totalAmount : montant total à facturer au client
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION;
    `);

    // currency : devise du montant (CAD par défaut, XOF pour FCFA)
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'CAD';
    `);

    console.log("  ✅ Colonnes Shipment.totalAmount + Shipment.currency ajoutées");
}

/** Exécute une commande SQL et ignore l'erreur si contrainte déjà existante. */
async function execIgnoreDup(sql: string) {
    try {
        await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/already exists|duplicate/i.test(msg)) return;
        throw e;
    }
}

main()
    .catch((e) => {
        console.error("\n❌ ERREUR :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
