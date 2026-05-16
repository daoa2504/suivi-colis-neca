"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ConvoyShipment = {
    id: number;
    trackingId: string;
    receiverName: string;
    receiverPhone: string | null;
    receiverCity: string | null;
    weightKg: number | null;
    paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
    amountPaid: number | null;
    items: { id: string; label: string; quantity: number; weightKg: number | null }[];
};

const PAYMENT_LABEL = {
    PAID: "Payé",
    PARTIAL: "Partiel",
    UNPAID: "Non payé",
} as const;

function formatDate(d: string | Date) {
    const date = new Date(d);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Ouvre le PDF dans un nouvel onglet pour aperçu (le user peut télécharger via la visionneuse)
function openInNewTab(doc: jsPDF, filename: string) {
    // @ts-expect-error: jsPDF internals
    doc.setProperties?.({ title: filename });
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
        // Bloqueur de popup : fallback en téléchargement
        doc.save(filename);
        URL.revokeObjectURL(url);
        return;
    }
    // Libère l'URL après que la fenêtre l'a chargée
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ExportPdfButtons({
    convoyId,
    convoyDate,
    direction,
}: {
    convoyId: string;
    convoyDate: string;
    direction: "NE_TO_CA" | "CA_TO_NE";
}) {
    const [loading, setLoading] = useState<null | "list" | "detail">(null);

    async function fetchData(): Promise<{
        shipments: ConvoyShipment[];
        convoy: { date: string; direction: string };
    } | null> {
        const res = await fetch(`/api/convoys/${convoyId}/export-data`);
        const data = await res.json();
        if (!data.ok) {
            alert(`❌ ${data.error}`);
            return null;
        }
        return data;
    }

    async function exportListByCity() {
        setLoading("list");
        try {
            const data = await fetchData();
            if (!data) return;
            const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

            const title = `Liste du convoi ${formatDate(convoyDate)} (${
                direction === "CA_TO_NE" ? "CA -> NE" : "NE -> CA"
            })`;
            doc.setFontSize(14);
            doc.text(title, 40, 40);

            // Group by city
            const byCity = new Map<string, ConvoyShipment[]>();
            for (const s of data.shipments) {
                const city = (s.receiverCity || "Sans ville").trim();
                if (!byCity.has(city)) byCity.set(city, []);
                byCity.get(city)!.push(s);
            }

            const sortedCities = Array.from(byCity.keys()).sort();

            let y = 65;
            for (const city of sortedCities) {
                const shipments = byCity.get(city)!;
                doc.setFontSize(12);
                doc.setTextColor(139, 0, 0); // dark red
                doc.text(`${city} (${shipments.length} client${shipments.length > 1 ? "s" : ""})`, 40, y);
                y += 8;

                autoTable(doc, {
                    startY: y,
                    head: [["Tracking", "Nom", "Téléphone", "Nb colis", "Paiement"]],
                    body: shipments.map((s) => {
                        const nbColis = s.items.reduce((acc, it) => acc + it.quantity, 0);
                        const payment =
                            s.paymentStatus === "PARTIAL" && s.amountPaid != null
                                ? `${PAYMENT_LABEL[s.paymentStatus]} (${s.amountPaid})`
                                : PAYMENT_LABEL[s.paymentStatus];
                        return [
                            s.trackingId,
                            s.receiverName,
                            s.receiverPhone ?? "—",
                            String(nbColis || s.items.length || 0),
                            payment,
                        ];
                    }),
                    styles: { fontSize: 9, cellPadding: 4 },
                    headStyles: { fillColor: [139, 0, 0], textColor: 255 },
                    margin: { left: 40, right: 40 },
                });

                y = (doc as any).lastAutoTable.finalY + 25;

                if (y > 750) {
                    doc.addPage();
                    y = 40;
                }
            }

            // Footer with total
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(`Total : ${data.shipments.length} client(s)`, 40, doc.internal.pageSize.height - 30);

            openInNewTab(doc, `convoi_${formatDate(convoyDate)}_${direction}_liste.pdf`);
        } finally {
            setLoading(null);
        }
    }

    async function exportDetailWithItems() {
        setLoading("detail");
        try {
            const data = await fetchData();
            if (!data) return;
            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

            const title = `Détails du convoi ${formatDate(convoyDate)} (${
                direction === "CA_TO_NE" ? "CA -> NE" : "NE -> CA"
            })`;
            doc.setFontSize(14);
            doc.text(title, 40, 40);

            // Group by city
            const byCity = new Map<string, ConvoyShipment[]>();
            for (const s of data.shipments) {
                const city = (s.receiverCity || "Sans ville").trim();
                if (!byCity.has(city)) byCity.set(city, []);
                byCity.get(city)!.push(s);
            }
            const sortedCities = Array.from(byCity.keys()).sort();

            // Max items across the entire convoy → fixe le nombre de colonnes "Colis N"
            const maxItems = data.shipments.reduce((m, s) => Math.max(m, s.items.length), 0);
            const itemHeaders = Array.from({ length: maxItems }, (_, i) => `Colis ${i + 1}`);

            const head = [
                "Tracking",
                "Nom",
                "Téléphone",
                "Nb colis",
                "Poids (kg)",
                "Paiement",
                ...itemHeaders,
            ];

            let grandTotal = 0;
            let y = 65;

            for (const city of sortedCities) {
                const shipments = byCity.get(city)!;

                // En-tête de section "Ville (N clients)"
                doc.setFontSize(12);
                doc.setTextColor(139, 0, 0);
                doc.text(
                    `${city} (${shipments.length} client${shipments.length > 1 ? "s" : ""})`,
                    30,
                    y
                );
                y += 8;
                doc.setTextColor(0);

                let cityWeight = 0;
                const body: string[][] = [];

                for (const s of shipments) {
                    const totalQty = s.items.reduce((acc, it) => acc + it.quantity, 0);
                    // Poids saisi par l'agent au niveau du colis, pas la somme des items
                    const totalWeight = s.weightKg ?? 0;
                    cityWeight += totalWeight;

                    const payment =
                        s.paymentStatus === "PARTIAL" && s.amountPaid != null
                            ? `${PAYMENT_LABEL[s.paymentStatus]} (${s.amountPaid})`
                            : PAYMENT_LABEL[s.paymentStatus];

                    const row = [
                        s.trackingId,
                        s.receiverName,
                        s.receiverPhone ?? "—",
                        String(totalQty || s.items.length || 0),
                        totalWeight.toFixed(2),
                        payment,
                        ...s.items.map(
                            (it) =>
                                `${it.quantity > 1 ? `${it.quantity}x ` : ""}${it.label}${
                                    it.weightKg != null ? ` (${it.weightKg}kg)` : ""
                                }`
                        ),
                    ];
                    while (row.length < head.length) row.push("");
                    body.push(row);
                }

                grandTotal += cityWeight;

                autoTable(doc, {
                    startY: y,
                    head: [head],
                    body,
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [139, 0, 0], textColor: 255 },
                    margin: { left: 30, right: 30 },
                    columnStyles: {
                        0: { cellWidth: 60 },
                        1: { cellWidth: 90 },
                        2: { cellWidth: 75 },
                        3: { cellWidth: 40 },
                        4: { cellWidth: 50 },
                        5: { cellWidth: 65 },
                    },
                });

                const after = (doc as any).lastAutoTable.finalY ?? y;

                // Sous-total par ville
                doc.setFontSize(9);
                doc.setTextColor(80);
                doc.text(
                    `Sous-total ${city} : ${cityWeight.toFixed(2)} kg`,
                    30,
                    after + 14
                );
                doc.setTextColor(0);

                y = after + 30;

                if (y > 520) {
                    doc.addPage();
                    y = 40;
                }
            }

            doc.setFontSize(11);
            doc.text(
                `Poids total du convoi : ${grandTotal.toFixed(2)} kg | ${data.shipments.length} client(s)`,
                30,
                y + 10
            );

            openInNewTab(doc, `convoi_${formatDate(convoyDate)}_${direction}_details.pdf`);
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={exportListByCity}
                disabled={!!loading}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                title="Liste par ville (tracking, nom, tél, nb colis, paiement)"
            >
                {loading === "list" ? "…" : "📋 Liste"}
            </button>
            <button
                onClick={exportDetailWithItems}
                disabled={!!loading}
                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                title="Détails complets avec libellés de colis et poids total"
            >
                {loading === "detail" ? "…" : "📦 Détails"}
            </button>
        </div>
    );
}
