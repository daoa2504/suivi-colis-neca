// src/app/(dashboard)/notify/page.tsx
"use client";

import { useState } from "react";
import EmailPreview from "@/components/EmailPreview";
import type { ConvoyStatus, Direction } from "@/lib/emailTemplates";

export default function NotifyPage() {
    const [showPreview, setShowPreview] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        convoyDate: "",
        template: "EN_ROUTE" as ConvoyStatus,
        customMessage: "",
        direction: "NE_TO_CA" as Direction,
        pickupCity: "Sherbrooke",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsLoading(true);

        try {
            const response = await fetch('/api/convoys/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    convoyDate: formData.convoyDate,
                    template: formData.template,
                    customMessage: formData.customMessage,
                    direction: formData.direction,
                    // ✅ N'envoyer pickupCity que si OUT_FOR_DELIVERY
                    ...(formData.template === "OUT_FOR_DELIVERY" && { pickupCity: formData.pickupCity }),
                }),
            });

            const data = await response.json();

            if (data.ok) {
                alert(`✅ ${data.sent} email(s) envoyé(s) avec succès !`);
            } else {
                alert(`❌ Erreur : ${data.error}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi:', error);
            alert('❌ Erreur lors de l\'envoi des notifications');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Notifier un convoi — Niger → Canada
                    </h1>
                </div>

                {/* Layout à deux colonnes */}
                <div className="flex gap-6">
                    {/* Colonne de gauche - Formulaire */}
                    <div className="flex-1">
                        <div className="bg-white rounded-lg shadow p-6">
                            {/* Onglets Direction */}
                            <div className="flex gap-2 mb-6 border-b">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, direction: "NE_TO_CA" })}
                                    className={`px-4 py-2 font-medium transition-colors ${
                                        formData.direction === "NE_TO_CA"
                                            ? "text-blue-600 border-b-2 border-blue-600"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Niger → Canada
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, direction: "CA_TO_NE" })}
                                    className={`px-4 py-2 font-medium transition-colors ${
                                        formData.direction === "CA_TO_NE"
                                            ? "text-blue-600 border-b-2 border-blue-600"
                                            : "text-gray-600 hover:text-gray-900"
                                    }`}
                                >
                                    Canada → Niger
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Date du convoi */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date du convoi <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.convoyDate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, convoyDate: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Action / Statut */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Action / Statut <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={formData.template}
                                        onChange={(e) =>
                                            setFormData({ ...formData, template: e.target.value as ConvoyStatus })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="EN_ROUTE">En route</option>
                                        <option value="IN_CUSTOMS">À la douane</option>
                                        <option value="OUT_FOR_DELIVERY">Prêt pour récupération</option>
                                    </select>
                                </div>

                                {/* ✅ AFFICHAGE CONDITIONNEL : Point de cueillette (seulement pour NE→CA) */}
                                {formData.template === "OUT_FOR_DELIVERY" && formData.direction === "NE_TO_CA" && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Point de cueillette <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.pickupCity}
                                            onChange={(e) =>
                                                setFormData({ ...formData, pickupCity: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="Sherbrooke">📍 Sherbrooke</option>
                                            <option value="Québec">📍 Québec</option>
                                            <option value="Montréal">📍 Montréal</option>
                                            <option value="Autre">📍 Autre ville</option>
                                        </select>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Cette adresse sera affichée dans tous les emails de ce convoi
                                        </p>
                                    </div>
                                )}

                                {/* Message personnalisé */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Message (optionnel)
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Ex: Détails utiles qui seront ajoutés dans l'email"
                                        value={formData.customMessage}
                                        onChange={(e) =>
                                            setFormData({ ...formData, customMessage: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Boutons d'action */}
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPreview(!showPreview)}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <span>{showPreview ? "👁️" : "👁️‍🗨️"}</span>
                                        <span>{showPreview ? "Masquer aperçu" : "Voir aperçu"}</span>
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? "Envoi en cours..." : "Envoyer les notifications"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Colonne de droite - Aperçu */}
                    {showPreview && (
                        <div className="flex-1">
                            <div className="bg-white rounded-lg shadow p-6 sticky top-6 max-h-[calc(100vh-3rem)] overflow-hidden">
                                <EmailPreview
                                    template={formData.template}
                                    direction={formData.direction}
                                    convoyDate={formData.convoyDate}
                                    customMessage={formData.customMessage}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}