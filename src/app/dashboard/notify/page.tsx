// src/app/(dashboard)/notify/page.tsx
"use client";

import {
    convoyProgress,
    templateState,
    STAGES,
    STAGE_LABEL,
    TEMPLATE_STAGE,
} from "@/lib/convoyStage";
import { useEffect, useState } from "react";
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

    // Convois disponibles pour la direction sélectionnée
    const [availableConvoys, setAvailableConvoys] = useState<
        { id: string; date: string; totalShipments: number; statusCounts: Record<string, number> }[]
    >([]);
    const [convoysLoading, setConvoysLoading] = useState(false);

    // Où en est le convoi choisi, déduit du statut de ses colis — c'est ce que
    // la notification fait avancer, donc la seule source fiable.
    const selectedConvoy = availableConvoys.find((c) => c.date === formData.convoyDate);
    const progress = selectedConvoy ? convoyProgress(selectedConvoy.statusCounts) : null;
    const selectedState = progress ? templateState(progress, formData.template) : null;

    useEffect(() => {
        setConvoysLoading(true);
        setFormData((prev) => ({ ...prev, convoyDate: "" }));
        (async () => {
            try {
                const res = await fetch(
                    `/api/convoys/list?direction=${formData.direction}&upcomingOnly=true&pastDays=30`
                );
                const data = await res.json();
                if (data.ok) {
                    const list = (data.convoys as any[])
                        .map((c) => ({
                            id: c.id,
                            date: new Date(c.date).toISOString().slice(0, 10),
                            totalShipments: c.totalShipments ?? 0,
                            statusCounts: c.statusCounts ?? {},
                        }))
                        .sort((a, b) => (a.date < b.date ? 1 : -1));
                    setAvailableConvoys(list);
                } else {
                    setAvailableConvoys([]);
                }
            } catch {
                setAvailableConvoys([]);
            } finally {
                setConvoysLoading(false);
            }
        })();
    }, [formData.direction]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Garde-fou : le cas que l'on cherche à éviter est le double envoi de la
        // même étape, qui fait partir un second courriel aux mêmes clients.
        if (selectedState?.state === "done") {
            const ok = window.confirm(
                `« ${STAGE_LABEL[TEMPLATE_STAGE[formData.template]]} » a déjà été notifié pour tous les colis de ce convoi.\n\n` +
                    `Renvoyer maintenant enverra un second courriel aux mêmes clients. Continuer ?`
            );
            if (!ok) return;
        }

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
                    ...(formData.template === "OUT_FOR_DELIVERY" && formData.direction === "NE_TO_CA" && { pickupCity: formData.pickupCity }),
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

    // ✅ TITRE DYNAMIQUE SELON LA DIRECTION
    const pageTitle = formData.direction === "NE_TO_CA"
        ? "Notifier un convoi — Niger → Canada"
        : "Notifier un convoi — Canada → Niger";

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* ✅ EN-TÊTE DYNAMIQUE AVEC DRAPEAUX */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        {pageTitle}
                    </h1>
                </div>

                {/* Layout à deux colonnes */}
                <div className="flex gap-6">
                    {/* Colonne de gauche - Formulaire */}
                    <div className="flex-1">
                        <div className="bg-white rounded-lg shadow p-6">
                            {/* ✅ ONGLETS DIRECTION AVEC DRAPEAUX */}
                            {/* ✅ ONGLETS DIRECTION AVEC DRAPEAUX SVG */}
                            <div className="flex gap-2 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, direction: "NE_TO_CA" })}
                                    className={`flex-1 px-6 py-3 font-medium rounded-lg transition-all ${
                                        formData.direction === "NE_TO_CA"
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
        <span className="flex items-center justify-center gap-2">
            <img
                src="/flags/ne.svg"
                alt="Niger"
                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
            />
            <span>Niger → Canada</span>
            <img
                src="/flags/ca.svg"
                alt="Canada"
                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
            />
        </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, direction: "CA_TO_NE" })}
                                    className={`flex-1 px-6 py-3 font-medium rounded-lg transition-all ${
                                        formData.direction === "CA_TO_NE"
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
        <span className="flex items-center justify-center gap-2">
            <img
                src="/flags/ca.svg"
                alt="Canada"
                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
            />
            <span>Canada → Niger</span>
            <img
                src="/flags/ne.svg"
                alt="Niger"
                className="w-6 h-4 object-cover rounded-sm border border-gray-200"
            />
        </span>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Convoi à notifier */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Convoi à notifier <span className="text-red-500">*</span>
                                    </label>
                                    {convoysLoading ? (
                                        <p className="text-sm text-gray-500 italic">Chargement des convois…</p>
                                    ) : availableConvoys.length === 0 ? (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                            ⚠️ Aucun convoi disponible pour cette direction. Demandez à l'administrateur d'en créer un.
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={formData.convoyDate}
                                            onChange={(e) =>
                                                setFormData({ ...formData, convoyDate: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">-- Sélectionner un convoi --</option>
                                            {availableConvoys.map((c) => {
                                                const isPast = c.date < new Date().toISOString().slice(0, 10);
                                                const dirLabel = formData.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA";
                                                return (
                                                    <option key={c.id} value={c.date}>
                                                        {c.date} ({dirLabel}){isPast ? " — passé" : ""}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    )}
                                </div>

                                {/* État du convoi sélectionné */}
                                {progress && (
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                            État actuel du convoi
                                        </p>
                                        <ol className="flex flex-wrap items-center gap-1.5">
                                            {STAGES.filter((s) => s !== "DELIVERED").map((stage, i) => {
                                                const count = progress.counts[stage];
                                                const idx = STAGES.indexOf(stage);
                                                const lowestIdx = STAGES.indexOf(progress.lowest);
                                                const passed = idx < lowestIdx;
                                                const current = count > 0;
                                                return (
                                                    <li key={stage} className="flex items-center gap-1.5">
                                                        {i > 0 && <span className="text-gray-300">›</span>}
                                                        <span
                                                            className={`px-2 py-1 rounded text-xs font-medium ${
                                                                current
                                                                    ? "bg-blue-600 text-white"
                                                                    : passed
                                                                      ? "bg-blue-100 text-blue-700"
                                                                      : "bg-white text-gray-400 border border-gray-200"
                                                            }`}
                                                        >
                                                            {STAGE_LABEL[stage]}
                                                            {count > 0 && ` · ${count}`}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                        {progress.mixed && (
                                            <p className="text-xs text-amber-700 mt-2">
                                                Les colis ne sont pas tous à la même étape — typique après un
                                                envoi filtré par ville.
                                            </p>
                                        )}
                                    </div>
                                )}

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
                                        {(
                                            [
                                                ["EN_ROUTE", "En route"],
                                                ["IN_CUSTOMS", "À la douane"],
                                                ["OUT_FOR_DELIVERY", "Prêt pour récupération"],
                                            ] as const
                                        ).map(([value, label]) => {
                                            const st = progress ? templateState(progress, value) : null;
                                            const suffix = !st
                                                ? ""
                                                : st.state === "done"
                                                  ? " — déjà envoyé"
                                                  : st.state === "partial"
                                                    ? ` — déjà envoyé pour ${st.reached} colis`
                                                    : st.state === "next"
                                                      ? " — étape suivante"
                                                      : "";
                                            return (
                                                <option key={value} value={value}>
                                                    {label}
                                                    {suffix}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {selectedState?.state === "done" && (
                                        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                                            Cette étape a déjà été notifiée pour tous les colis du convoi.
                                            Renvoyer enverra un second courriel aux mêmes clients.
                                        </p>
                                    )}
                                    {selectedState?.state === "ahead" && (
                                        <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                                            Cette étape en saute une : le convoi est actuellement «{" "}
                                            {STAGE_LABEL[progress!.lowest]} ».
                                        </p>
                                    )}
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
                                    pickupCity={formData.pickupCity}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}