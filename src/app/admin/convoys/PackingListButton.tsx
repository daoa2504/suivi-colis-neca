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
import { LOGO_BANNER, LOGO_MARK } from "@/lib/branding";

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

function routeEnds(direction: string): [string, string] {
    return direction === "CA_TO_NE" ? ["Canada", "Niger"] : ["Niger", "Canada"];
}

/**
 * Trajet avec une vraie flèche, tracée en vectoriel.
 * Les polices intégrées de jsPDF utilisent WinAnsi : « → » n'y existe pas et
 * sortait en « !' ». Un trait et une pointe triangulaire règlent la question
 * sans embarquer de police Unicode.
 */
function drawRoute(
    doc: jsPDF,
    x: number,
    baseline: number,
    direction: string,
    fontSize: number,
    color: [number, number, number]
) {
    const [from, to] = routeEnds(direction);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.text(from, x, baseline);

    const fromW = doc.getTextWidth(from);
    const gap = fontSize * 0.16;
    const shaft = fontSize * 0.5;
    const head = fontSize * 0.18;
    const ax = x + fromW + gap;
    // Hauteur optique : à mi-hauteur des capitales, soit ~0,31 em au-dessus de
    // la ligne de base. Ce document est en points, où 1 em = fontSize ; la
    // facture est en millimètres et le même facteur y vaudrait trois fois
    // moins. D'où une flèche qui traînait près de la ligne de base ici.
    const ay = baseline - fontSize * 0.31;

    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(fontSize * 0.04);
    doc.line(ax, ay, ax + shaft, ay);
    doc.triangle(
        ax + shaft + head * 1.2, ay,
        ax + shaft - head * 0.2, ay - head,
        ax + shaft - head * 0.2, ay + head,
        "F"
    );

    doc.text(to, ax + shaft + head * 1.2 + gap, baseline);
}

/**
 * Charge le logo en data URI pour jsPDF, qui ne sait pas suivre une URL.
 * Le symbole seul : la raison sociale est écrite en toutes lettres à côté,
 * le verrouillage complet la répéterait. Si aucun fichier n'est servi, le
 * document s'imprime avec un en-tête typographique plutôt que d'échouer.
 */
async function loadLogo(): Promise<{ uri: string; full: boolean } | null> {
    for (const [path, full] of [
        [LOGO_BANNER, true],
        [LOGO_MARK, false],
    ] as const) {
        try {
            const res = await fetch(path);
            if (!res.ok) continue;
            const blob = await res.blob();
            const uri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return { uri, full };
        } catch {
            // fichier absent ou illisible : on tente le suivant
        }
    }
    return null;
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
    const [loading, setLoading] = useState<null | "pdf" | "xlsx" | "load">(null);
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<PackingData | null>(null);

    // Sélection : on retient ce qui est EXCLU, pour que tout soit coché par
    // défaut et qu'un envoi ajouté entre-temps le soit aussi.
    const [excludedShipments, setExcludedShipments] = useState<Set<number>>(new Set());
    const [excludedItems, setExcludedItems] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    async function fetchData(): Promise<PackingData | null> {
        const res = await fetch(`/api/convoys/${convoyId}/export-data`);
        const payload = await res.json();
        if (!payload.ok) {
            alert(`❌ ${payload.error}`);
            return null;
        }
        return payload;
    }

    async function openPicker() {
        setOpen(true);
        if (data) return;
        setLoading("load");
        try {
            const fetched = await fetchData();
            if (fetched) setData(fetched);
            else setOpen(false);
        } finally {
            setLoading(null);
        }
    }

    /**
     * Applique la sélection : envois décochés retirés, articles décochés
     * retirés, et poids de chaque envoi recalculé sur les seuls articles
     * conservés — sinon le document annoncerait le poids d'un contenu qu'il
     * ne décrit plus.
     */
    function applySelection(source: PackingData): PackingData {
        const shipments = source.shipments
            .filter((s) => !excludedShipments.has(s.id))
            .map((s) => {
                const items = s.items.filter((it) => !excludedItems.has(it.id));
                if (items.length === s.items.length) return s;

                const weighed = items.filter((it) => it.weightKg != null);
                return {
                    ...s,
                    items,
                    weightKg: weighed.length
                        ? weighed.reduce((acc, it) => acc + (it.weightKg ?? 0) * it.quantity, 0)
                        : null,
                };
            });

        return { ...source, shipments };
    }

    function toggleShipment(id: number) {
        setExcludedShipments((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleItem(id: string) {
        setExcludedItems((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleExpand(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function setAll(exclude: boolean) {
        if (!data) return;
        setExcludedShipments(exclude ? new Set(data.shipments.map((s) => s.id)) : new Set());
        setExcludedItems(new Set());
    }

    /** Numéro de document, stable pour un convoi donné : LC-AAAAMMJJ-SENS */
    function documentNumber() {
        return `LC-${fmtDate(convoyDate).replace(/-/g, "")}-${
            direction === "CA_TO_NE" ? "CANE" : "NECA"
        }`;
    }

    // ------------------------------------------------------------------ PDF

    async function exportPdf() {
        if (!data) return;
        setLoading("pdf");
        try {
            const selected = applySelection(data);
            if (selected.shipments.length === 0) {
                alert("Aucun envoi sélectionné.");
                return;
            }

            const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
            const pageW = doc.internal.pageSize.getWidth();
            const company = selected.company;

            const totalPackages = selected.shipments.reduce(
                (acc, s) => acc + (s.packageCount ?? 1),
                0
            );
            const totalWeight = selected.shipments.reduce((acc, s) => acc + (s.weightKg ?? 0), 0);

            // ---- En-tête : logo + identité de l'entreprise ----
            let y = MARGIN;

            const logo = await loadLogo();
            // La bande porte déjà la raison sociale : on ne la réécrit pas.
            const isBanner = logo?.full === true;
            const bannerW = 190;
            // Ratio lu dans l'image, pas figé : régénérer le logo ne doit pas
            // l'étirer silencieusement.
            let bannerH = bannerW * 0.38;
            if (logo && isBanner) {
                try {
                    const p = doc.getImageProperties(logo.uri);
                    if (p?.width && p?.height) bannerH = (bannerW * p.height) / p.width;
                } catch {
                    // getImageProperties peut échouer : on garde l'approximation
                }
            }
            let textX = MARGIN;
            let headerBottom = y + 8;

            if (logo) {
                try {
                    if (isBanner) {
                        doc.addImage(logo.uri, "PNG", MARGIN, y - 6, bannerW, bannerH, undefined, "FAST");
                        headerBottom = y - 6 + bannerH;
                    } else {
                        doc.addImage(logo.uri, "PNG", MARGIN, y - 6, 54, 54, undefined, "FAST");
                        textX = MARGIN + 66;
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(22);
                        doc.setTextColor(...BRAND);
                        doc.text(company?.displayName || "NIMAPLEX", textX, y + 8);
                        headerBottom = y + 48;
                    }
                } catch {
                    // addImage peut échouer sur un format inattendu : on garde
                    // l'en-tête typographique seul plutôt que de perdre le document
                }
            }

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

            let ly = headerBottom + 10;
            const identityX = textX;
            for (const line of identity) {
                doc.text(line, identityX, ly);
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

            y = Math.max(ly, headerBottom) + 6;

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
                        // Laissé vide : le trajet est tracé dans didDrawCell,
                        // avec une vraie flèche.
                        "",
                        "Poids brut total\nTotal gross weight",
                        `${totalWeight.toFixed(2)} kg`,
                    ],
                    [
                        "N° AWB / LTA\nAir waybill",
                        "", // rempli à la main sur le document imprimé
                        "Nombre d'envois\nConsignments",
                        String(selected.shipments.length),
                    ],
                ],
                margin: { left: MARGIN, right: MARGIN },
                didDrawCell: (hook: any) => {
                    // Cellule « Trajet » : deuxième ligne, deuxième colonne
                    if (hook.section !== "body") return;
                    if (hook.row.index !== 1 || hook.column.index !== 1) return;

                    const fs = hook.cell.styles.fontSize ?? 8;
                    const padLeft = hook.cell.styles.cellPadding?.left ?? 5;
                    const baseline = hook.cell.y + hook.cell.height / 2 + fs * 0.35;
                    drawRoute(doc, hook.cell.x + padLeft, baseline, direction, fs, INK);
                },
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
                        `Envoi groupé — ${selected.shipments.length} destinataires distincts.\nConsolidated shipment — see detail below.`,
                    ],
                ],
                columnStyles: { 0: { cellWidth: (pageW - MARGIN * 2) / 2 } },
                margin: { left: MARGIN, right: MARGIN },
            });
            y = (doc as any).lastAutoTable.finalY + 16;

            // ---- Tableau principal, groupé par ville ----
            const byCity = new Map<string, Shipment[]>();
            for (const s of selected.shipments) {
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
                        contentLines(s),
                        String(totalQty(s)),
                        s.weightKg != null ? s.weightKg.toFixed(2) : "—",
                    ];
                });

                body.push([
                    "",
                    "",
                    `Sous-total ${city}`,
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
                        0: { cellWidth: 24, halign: "right" },
                        1: { cellWidth: 70 },
                        2: { cellWidth: 110 },
                        3: { cellWidth: "auto" },
                        4: { cellWidth: 30, halign: "center" },
                        5: { cellWidth: 52, halign: "right" },
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
                        `${selected.shipments.length} envois`,
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
        if (!data) return;
        setLoading("xlsx");
        try {
            const selected = applySelection(data);
            if (selected.shipments.length === 0) {
                alert("Aucun envoi sélectionné.");
                return;
            }

            // Une ligne par article : c'est ce format que reprend un courtier
            // en douane pour monter sa déclaration.
            const rows: Record<string, string | number>[] = [];
            let lineNo = 0;

            for (const s of selected.shipments) {
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

    // Compteurs de la sélection courante, pour que l'écran annonce ce qui
    // partira réellement dans le document.
    const preview = data ? applySelection(data) : null;
    const keptPackages = preview?.shipments.reduce((a, s) => a + (s.packageCount ?? 1), 0) ?? 0;
    const keptWeight = preview?.shipments.reduce((a, s) => a + (s.weightKg ?? 0), 0) ?? 0;

    const byCity = new Map<string, Shipment[]>();
    for (const s of data?.shipments ?? []) {
        const city = (s.receiverCity || "Sans ville").trim();
        if (!byCity.has(city)) byCity.set(city, []);
        byCity.get(city)!.push(s);
    }
    const cities = Array.from(byCity.keys()).sort();

    return (
        <>
            <button
                onClick={openPicker}
                className="px-3 py-1.5 rounded-md bg-[#8B0000] text-white text-xs font-medium hover:bg-[#6d0000] transition-colors"
                title="Choisir les envois, puis générer la liste de colisage"
            >
                📄 Liste de colisage
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl my-8">
                        {/* En-tête */}
                        <div className="flex items-start justify-between gap-4 p-4 border-b">
                            <div>
                                <h2 className="font-bold text-lg">Liste de colisage</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Convoi du {fmtDate(convoyDate)} ·{" "}
                                    {direction === "CA_TO_NE" ? "Canada → Niger" : "Niger → Canada"}
                                </p>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
                                aria-label="Fermer"
                            >
                                ×
                            </button>
                        </div>

                        {/* Corps */}
                        <div className="p-4 max-h-[55vh] overflow-y-auto">
                            {loading === "load" || !data ? (
                                <p className="text-sm text-neutral-400 py-8 text-center">
                                    Chargement des envois…
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 mb-3 text-xs">
                                        <button
                                            onClick={() => setAll(false)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Tout cocher
                                        </button>
                                        <span className="text-neutral-300">|</span>
                                        <button
                                            onClick={() => setAll(true)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Tout décocher
                                        </button>
                                    </div>

                                    {cities.map((city) => (
                                        <div key={city} className="mb-4">
                                            <h3 className="text-xs font-bold text-[#8B0000] uppercase tracking-wide mb-1.5">
                                                {city}
                                            </h3>
                                            <ul className="space-y-1">
                                                {byCity.get(city)!.map((s) => {
                                                    const off = excludedShipments.has(s.id);
                                                    const isOpen = expanded.has(s.id);
                                                    return (
                                                        <li
                                                            key={s.id}
                                                            className={`rounded border px-2 py-1.5 text-xs ${
                                                                off
                                                                    ? "border-neutral-200 bg-neutral-50 opacity-60"
                                                                    : "border-neutral-200 bg-white"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!off}
                                                                    onChange={() => toggleShipment(s.id)}
                                                                    className="shrink-0"
                                                                />
                                                                <span className="font-mono text-[11px]">
                                                                    {s.trackingId}
                                                                </span>
                                                                <span className="flex-1 truncate">
                                                                    {s.receiverName}
                                                                </span>
                                                                <span className="text-neutral-500 shrink-0">
                                                                    {s.packageCount ?? 1} ct ·{" "}
                                                                    {s.weightKg != null
                                                                        ? `${s.weightKg} kg`
                                                                        : "—"}
                                                                </span>
                                                                {s.items.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpand(s.id)}
                                                                        className="text-blue-600 hover:underline shrink-0"
                                                                    >
                                                                        {isOpen ? "▾" : "▸"} {s.items.length} art.
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {isOpen && (
                                                                <ul className="mt-1.5 ml-6 space-y-1 border-l border-neutral-200 pl-2">
                                                                    {s.items.map((it) => (
                                                                        <li
                                                                            key={it.id}
                                                                            className="flex items-center gap-2 text-[11px]"
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!excludedItems.has(it.id)}
                                                                                onChange={() => toggleItem(it.id)}
                                                                                disabled={off}
                                                                            />
                                                                            <span className="flex-1 truncate">
                                                                                {it.quantity > 1
                                                                                    ? `${it.quantity} × `
                                                                                    : ""}
                                                                                {it.label}
                                                                            </span>
                                                                            <span className="text-neutral-400">
                                                                                {it.weightKg != null
                                                                                    ? `${it.weightKg} kg`
                                                                                    : "—"}
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Pied : récapitulatif de ce qui sera imprimé + actions */}
                        <div className="border-t p-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-neutral-600">
                                <strong>{preview?.shipments.length ?? 0}</strong> envoi
                                {(preview?.shipments.length ?? 0) > 1 ? "s" : ""} ·{" "}
                                <strong>{keptPackages}</strong> carton
                                {keptPackages > 1 ? "s" : ""} ·{" "}
                                <strong>{keptWeight.toFixed(2)} kg</strong>
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={exportXlsx}
                                    disabled={loading !== null || !preview?.shipments.length}
                                    className="px-3 py-1.5 rounded-md border border-[#8B0000] text-[#8B0000] text-xs font-medium hover:bg-red-50 disabled:opacity-40 transition-colors"
                                >
                                    {loading === "xlsx" ? "Génération…" : "📊 Excel"}
                                </button>
                                <button
                                    onClick={exportPdf}
                                    disabled={loading !== null || !preview?.shipments.length}
                                    className="px-3 py-1.5 rounded-md bg-[#8B0000] text-white text-xs font-medium hover:bg-[#6d0000] disabled:opacity-40 transition-colors"
                                >
                                    {loading === "pdf" ? "Génération…" : "📄 Générer le PDF"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
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
