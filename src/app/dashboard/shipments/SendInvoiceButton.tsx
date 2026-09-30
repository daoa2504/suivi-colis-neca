"use client";

// src/app/dashboard/shipments/SendInvoiceButton.tsx
//
// Envoie au client la facture à jour d'un colis. La facture est régénérée
// depuis l'état courant avant l'envoi : c'est ce qui permet de transmettre un
// document juste quand un supplément de ville a été configuré après coup.

import { useState } from "react";

export default function SendInvoiceButton({
    shipmentId,
    trackingId,
    hasEmail,
}: {
    shipmentId: number;
    trackingId: string;
    hasEmail: boolean;
}) {
    const [busy, setBusy] = useState(false);

    async function send() {
        if (
            !confirm(
                `Régénérer la facture de ${trackingId} depuis son état actuel et l'envoyer au client ?`
            )
        ) {
            return;
        }

        setBusy(true);
        try {
            const res = await fetch(`/api/shipments/${shipmentId}/invoice/send`, {
                method: "POST",
            });
            const data = await res.json();
            if (!data.ok) {
                alert(`❌ ${typeof data.error === "string" ? data.error : "Échec de l'envoi"}`);
                return;
            }
            alert(`✅ Facture ${data.invoiceNumber} envoyée à ${data.to}`);
        } catch (e: any) {
            alert(`❌ ${e.message}`);
        } finally {
            setBusy(false);
        }
    }

    if (!hasEmail) return null;

    return (
        <button
            type="button"
            onClick={send}
            disabled={busy}
            title="Régénérer et envoyer la facture au client"
            className="text-lg hover:scale-110 transition-transform disabled:opacity-40"
        >
            {busy ? "⏳" : "📤"}
        </button>
    );
}
