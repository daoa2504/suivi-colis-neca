// src/components/EmailPreview.tsx
"use client";

import { getEmailContent, type ConvoyStatus, type Direction } from "@/lib/emailTemplates";

interface EmailPreviewProps {
    template: ConvoyStatus;
    direction: Direction;
    convoyDate: string;
    customMessage?: string;
}

export default function EmailPreview({
                                         template,
                                         direction,
                                         convoyDate,
                                         customMessage,
                                     }: EmailPreviewProps) {
    // Données d'exemple pour l'aperçu
    const sampleName = "Jean Dupont";
    const sampleTrackingIds = ["NMP-2024-001", "NMP-2024-002"];

    // Formater la date
    let dateStr = "";
    try {
        if (convoyDate) {
            const date = new Date(convoyDate);
            dateStr = date.toLocaleDateString("fr-CA", { timeZone: "UTC" });
        }
    } catch (e) {
        dateStr = "JJ/MM/AAAA";
    }

    // Générer le contenu
    const { subject, html } = getEmailContent(
        template,
        direction,
        sampleName,
        sampleTrackingIds,
        dateStr,
        customMessage
    );

    return (
        <div className="h-full flex flex-col">
            {/* En-tête de l'aperçu */}
            <div className="mb-4">
                <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <span>📧</span>
                    <span>Aperçu de l&apos;email</span>
                </h2>

                {/* Métadonnées de l'email */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex">
                        <span className="font-medium text-gray-700 w-20">De :</span>
                        <span className="text-gray-600">noreply@nimaplex.com</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-700 w-20">À :</span>
                        <span className="text-gray-600">client@exemple.com</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-700 w-20">Sujet :</span>
                        <span className="text-gray-900 font-medium">{subject}</span>
                    </div>
                </div>
            </div>

            {/* Conteneur de l'email avec scroll */}
            <div className="flex-1 bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                <div className="h-full overflow-y-auto p-6">
                    {/* Rendu HTML de l'email */}
                    <div
                        className="email-preview"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </div>
            </div>

            {/* Note d'avertissement */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                    <strong>Note :</strong> Ceci est un aperçu avec des données d&apos;exemple.
                    L&apos;email réel sera personnalisé pour chaque destinataire.
                </p>
            </div>
        </div>
    );
}