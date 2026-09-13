// src/app/admin/convoys/PackingListButton.tsx
//
// Liste de colisage (packing list) d'un convoi, en PDF mis en page et en Excel.
//
// Le document décrit le contenu PHYSIQUE de l'expédition : quoi, combien,
// quel poids, dans quel carton. Valeur, origine et classement tarifaire
// n'y figurent pas — ils relèvent de la facture commerciale et de la
// déclaration en douane, pas de ce document-ci.
//
// Les libellés sont bilingues : le document peut être présenté à l'ASFC
// comme au correspondant à l'arrivée.

"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { describeContent, formatDimensions } from "@/lib/itemKind";

type Company = {
    legalName: string;
    displayName: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    email: string | null;
    phone: string | null;
    neq: string | null;
    gstNumber: string | null;
    qstNumber: string | null;
};

type Shipment = {
    id: number;
    trackingId: string;
    receiverName: string;
    receiverPhone: string | null;
    receiverCity: string | null;
    receiverAddress: string | null;
    receiverPoBox: string | null;
    weightKg: number | null;
    itemKind: "PARCEL" | "DEVICE" | null;
    deviceType: string | null;
    packageCount: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    items: { id: string; label: string; quantity: number; weightKg: number | null }[];
};

type PackingData = {
    company: Company | null;
    convoy: { date: string; direction: string };
    shipments: Shipment[];
};

// Rouge NIMAPLEX, repris de l'en-tête de l'application
const BRAND: [number, number, number] = [139, 0, 0];
const INK: [number, number, number] = [33, 37, 41];
const MUTED: [number, number, number] = [108, 117, 125];

const MARGIN = 36;

function fmtDate(d: string | Date) {
    const date = new Date(d);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function routeLabel(direction: string) {
    return direction === "CA_TO_NE" ? "Canada → Niger" : "Niger → Canada";
}

/** Description du contenu d'un envoi, une ligne de texte par article. */
function contentLines(s: Shipment): string {
    if (s.items.length > 0) {
        return s.items
            .map((it) => `${it.quantity > 1 ? `${it.quantity} × ` : ""}${it.label}`)
            .join("\n");
    }
    // Pas d'articles détaillés : on retombe sur la nature de l'envoi
    if (s.itemKind === "DEVICE") {
        const dims = formatDimensions(s.lengthCm, s.widthCm, s.heightCm);
        return dims ? `${s.deviceType || "Appareil"} (${dims})` : s.deviceType || "Appareil";
    }
    return "Effets personnels";
}

function totalQty(s: Shipment): number {
    const q = s.items.reduce((acc, it) => acc + it.quantity, 0);
    return q || s.items.length || 1;
}

export default function PackingListButton({
    convoyId,
    convoyDate,
    direction,
}: {
    convoyId: string;
    convoyDate: string;
    direction: "NE_TO_CA" | "CA_TO_NE";
}) {
    const [loading, setLoading] = useState<null | "pdf" | "xlsx">(null);

    async function fetchData(): Promise<PackingData | null> {
        const res = await fetch(`/api/convoys/${convoyId}/export-data`);
        const data = await res.json();
        if (!data.ok) {
            alert(`❌ ${data.error}`);
            return null;
        }
        return data;
    }

    /** Numéro de document, stable pour un convoi donné : LC-AAAAMMJJ-SENS */
    function documentNumber() {
        return `LC-${fmtDate(convoyDate).replace(/-/g, "")}-${
            direction === "CA_TO_NE" ? "CANE" : "NECA"
        }`;
    }

    // ------------------------------------------------------------------ PDF

    async function exportPdf() {
        setLoading("pdf");
        try {
            const data = await fetchData();
            if (!data) return;

            const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
            const pageW = doc.internal.pageSize.getWidth();
            const company = data.company;

            const totalPackages = data.shipments.reduce(
                (acc, s) => acc + (s.packageCount ?? 1),
                0
            );
            const totalWeight = data.shipments.reduce((acc, s) => acc + (s.weightKg ?? 0), 0);

            // ---- En-tête : identité de l'entreprise ----
            let y = MARGIN;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(...BRAND);
            doc.text(company?.displayName || "NIMAPLEX", MARGIN, y + 4);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            const identity = [
                company?.legalName,
                company
                    ? `${company.address}, ${company.city} (${company.province}) ${company.postalCode}, ${company.country}`
                    : null,
                [company?.phone, company?.email].filter(Boolean).join(" · ") || null,
                [
                    company?.neq ? `NEQ ${company.neq}` : null,
                    company?.gstNumber ? `TPS ${company.gstNumber}` : null,
                    company?.qstNumber ? `TVQ ${company.qstNumber}` : null,
                ]
                    .filter(Boolean)
                    .join(" · ") || null,
            ].filter(Boolean) as string[];

            let ly = y + 18;
            for (const line of identity) {
                doc.text(line, MARGIN, ly);
                ly += 10;
            }

            // ---- Titre du document, aligné à droite ----
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(...INK);
            doc.text("LISTE DE COLISAGE", pageW - MARGIN, y + 2, { align: "right" });
            doc.setFontSize(9);
            doc.setTextColor(...MUTED);
            doc.text("PACKING LIST", pageW - MARGIN, y + 15, { align: "right" });
            doc.setFontSize(8);
            doc.text(documentNumber(), pageW - MARGIN, y + 28, { align: "right" });

            y = Math.max(ly, y + 40) + 6;

            doc.setDrawColor(...BRAND);
            doc.setLineWidth(1.5);
            doc.line(MARGIN, y, pageW - MARGIN, y);
            y += 16;

            // ---- Bloc de référence ----
            autoTable(doc, {
                startY: y,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 5, textColor: INK, lineColor: [222, 226, 230] },
                columnStyles: {
                    0: { fontStyle: "bold", fillColor: [248, 249, 250], cellWidth: 105 },
                    1: { cellWidth: 160 },
                    2: { fontStyle: "bold", fillColor: [248, 249, 250], cellWidth: 105 },
                    3: { cellWidth: "auto" },
                },
                body: [
                    [
                        "Date du convoi\nConvoy date",
                        fmtDate(convoyDate),
                        "Nombre de cartons\nTotal packages",
                        String(totalPackages),
                    ],
                    [
                        "Trajet\nRoute",
                        routeLabel(direction),
                        "Poids brut total\nTotal gross weight",
                        `${totalWeight.toFixed(2)} kg`,
                    ],
                    [
                        "N° AWB / LTA\nAir waybill",
                        "", // rempli à la main sur le document imprimé
                        "Nombre d'envois\nConsignments",
                        String(data.shipments.length),
                    ],
                ],
                margin: { left: MARGIN, right: MARGIN },
            });
            y = (doc as any).lastAutoTable.finalY + 14;

            // ---- Expéditeur / Destinataires ----
            const shipperBlock = company
                ? `${company.legalName}\n${company.address}\n${company.city} (${company.province}) ${company.postalCode}\n${company.country}`
                : "NIMAPLEX INC.";

            autoTable(doc, {
                startY: y,
                theme: "grid",
                styles: { fontSize: 8, cellPadding: 6, textColor: INK, lineColor: [222, 226, 230] },
                headStyles: {
                    fillColor: [248, 249, 250],
                    textColor: INK,
                    fontStyle: "bold",
                    fontSize: 7.5,
                },
                head: [["EXPÉDITEUR / SHIPPER", "DESTINATAIRES / CONSIGNEES"]],
                body: [
                    [
                        shipperBlock,
                        `Envoi groupé — ${data.shipments.length} destinataires distincts.\nConsolidated shipment — see detail below.`,
                    ],
                ],
                columnStyles: { 0: { cellWidth: (pageW - MARGIN * 2) / 2 } },
                margin: { left: MARGIN, right: MARGIN },
            });
            y = (doc as any).lastAutoTable.finalY + 16;

            // ---- Tableau principal, groupé par ville ----
            const byCity = new Map<string, Shipment[]>();
            for (const s of data.shipments) {
                const city = (s.receiverCity || "Sans ville").trim();
                if (!byCity.has(city)) byCity.set(city, []);
                byCity.get(city)!.push(s);
            }
            const sortedCities = Array.from(byCity.keys()).sort();

            let lineNo = 0;

            for (const city of sortedCities) {
                const shipments = byCity.get(city)!;
                const cityPackages = shipments.reduce((a, s) => a + (s.packageCount ?? 1), 0);
                const cityWeight = shipments.reduce((a, s) => a + (s.weightKg ?? 0), 0);

                // Titre de section : une ville par bloc, comme sur un manifeste
                if (y > doc.internal.pageSize.getHeight() - 140) {
                    doc.addPage();
                    y = MARGIN;
                }
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(...BRAND);
                doc.text(
                    `${city} — ${shipments.length} envoi${shipments.length > 1 ? "s" : ""}, ${cityPackages} carton${cityPackages > 1 ? "s" : ""}`,
                    MARGIN,
                    y
                );
                y += 8;

                const body = shipments.map((s) => {
                    lineNo += 1;
                    return [
                        String(lineNo),
                        s.trackingId,
                        s.receiverName,
                        String(s.packageCount ?? 1),
                        describeContent(s.itemKind, s.deviceType),
                        contentLines(s),
                        String(totalQty(s)),
                        s.weightKg != null ? s.weightKg.toFixed(2) : "—",
                    ];
                });

                body.push([
                    "",
                    "",
                    `Sous-total ${city}`,
                    String(cityPackages),
                    "",
                    "",
                    "",
                    cityWeight.toFixed(2),
                ]);

                autoTable(doc, {
                    startY: y,
                    theme: "striped",
                    head: [
                        [
                            "N°",
                            "Marque & n°\nMarks & nos",
                            "Destinataire\nConsignee",
                            "Cartons\nPkgs",
                            "Nature\nType",
                            "Description du contenu\nDescription of contents",
                            "Qté\nQty",
                            "Poids (kg)\nWeight",
                        ],
                    ],
                    body,
                    styles: {
                        fontSize: 7.5,
                        cellPadding: 4,
                        textColor: INK,
                        lineColor: [233, 236, 239],
                        valign: "top",
                    },
                    headStyles: { fillColor: BRAND, textColor: 255, fontSize: 7, valign: "middle" },
                    alternateRowStyles: { fillColor: [250, 250, 250] },
                    columnStyles: {
                        0: { cellWidth: 22, halign: "right" },
                        1: { cellWidth: 62 },
                        2: { cellWidth: 95 },
                        3: { cellWidth: 34, halign: "center" },
                        4: { cellWidth: 60 },
                        5: { cellWidth: "auto" },
                        6: { cellWidth: 26, halign: "center" },
                        7: { cellWidth: 48, halign: "right" },
                    },
                    margin: { left: MARGIN, right: MARGIN },
                    // La dernière ligne de chaque bloc est le sous-total
                    didParseCell: (hook) => {
                        if (
                            hook.section === "body" &&
                            hook.row.index === body.length - 1
                        ) {
                            hook.cell.styles.fontStyle = "bold";
                            hook.cell.styles.fillColor = [241, 243, 245];
                        }
                    },
                });

                y = (doc as any).lastAutoTable.finalY + 18;
            }

            // ---- Total général ----
            autoTable(doc, {
                startY: y,
                theme: "grid",
                styles: { fontSize: 9, cellPadding: 6, fontStyle: "bold", textColor: 255 },
                body: [
                    [
                        "TOTAL GÉNÉRAL / GRAND TOTAL",
                        `${data.shipments.length} envois`,
                        `${totalPackages} cartons`,
                        `${totalWeight.toFixed(2)} kg`,
                    ],
                ],
                columnStyles: {
                    0: { cellWidth: "auto" },
                    1: { cellWidth: 90, halign: "center" },
                    2: { cellWidth: 90, halign: "center" },
                    3: { cellWidth: 90, halign: "right" },
                },
                bodyStyles: { fillColor: BRAND },
                margin: { left: MARGIN, right: MARGIN },
            });
            y = (doc as any).lastAutoTable.finalY + 26;

            // ---- Bloc de signature ----
            if (y > doc.internal.pageSize.getHeight() - 110) {
                doc.addPage();
                y = MARGIN;
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(...MUTED);
            doc.text(
                "Je certifie que la présente liste décrit fidèlement le contenu de l'expédition. / I certify that this list accurately describes the contents of this shipment.",
                MARGIN,
                y,
                { maxWidth: pageW - MARGIN * 2 }
            );
            y += 30;

            const colW = (pageW - MARGIN * 2 - 30) / 2;
            doc.setDrawColor(150);
            doc.setLineWidth(0.5);
            doc.line(MARGIN, y, MARGIN + colW, y);
            doc.line(MARGIN + colW + 30, y, pageW - MARGIN, y);
            doc.setFontSize(7.5);
            doc.text("Préparé par / Prepared by", MARGIN, y + 11);
            doc.text("Date et signature / Date and signature", MARGIN + colW + 30, y + 11);

            // ---- Pied de page sur toutes les pages ----
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const h = doc.internal.pageSize.getHeight();
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(...MUTED);
                doc.text(
                    `${documentNumber()} · ${company?.displayName || "NIMAPLEX"} · émis le ${fmtDate(
                        new Date()
                    )}`,
                    MARGIN,
                    h - 20
                );
                doc.text(`Page ${i} / ${pageCount}`, pageW - MARGIN, h - 20, { align: "right" });
            }

            openInNewTab(doc, `${documentNumber()}.pdf`);
        } finally {
            setLoading(null);
        }
    }

    // ---------------------------------------------------------------- Excel

    async function exportXlsx() {
        setLoading("xlsx");
        try {
            const data = await fetchData();
            if (!data) return;

            // Une ligne par article : c'est ce format que reprend un courtier
            // en douane pour monter sa déclaration.
            const rows: Record<string, string | number>[] = [];
            let lineNo = 0;

            for (const s of data.shipments) {
                const base = {
                    "N° suivi": s.trackingId,
                    Destinataire: s.receiverName,
                    Téléphone: s.receiverPhone || "",
                    Ville: s.receiverCity || "",
                    Adresse: s.receiverAddress || "",
                    "Code postal / BP": s.receiverPoBox || "",
                    Cartons: s.packageCount ?? 1,
                    Nature: describeContent(s.itemKind, s.deviceType),
                    "Poids envoi (kg)": s.weightKg ?? "",
                    Dimensions:
                        formatDimensions(s.lengthCm, s.widthCm, s.heightCm) ?? "",
                };

                if (s.items.length === 0) {
                    lineNo += 1;
                    rows.push({
                        "N°": lineNo,
                        ...base,
                        "Description du contenu":
                            s.itemKind === "DEVICE"
                                ? s.deviceType || "Appareil"
                                : "Effets personnels",
                        Quantité: 1,
                        "Poids article (kg)": "",
                    });
                    continue;
                }

                for (const it of s.items) {
                    lineNo += 1;
                    rows.push({
                        "N°": lineNo,
                        ...base,
                        "Description du contenu": it.label,
                        Quantité: it.quantity,
                        "Poids article (kg)": it.weightKg ?? "",
                    });
                }
            }

            const ws = XLSX.utils.json_to_sheet(rows);

            // Largeurs de colonnes : sans ça, le fichier est illisible à l'ouverture
            ws["!cols"] = [
                { wch: 5 },
                { wch: 13 },
                { wch: 24 },
                { wch: 16 },
                { wch: 14 },
                { wch: 26 },
                { wch: 14 },
                { wch: 9 },
                { wch: 18 },
                { wch: 14 },
                { wch: 16 },
                { wch: 36 },
                { wch: 9 },
                { wch: 16 },
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Liste de colisage");
            XLSX.writeFile(wb, `${documentNumber()}.xlsx`);
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="flex flex-wrap gap-2">
            <button
                onClick={exportPdf}
                disabled={loading !== null}
                title="Liste de colisage mise en page, pour la douane ou le transitaire"
                className="px-3 py-1.5 rounded-md bg-[#8B0000] text-white text-xs font-medium hover:bg-[#6d0000] disabled:opacity-60 transition-colors"
            >
                {loading === "pdf" ? "Génération…" : "📄 Colisage PDF"}
            </button>
            <button
                onClick={exportXlsx}
                disabled={loading !== null}
                title="Même contenu en tableur, une ligne par article"
                className="px-3 py-1.5 rounded-md border border-[#8B0000] text-[#8B0000] text-xs font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
            >
                {loading === "xlsx" ? "Génération…" : "📊 Colisage Excel"}
            </button>
        </div>
    );
}

/** Ouvre le PDF dans un onglet ; retombe sur le téléchargement si bloqué. */
function openInNewTab(doc: jsPDF, filename: string) {
    try {
        doc.setProperties({ title: filename });
    } catch {
        // setProperties absente sur d'anciennes versions
    }
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
        doc.save(filename);
        URL.revokeObjectURL(url);
        return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
