// src/components/SendCustomEmailModal.tsx
"use client";

import { useState, useEffect } from "react";

type Direction = "" | "NE_TO_CA" | "CA_TO_NE";

type Client = {
    id: string;
    receiverName: string;
    receiverEmail: string;
    trackingId: string;
    receiverCity?: string | null;
    convoy?: { id: string; date: string; direction: string } | null;
};

type Convoy = { id: string; date: string; direction: "NE_TO_CA" | "CA_TO_NE" };

type SendCustomEmailModalProps = {
    isOpen: boolean;
    onClose: () => void;
    defaultDirection?: Direction;
};

export default function SendCustomEmailModal({
    isOpen,
    onClose,
    defaultDirection = "",
}: SendCustomEmailModalProps) {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Pop-up de résultat (après envoi)
    const [resultPopup, setResultPopup] = useState<null | {
        successCount: number;
        failCount: number;
        failedSamples?: { email: string; error: string }[];
    }>(null);

    // Filtres
    const [direction, setDirection] = useState<Direction>(defaultDirection);
    const [convoyId, setConvoyId] = useState<string>("");
    const [convoys, setConvoys] = useState<Convoy[]>([]);

    // Charger la liste des clients quand le modal s'ouvre OU quand les filtres changent
    useEffect(() => {
        if (isOpen) {
            loadClients();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, direction, convoyId]);

    // Charger les convois disponibles (1 fois)
    useEffect(() => {
        if (isOpen && convoys.length === 0) {
            fetch("/api/convoys/list?upcomingOnly=true&pastDays=90")
                .then((r) => r.json())
                .then((d) => {
                    if (d.ok) {
                        setConvoys(
                            (d.convoys as any[]).map((c) => ({
                                id: c.id,
                                date: new Date(c.date).toISOString().slice(0, 10),
                                direction: c.direction,
                            }))
                        );
                    }
                })
                .catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadClients = async () => {
        setLoadingClients(true);
        setError("");
        // Reset sélection quand on change de filtre pour éviter de garder
        // des sélections invisibles
        setSelectedClients([]);
        try {
            const params = new URLSearchParams();
            if (convoyId) params.set("convoyId", convoyId);
            else if (direction) params.set("direction", direction);
            const url = `/api/clients/list${params.toString() ? "?" + params.toString() : ""}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.ok) {
                setClients(data.clients || []);
            } else {
                setError("Erreur lors du chargement des clients");
            }
        } catch (err) {
            setError("Erreur réseau");
            console.error("Erreur chargement clients:", err);
        } finally {
            setLoadingClients(false);
        }
    };

    const filteredConvoys = direction
        ? convoys.filter((c) => c.direction === direction)
        : convoys;

    const toggleClient = (clientId: string) => {
        setSelectedClients(prev => {
            if (prev.includes(clientId)) {
                return prev.filter(id => id !== clientId);
            } else {
                return [...prev, clientId];
            }
        });
    };

    const filteredClients = clients.filter(c =>
        c.receiverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.receiverEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.trackingId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleAll = () => {
        if (selectedClients.length === filteredClients.length && filteredClients.length > 0) {
            setSelectedClients([]);
        } else {
            setSelectedClients(filteredClients.map(c => c.id));
        }
    };

    const handleSend = async () => {
        if (selectedClients.length === 0) {
            setError("Veuillez sélectionner au moins un client");
            return;
        }
        if (!subject.trim() || !message.trim()) {
            setError("Veuillez remplir le sujet et le message");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/emails/send-custom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientIds: selectedClients,
                    subject,
                    message,
                }),
            });

            const data = await response.json();

            // Quel que soit le résultat, on affiche le pop-up de bilan
            const sent = data.successCount ?? 0;
            const failed = data.failCount ?? 0;

            if (sent > 0 || failed > 0) {
                setResultPopup({
                    successCount: sent,
                    failCount: failed,
                    failedSamples: data.failedSamples ?? [],
                });
            } else if (!data.ok) {
                setError(data.error || "Erreur lors de l'envoi");
            }
        } catch (err) {
            setError("Erreur réseau");
            console.error("Erreur envoi emails:", err);
        } finally {
            setLoading(false);
        }
    };

    function closeResultPopup() {
        const wasSuccessful = (resultPopup?.successCount ?? 0) > 0;
        setResultPopup(null);
        if (wasSuccessful) {
            // Si au moins 1 mail est parti, on ferme le modal entier
            resetForm();
            onClose();
        }
    }

    const resetForm = () => {
        setSelectedClients([]);
        setSubject("");
        setMessage("");
        setError("");
        setSuccess(false);
        setSearchQuery("");
    };

    if (!isOpen) return null;

    function FilterChip({
        active,
        onClick,
        children,
    }: {
        active: boolean;
        onClick: () => void;
        children: React.ReactNode;
    }) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                        ? "bg-blue-700 text-white"
                        : "bg-white border border-blue-300 text-blue-700 hover:bg-blue-100"
                }`}
            >
                {children}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">✉️ Envoyer un email personnalisé</h2>
                        <p className="text-blue-100 text-sm mt-1">
                            Sélectionnez les clients et rédigez votre message
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-blue-500 rounded-full p-2 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Filtres direction + convoi */}
                    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-blue-900 mr-2">Direction :</span>
                            <FilterChip
                                active={direction === ""}
                                onClick={() => {
                                    setDirection("");
                                    setConvoyId("");
                                }}
                            >
                                Toutes
                            </FilterChip>
                            <FilterChip
                                active={direction === "NE_TO_CA"}
                                onClick={() => {
                                    setDirection("NE_TO_CA");
                                    setConvoyId("");
                                }}
                            >
                                🇳🇪 → 🇨🇦 (Niger → Canada)
                            </FilterChip>
                            <FilterChip
                                active={direction === "CA_TO_NE"}
                                onClick={() => {
                                    setDirection("CA_TO_NE");
                                    setConvoyId("");
                                }}
                            >
                                🇨🇦 → 🇳🇪 (Canada → Niger)
                            </FilterChip>
                        </div>
                        {filteredConvoys.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-blue-900 mr-2">Convoi :</span>
                                <FilterChip
                                    active={!convoyId}
                                    onClick={() => setConvoyId("")}
                                >
                                    Tous
                                </FilterChip>
                                {filteredConvoys.slice(0, 10).map((c) => (
                                    <FilterChip
                                        key={c.id}
                                        active={convoyId === c.id}
                                        onClick={() => setConvoyId(c.id)}
                                    >
                                        {c.date} ({c.direction === "CA_TO_NE" ? "CA→NE" : "NE→CA"})
                                    </FilterChip>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Liste des clients */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-gray-800">
                                Destinataires ({selectedClients.length} sélectionné{selectedClients.length > 1 ? "s" : ""})
                            </h3>
                            {filteredClients.length > 0 && (
                                <button
                                    onClick={toggleAll}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    {selectedClients.length === filteredClients.length ? "Tout désélectionner" : "Tout sélectionner"}
                                </button>
                            )}
                        </div>

                        {/* Recherche */}
                        <input
                            type="text"
                            placeholder="Rechercher par nom, email ou tracking..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full border rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />

                        {loadingClients ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="mt-2">Chargement des clients...</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg max-h-64 overflow-y-auto">
                                {filteredClients.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        {clients.length === 0 ? "Aucun client avec email trouvé" : "Aucun résultat"}
                                    </div>
                                ) : (
                                    filteredClients.map((client) => (
                                        <label
                                            key={client.id}
                                            className="flex items-center p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedClients.includes(client.id)}
                                                onChange={() => toggleClient(client.id)}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                            <div className="ml-3 flex-1">
                                                <div className="font-medium text-gray-800">
                                                    {client.receiverName}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {client.receiverEmail}
                                                </div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                    {client.trackingId}
                                                </div>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Formulaire d'email */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Sujet de l'email *
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ex: Mise à jour importante concernant votre colis"
                                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Message personnalisé *
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Rédigez votre message ici...&#10;&#10;Variables disponibles:&#10;{receiverName} - Nom du destinataire&#10;{trackingId} - Numéro de suivi"
                                rows={8}
                                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                💡 Utilisez <code className="bg-gray-100 px-1 rounded">{"{receiverName}"}</code> et <code className="bg-gray-100 px-1 rounded">{"{trackingId}"}</code> pour personnaliser
                            </p>
                        </div>
                    </div>

                    {/* Messages d'erreur/succès */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>{successMsg || "Emails envoyés avec succès !"}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={loading || selectedClients.length === 0 || !subject.trim() || !message.trim()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {loading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        <span>
                            {loading ? "Envoi en cours..." : `Envoyer à ${selectedClients.length} client${selectedClients.length > 1 ? "s" : ""}`}
                        </span>
                    </button>
                </div>
            </div>

            {/* === POP-UP DE RÉSULTAT === */}
            {resultPopup && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                        {/* En-tête coloré selon le résultat */}
                        <div
                            className={`p-6 text-white text-center ${
                                resultPopup.failCount === 0
                                    ? "bg-gradient-to-br from-green-500 to-emerald-600"
                                    : resultPopup.successCount === 0
                                        ? "bg-gradient-to-br from-red-500 to-rose-700"
                                        : "bg-gradient-to-br from-amber-500 to-orange-600"
                            }`}
                        >
                            <div className="text-5xl mb-2">
                                {resultPopup.failCount === 0
                                    ? "✅"
                                    : resultPopup.successCount === 0
                                        ? "❌"
                                        : "⚠️"}
                            </div>
                            <h2 className="text-xl font-bold">
                                {resultPopup.failCount === 0
                                    ? "Tous les emails envoyés !"
                                    : resultPopup.successCount === 0
                                        ? "Aucun email envoyé"
                                        : "Envoi partiel"}
                            </h2>
                        </div>

                        {/* Stats */}
                        <div className="p-6">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <p className="text-3xl font-bold text-green-700">
                                        {resultPopup.successCount}
                                    </p>
                                    <p className="text-xs uppercase tracking-widest text-green-700 mt-1">
                                        Envoyé{resultPopup.successCount > 1 ? "s" : ""}
                                    </p>
                                </div>
                                <div
                                    className={`rounded-lg p-4 text-center border ${
                                        resultPopup.failCount > 0
                                            ? "bg-red-50 border-red-200"
                                            : "bg-gray-50 border-gray-200"
                                    }`}
                                >
                                    <p
                                        className={`text-3xl font-bold ${
                                            resultPopup.failCount > 0 ? "text-red-700" : "text-gray-400"
                                        }`}
                                    >
                                        {resultPopup.failCount}
                                    </p>
                                    <p
                                        className={`text-xs uppercase tracking-widest mt-1 ${
                                            resultPopup.failCount > 0 ? "text-red-700" : "text-gray-400"
                                        }`}
                                    >
                                        Échec{resultPopup.failCount > 1 ? "s" : ""}
                                    </p>
                                </div>
                            </div>

                            {/* Détail des échecs (jusqu'à 5) */}
                            {resultPopup.failedSamples && resultPopup.failedSamples.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">
                                        Détail des échecs :
                                    </p>
                                    <ul className="space-y-1 max-h-32 overflow-y-auto text-xs text-gray-600">
                                        {resultPopup.failedSamples.map((f, i) => (
                                            <li key={i} className="flex flex-col bg-red-50 px-2 py-1 rounded">
                                                <span className="font-mono">{f.email}</span>
                                                <span className="text-red-700 italic">{f.error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 flex justify-end">
                            <button
                                onClick={closeResultPopup}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}