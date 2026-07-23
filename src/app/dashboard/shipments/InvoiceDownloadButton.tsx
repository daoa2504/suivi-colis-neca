"use client";

// src/app/dashboard/shipments/InvoiceDownloadButton.tsx
//
// Bouton de téléchargement de facture PDF pour un colis.
//   - AGENT_NE : version client uniquement
//   - AGENT_CA / ADMIN : version client OU version comptable

import { useState } from "react";

interface Props {
    invoiceId: string;
    invoiceNumber: string;
    canAccessAccounting: boolean;
}

export default function InvoiceDownloadButton({
    invoiceId,
    invoiceNumber,
    canAccessAccounting,
}: Props) {
    const [open, setOpen] = useState(false);

    function download(variant: "client" | "accounting") {
        const url = `/api/invoices/${invoiceId}/pdf?variant=${variant}`;
        window.open(url, "_blank");
        setOpen(false);
    }

    if (!canAccessAccounting) {
        // Rôle NE : bouton direct (une seule variante)
        return (
            <button
                type="button"
                onClick={() => download("client")}
                title={`Télécharger facture ${invoiceNumber}`}
                className="text-lg hover:scale-110 transition-transform"
            >
                🧾
            </button>
        );
    }

    // Rôle CA / ADMIN : menu déroulant à 2 options
    return (
        <div className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen((s) => !s)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                title={`Facture ${invoiceNumber}`}
                className="text-lg hover:scale-110 transition-transform"
            >
                🧾
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg text-sm">
                    <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500">
                        {invoiceNumber}
                    </div>
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            download("client");
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                        📄 Version client
                        <div className="text-xs text-gray-500">Taxes incluses, sans ventilation</div>
                    </button>
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            download("accounting");
                        }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-50 border-t border-gray-100"
                    >
                        📊 Version comptable
                        <div className="text-xs text-gray-500">Ventilation HT + TPS + TVQ</div>
                    </button>
                </div>
            )}
        </div>
    );
}
