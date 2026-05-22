"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

type Props = {
    direction: string;
    convoyId?: string;
    city?: string;
    q?: string;
};

const STATUS_FR: Record<string, string> = {
    CREATED: "Créé",
    RECEIVED_IN_NIGER: "Reçu au Niger",
    RECEIVED_IN_CANADA: "Reçu au Canada",
    IN_TRANSIT: "En route",
    IN_TRANSIT_STOP: "En escale",
    IN_CUSTOMS: "À la douane",
    READY_FOR_PICKUP: "Prêt pour récupération",
    DELIVERED: "Récupéré",
};

const PAYMENT_FR: Record<string, string> = {
    PAID: "Payé",
    PARTIAL: "Partiellement payé",
    UNPAID: "Non payé",
};

function fmtDate(d: string | null) {
    if (!d) return "";
    return new Date(d).toISOString().slice(0, 10);
}

export default function ExportShipmentsButton({ direction, convoyId, city, q }: Props) {
    const [loading, setLoading] = useState(false);

    async function onExport() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("direction", direction);
            if (convoyId) params.set("convoyId", convoyId);
            if (city) params.set("city", city);
            if (q) params.set("q", q);

            const res = await fetch(`/api/shipments/export?${params.toString()}`);
            const data = await res.json();
            if (!data.ok) {
                alert(`❌ ${data.error || "Échec de l'export"}`);
                return;
            }

            const rows = (data.shipments as any[]).map((s) => ({
                Tracking: s.trackingId,
                Convoi: fmtDate(s.convoyDate),
                Direction: direction === "CA_TO_NE" ? "CA → NE" : "NE → CA",
                Nom: s.receiverName,
                Email: s.receiverEmail,
                Téléphone: s.receiverPhone || "",
                Ville: s.receiverCity || "",
                Adresse: s.receiverAddress || "",
                "Boîte postale / CP": s.receiverPoBox || "",
                "Récupérateur (Niger)":
                    [s.pickupFirstName, s.pickupLastName].filter(Boolean).join(" ") || "",
                "Quartier (Niger)": s.pickupQuartier || "",
                "Tél récupérateur": s.pickupPhone || "",
                Poids: s.weightKg ?? "",
                "Nb colis": s.itemsCount ?? 0,
                Statut: STATUS_FR[s.status] ?? s.status,
                Paiement: PAYMENT_FR[s.paymentStatus] ?? s.paymentStatus,
                "Montant payé (somme)": s.totalPaid ?? "",
                Notes: s.notes || "",
                "Créé le": fmtDate(s.createdAt),
                "Mis à jour": fmtDate(s.updatedAt),
                "Disponible le": fmtDate(s.readyAt),
                "Récupéré le": fmtDate(s.deliveredAt),
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            // Auto-width approximatif
            const cols = Object.keys(rows[0] ?? {}).map((k) => ({ wch: Math.max(k.length, 12) }));
            (ws as any)["!cols"] = cols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Colis");

            const today = new Date().toISOString().slice(0, 10);
            const filename = `colis_${direction}_${today}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (e: any) {
            alert(`❌ ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={onExport}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-600 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            title="Exporter les colis filtrés en Excel"
        >
            {loading ? "Export…" : "📥 Exporter Excel"}
        </button>
    );
}
