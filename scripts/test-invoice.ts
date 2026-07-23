// scripts/test-invoice.ts
//
// Test bout-en-bout : crée un colis factice, génère la facture, produit
// les 2 PDFs et les écrit sur disque pour inspection.
//
// Usage : npx tsx scripts/test-invoice.ts
// Sortie : scripts/out/invoice-client.pdf + scripts/out/invoice-accounting.pdf

import { PrismaClient } from "@prisma/client";
import { createInvoiceForShipment, getInvoiceByShipment } from "../src/lib/invoice";
import { renderInvoicePdf } from "../src/lib/invoice-pdf";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
    const outDir = path.join(process.cwd(), "scripts", "out");
    fs.mkdirSync(outDir, { recursive: true });

    // 1. Vérifier / créer un convoi de test
    let convoy = await prisma.convoy.findFirst({
        where: { direction: "CA_TO_NE" },
        orderBy: { date: "desc" },
    });
    if (!convoy) {
        convoy = await prisma.convoy.create({
            data: { date: new Date("2026-08-03"), direction: "CA_TO_NE" },
        });
        console.log("→ Convoi test créé:", convoy.id);
    }

    // 2. Créer un colis avec paiement 100$
    const shipment = await prisma.shipment.create({
        data: {
            trackingId: `TEST-${Date.now()}`,
            receiverName: "Amadou Diallo",
            receiverEmail: "amadou.diallo@example.com",
            receiverPhone: "+1 514 555 0134",
            originCountry: "CA",
            destinationCountry: "NE",
            convoyId: convoy.id,
            paymentStatus: "PAID",
            amountPaid: 100,
            status: "RECEIVED_IN_CANADA",
        },
    });
    console.log(`→ Colis test créé: ${shipment.trackingId} (id=${shipment.id})`);

    // 3. Créer la facture
    const invoice = await createInvoiceForShipment(shipment.id);
    if (!invoice) {
        console.error("ERREUR : facture non créée");
        process.exit(1);
    }
    console.log(`→ Facture ${invoice.number} créée (régime=${invoice.regime})`);

    // 4. Recharger avec relations complètes
    const full = await getInvoiceByShipment(shipment.id);
    if (!full) throw new Error("Impossible de recharger la facture");
    console.log(`  · HT ${full.amountBeforeTax} + taxes ${full.totalTax} = TTC ${full.totalIncludingTax}`);
    console.log(`  · ${full.taxSnapshots.length} snapshot(s) taxe`);

    // 5. Générer les 2 PDFs
    const clientPdf = renderInvoicePdf(full, "client");
    const accountingPdf = renderInvoicePdf(full, "accounting");

    const clientPath = path.join(outDir, "invoice-client.pdf");
    const accountingPath = path.join(outDir, "invoice-accounting.pdf");
    fs.writeFileSync(clientPath, clientPdf);
    fs.writeFileSync(accountingPath, accountingPdf);
    console.log(`✅ PDF client :     ${clientPath} (${clientPdf.length} bytes)`);
    console.log(`✅ PDF accounting : ${accountingPath} (${accountingPdf.length} bytes)`);

    // 6. Test idempotence : re-créer sur le même shipment doit retourner la même facture
    const again = await createInvoiceForShipment(shipment.id);
    if (again?.id !== invoice.id) {
        console.error("❌ Idempotence cassée : re-création a produit une autre facture");
        process.exit(1);
    }
    console.log("✅ Idempotence : createInvoiceForShipment appelé 2x retourne la même facture");

    // 7. Cleanup : supprimer le colis + facture test
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.shipment.delete({ where: { id: shipment.id } });
    console.log("🧹 Colis et facture de test supprimés");
}

main()
    .catch((e) => {
        console.error("ERREUR :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
