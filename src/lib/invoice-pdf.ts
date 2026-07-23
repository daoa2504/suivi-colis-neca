// src/lib/invoice-pdf.ts
//
// Génération PDF des factures NIMAPLEX (deux variantes) via jspdf.
//   - "client" : version simplifiée envoyée au client (taxes incluses,
//     pas de ventilation TPS/TVQ)
//   - "accounting" : version détaillée conservée en interne (ventilation
//     HT + TPS + TVQ + note règle fiscale appliquée)
//
// Utilisable côté serveur (Route Handler, envoi email).
//
// Le rendu suit visuellement la maquette validée par l'utilisateur :
// papier crème, encre near-black, accent vert forêt, tag ambre pour les
// mentions "à valider par comptable".

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "node:fs";
import path from "node:path";
import type { InvoiceWithRelations } from "@/lib/invoice";

// --- Palette (dérivée de la maquette) ----------------------------------------
const C = {
    paper: [251, 250, 246] as const,     // #FBFAF6
    ink: [26, 26, 26] as const,          // #1A1A1A
    muted: [107, 107, 101] as const,     // #6B6B65
    faint: [169, 166, 156] as const,     // #A9A69C
    accent: [14, 75, 60] as const,       // #0E4B3C
    accentBg: [232, 239, 235] as const,  // #E8EFEB
    warn: [139, 90, 0] as const,         // #8B5A00
    warnBg: [251, 243, 225] as const,    // #FBF3E1
    rule: [226, 223, 213] as const,      // #E2DFD5
};

// --- Logo (cache module-level) -----------------------------------------------
let LOGO_DATA_URI: string | null = null;
function getLogoDataUri(): string | null {
    if (LOGO_DATA_URI !== null) return LOGO_DATA_URI;
    try {
        const logoPath = path.join(process.cwd(), "public", "img.png");
        const buf = fs.readFileSync(logoPath);
        LOGO_DATA_URI = `data:image/png;base64,${buf.toString("base64")}`;
        return LOGO_DATA_URI;
    } catch (e) {
        console.warn("[invoice-pdf] logo public/img.png introuvable, PDF sans logo");
        LOGO_DATA_URI = ""; // Sentinelle pour ne pas re-tenter
        return null;
    }
}

// --- Formats -----------------------------------------------------------------
function formatMoneyRaw(v: string | number): string {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n.toLocaleString("fr-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatMoney(v: string | number, currency = "CAD"): string {
    const symbol = currency === "XOF" ? "FCFA" : "$";
    return currency === "XOF"
        ? formatMoneyRaw(v) + " " + symbol
        : formatMoneyRaw(v) + " " + symbol;
}

function currencyLabel(c: string): string {
    return c === "XOF" ? "FCFA" : "CAD";
}

function formatDate(d: Date | string): string {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function statusLabel(status: string): string {
    switch (status) {
        case "PAID": return "Payée";
        case "PARTIAL": return "Partielle";
        case "ISSUED": return "À payer";
        case "CANCELLED": return "Annulée";
        case "REFUNDED": return "Remboursée";
        case "DRAFT": return "Brouillon";
        default: return status;
    }
}

function regimeLabel(regime: string): string {
    switch (regime) {
        case "TAX_INCLUDED": return "Taxes incluses";
        case "TAX_EXCLUDED": return "Taxes ajoutées";
        case "ZERO_RATED": return "Zero-rated";
        case "TAX_EXEMPT": return "Exonérée";
        case "OUT_OF_SCOPE": return "Hors champ";
        default: return regime;
    }
}

function routeLabel(origin?: string | null, destination?: string | null): string {
    const label = (c: string | null | undefined) =>
        c === "CA" ? "Canada" : c === "NE" ? "Niger" : (c ?? "?");
    // jsPDF helvetica utilise WinAnsi qui ne contient PAS les flèches Unicode.
    // On utilise ">" qui rend correctement dans tous les viewers PDF.
    return `${label(origin)} > ${label(destination)}`;
}

/** Nettoie un texte pour le rendu PDF (helvetica WinAnsi).
 *  Remplace les caractères Unicode que la police par défaut ne peut pas rendre
 *  (flèche → et similaires) par des équivalents ASCII. Utile pour les
 *  textes venant de la base (detailedDescription) créés avant ce fix.
 */
function pdfSafe(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/→/g, ">")
        .replace(/←/g, "<")
        .replace(/↔/g, "<>")
        .replace(/⇒/g, "=>")
        .replace(/⇐/g, "<=");
}

// --- Génération PDF ----------------------------------------------------------

export type InvoiceVariant = "client" | "accounting";

export function renderInvoicePdf(
    invoice: InvoiceWithRelations,
    variant: InvoiceVariant
): Buffer {
    const doc = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
    });

    // Page A4 = 210 × 297 mm
    const pageW = 210;
    const pageH = 297;
    const marginX = 18;
    const contentW = pageW - marginX * 2;

    // Fond papier
    doc.setFillColor(C.paper[0], C.paper[1], C.paper[2]);
    doc.rect(0, 0, pageW, pageH, "F");

    // Bandeau accent top
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.rect(0, 0, pageW, 3, "F");

    // ---- HEADER --------------------------------------------------------------
    let y = 18;

    // Logo (à gauche)
    const logoUri = getLogoDataUri();
    if (logoUri) {
        try {
            doc.addImage(logoUri, "PNG", marginX, y, 15, 15, undefined, "FAST");
        } catch (e) {
            console.warn("[invoice-pdf] addImage failed:", e);
        }
    }

    // Nom entreprise + adresse (à côté du logo)
    const brandX = marginX + 19;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
    doc.setFontSize(15);
    doc.text(invoice.companyName, brandX, y + 5);
    // .INC en petit
    const nameW = doc.getTextWidth(invoice.companyName);
    doc.setFontSize(7);
    doc.setTextColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.setFont("helvetica", "bold");
    doc.text(".INC", brandX + nameW + 0.5, y + 2.5);

    // Adresse & coordonnées entreprise
    doc.setFont("helvetica", "normal");
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.setFontSize(8);
    const addrLines: string[] = [
        `${invoice.companyAddress}${invoice.companyPostalCode && invoice.companyPostalCode !== "TODO" ? ", " + invoice.companyPostalCode : ""}`,
        `${invoice.companyCity}, ${invoice.companyProvince} · ${invoice.companyCountry}`,
    ];
    if (variant === "accounting") {
        const fiscal: string[] = [];
        if (invoice.companyNeq) fiscal.push(`NEQ : ${invoice.companyNeq}`);
        if (invoice.companyGstNumber) fiscal.push(`TPS : ${invoice.companyGstNumber}`);
        if (invoice.companyQstNumber) fiscal.push(`TVQ : ${invoice.companyQstNumber}`);
        if (fiscal.length > 0) addrLines.push(fiscal.join(" · "));
    }
    if (invoice.companyEmail) addrLines.push(invoice.companyEmail);

    doc.text(addrLines, brandX, y + 10);

    // Meta facture (à droite)
    const rightX = pageW - marginX;
    doc.setFontSize(7);
    doc.setTextColor(C.faint[0], C.faint[1], C.faint[2]);
    doc.text(variant === "client" ? "FACTURE" : "FACTURE (INTERNE)", rightX, y, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
    doc.text(invoice.number, rightX, y + 7, { align: "right" });

    doc.setFontSize(8);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text(`Émise le  ${formatDate(invoice.issuedAt)}`, rightX, y + 13, { align: "right" });

    // Badge statut (client) ou régime (accounting)
    const badgeText = variant === "client"
        ? statusLabel(invoice.status)
        : regimeLabel(invoice.regime);
    const badgeColor = variant === "client" ? C.accent : C.warn;
    const badgeBg = variant === "client" ? C.accentBg : C.warnBg;
    drawBadge(doc, rightX, y + 17, badgeText, badgeColor, badgeBg);

    // Séparateur bas header
    y += 30;
    doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, pageW - marginX, y);
    y += 8;

    // ---- PARTY BLOCK (2 colonnes) --------------------------------------------
    const colW = contentW / 2 - 4;

    // Gauche : Facturé à
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.faint[0], C.faint[1], C.faint[2]);
    doc.text(variant === "client" ? "FACTURÉ À" : "CLIENT", marginX, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
    doc.text(invoice.clientName, marginX, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    const clientLines: string[] = [];
    if (invoice.clientEmail) clientLines.push(invoice.clientEmail);
    if (invoice.clientPhone) clientLines.push(invoice.clientPhone);
    doc.text(clientLines, marginX, y + 10);

    // Droite : Suivi (client) ou Traitement fiscal (accounting)
    const rightColX = marginX + colW + 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(C.faint[0], C.faint[1], C.faint[2]);
    doc.text(variant === "client" ? "SUIVI DE L'ENVOI" : "TRAITEMENT FISCAL", rightColX, y);

    if (variant === "client") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text(invoice.shipmentTrackingId ?? "—", rightColX, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
        const route = routeLabel(invoice.shipment?.originCountry, invoice.shipment?.destinationCountry);
        doc.text(route, rightColX, y + 10);
    } else {
        const route = routeLabel(invoice.shipment?.originCountry, invoice.shipment?.destinationCountry);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text(`Transport ${route}`, rightColX, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
        if (invoice.taxRuleName) {
            const wrapped = doc.splitTextToSize(pdfSafe(`Règle : ${invoice.taxRuleName}`), colW);
            doc.text(wrapped, rightColX, y + 10);
        }
    }

    y += 22;

    // ---- TABLE ITEMS ---------------------------------------------------------
    if (variant === "client") {
        // Version client : Description + Montant TTC
        autoTable(doc, {
            startY: y,
            margin: { left: marginX, right: marginX },
            head: [["Description", "Montant"]],
            body: invoice.items.map((it) => [
                {
                    content: pdfSafe(it.description) + (it.detailedDescription ? "\n" + pdfSafe(it.detailedDescription) : ""),
                    styles: { fontStyle: "normal" },
                },
                { content: formatMoney(invoice.totalIncludingTax.toString(), invoice.currency), styles: { halign: "right" } },
            ]),
            styles: {
                font: "helvetica",
                fontSize: 9,
                cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 0 },
                textColor: C.ink as any,
                fillColor: C.paper as any,
                lineColor: C.rule as any,
                lineWidth: 0.15,
            },
            headStyles: {
                fillColor: C.paper as any,
                textColor: C.faint as any,
                fontSize: 7,
                fontStyle: "bold",
                cellPadding: { top: 2, right: 3, bottom: 2, left: 0 },
                lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
                lineColor: C.rule as any,
            },
            columnStyles: {
                0: { cellWidth: contentW * 0.72 },
                1: { cellWidth: contentW * 0.28, halign: "right" },
            },
            theme: "plain",
        });
    } else {
        // Version accounting : Description + HT + TPS + TVQ + Total
        const taxRow: Record<string, string> = {};
        for (const t of invoice.taxSnapshots) taxRow[t.code] = t.amount.toString();
        const hasGst = invoice.taxSnapshots.some(t => t.code === "GST");
        const hasQst = invoice.taxSnapshots.some(t => t.code === "QST");

        const head: any[] = ["Description", "HT"];
        if (hasGst) head.push("TPS");
        if (hasQst) head.push("TVQ");
        head.push("Total");

        const body: any[] = [];
        for (const it of invoice.items) {
            const row: any[] = [
                {
                    content: pdfSafe(it.description) + (it.detailedDescription ? "\n" + pdfSafe(it.detailedDescription) : ""),
                    styles: { fontStyle: "normal" },
                },
                { content: formatMoneyRaw(it.amountBeforeTax.toString()), styles: { halign: "right" } },
            ];
            if (hasGst) row.push({ content: formatMoneyRaw(taxRow["GST"] ?? "0"), styles: { halign: "right" } });
            if (hasQst) row.push({ content: formatMoneyRaw(taxRow["QST"] ?? "0"), styles: { halign: "right" } });
            row.push({ content: formatMoneyRaw(invoice.totalIncludingTax.toString()), styles: { halign: "right" } });
            body.push(row);
        }

        const totalCols = 2 + (hasGst ? 1 : 0) + (hasQst ? 1 : 0) + 1;
        const descW = contentW * 0.44;
        const numW = (contentW - descW) / (totalCols - 1);
        const columnStyles: any = {
            0: { cellWidth: descW },
        };
        for (let i = 1; i < totalCols; i++) {
            columnStyles[i] = { cellWidth: numW, halign: "right" };
        }

        autoTable(doc, {
            startY: y,
            margin: { left: marginX, right: marginX },
            head: [head],
            body,
            styles: {
                font: "helvetica",
                fontSize: 9,
                cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 0 },
                textColor: C.ink as any,
                fillColor: C.paper as any,
                lineColor: C.rule as any,
                lineWidth: 0.15,
            },
            headStyles: {
                fillColor: C.paper as any,
                textColor: C.faint as any,
                fontSize: 7,
                fontStyle: "bold",
                cellPadding: { top: 2, right: 3, bottom: 2, left: 0 },
                lineWidth: { top: 0, bottom: 0.2, left: 0, right: 0 },
                lineColor: C.rule as any,
            },
            columnStyles,
            theme: "plain",
        });
    }

    // Récupère y après table (autoTable enrichit doc.lastAutoTable au runtime)
    y = (doc as any).lastAutoTable.finalY + 8;

    // ---- TOTAUX --------------------------------------------------------------
    // Largeur réservée aux totaux : suffisamment large pour éviter que le libellé
    // "Total (taxes incluses)" à 13pt colle au montant.
    const totalsW = 105;
    const totalsX = pageW - marginX - totalsW;

    if (variant === "client") {
        // Uniquement le total
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setDrawColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.setLineWidth(0.6);
        doc.line(totalsX, y, pageW - marginX, y);
        y += 6;
        doc.setFontSize(13);
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text("Total (taxes incluses)", totalsX, y);
        doc.text(formatMoney(invoice.totalIncludingTax.toString(), invoice.currency) + " " + currencyLabel(invoice.currency), pageW - marginX, y, { align: "right" });
        y += 6;
    } else {
        // HT + taxes + total
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
        const cur = invoice.currency;
        const zeroLabel = cur === "XOF" ? "0 FCFA" : "0,00 $";

        doc.text("Sous-total HT", totalsX, y);
        doc.text(formatMoney(invoice.amountBeforeTax.toString(), cur), pageW - marginX, y, { align: "right" });
        y += 5;

        for (const t of invoice.taxSnapshots) {
            const ratePercent = (parseFloat(t.rate.toString()) * 100).toLocaleString("fr-CA", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 3,
            });
            doc.text(`${t.name} (${ratePercent} %)`, totalsX, y);
            doc.text(formatMoney(t.amount.toString(), cur), pageW - marginX, y, { align: "right" });
            y += 5;
        }

        if (invoice.taxSnapshots.length === 0) {
            // ZERO_RATED / EXEMPT : afficher qd même TPS et TVQ à 0
            doc.text("TPS (5 %)", totalsX, y);
            doc.text(zeroLabel, pageW - marginX, y, { align: "right" });
            y += 5;
            doc.text("TVQ (9,975 %)", totalsX, y);
            doc.text(zeroLabel, pageW - marginX, y, { align: "right" });
            y += 5;
        }

        y += 1;
        doc.setDrawColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.setLineWidth(0.6);
        doc.line(totalsX, y, pageW - marginX, y);
        y += 6;

        doc.setFontSize(13);
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text("Total facturé", totalsX, y);
        doc.text(formatMoney(invoice.totalIncludingTax.toString(), cur) + " " + currencyLabel(cur), pageW - marginX, y, { align: "right" });
        y += 8;
    }

    // ---- NOTE COMPTABLE (accounting only) ------------------------------------
    if (variant === "accounting" && invoice.taxRuleNotes) {
        y += 4;
        const noteH = 20;
        // Fond warn-bg
        doc.setFillColor(C.warnBg[0], C.warnBg[1], C.warnBg[2]);
        doc.rect(marginX, y, contentW, noteH, "F");
        // Filet gauche warn
        doc.setFillColor(C.warn[0], C.warn[1], C.warn[2]);
        doc.rect(marginX, y, 0.8, noteH, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(C.warn[0], C.warn[1], C.warn[2]);
        doc.text("À valider par le comptable", marginX + 3, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const wrapped = doc.splitTextToSize(pdfSafe(invoice.taxRuleNotes), contentW - 6);
        doc.text(wrapped, marginX + 3, y + 10);
        y += noteH + 4;
    }

    // ---- FOOTER --------------------------------------------------------------
    const footerY = pageH - 18;
    doc.setDrawColor(C.rule[0], C.rule[1], C.rule[2]);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 4, pageW - marginX, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    if (variant === "client") {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(C.ink[0], C.ink[1], C.ink[2]);
        doc.text("Merci de votre confiance.", marginX, footerY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
        doc.text("NIMAPLEX INC. · nimaplex.com", pageW - marginX, footerY, { align: "right" });
    } else {
        doc.text(`Exercice fiscal ${invoice.fiscalYear} · Journal des ventes`, marginX, footerY);
        if (invoice.shipmentTrackingId) {
            doc.text(`Réf. interne : ${invoice.shipmentTrackingId}`, pageW - marginX, footerY, { align: "right" });
        }
    }

    // Meta PDF
    doc.setProperties({
        title: `${invoice.number} — ${variant === "client" ? "Facture" : "Facture interne"}`,
        subject: `Facture NIMAPLEX ${invoice.number}`,
        author: "NIMAPLEX INC.",
        creator: "NIMAPLEX Suivi de Colis",
    });

    const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
    return Buffer.from(arrayBuffer);
}

// --- Helpers de dessin -------------------------------------------------------

function drawBadge(
    doc: jsPDF,
    rightX: number,
    y: number,
    text: string,
    fg: readonly [number, number, number],
    bg: readonly [number, number, number]
) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const textW = doc.getTextWidth(text);
    const padX = 2;
    const padY = 1.5;
    const boxW = textW + padX * 2;
    const boxH = 4;
    const x = rightX - boxW;

    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y - boxH + 0.5, boxW, boxH, 0.5, 0.5, "F");

    doc.setTextColor(fg[0], fg[1], fg[2]);
    doc.text(text.toUpperCase(), x + padX, y - 0.8);
}
