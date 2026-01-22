"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ShipmentTracker from "@/components/ShipmentTracker";

export default function TrackClient({ initialTrackingId }: { initialTrackingId: string }) {
    const router = useRouter();

    const [trackingId, setTrackingId] = useState(initialTrackingId);
    const [shipmentData, setShipmentData] = useState<any>(null);
    const [loading, setLoading] = useState(Boolean(initialTrackingId));
    const [error, setError] = useState("");

    const hasInitial = Boolean(initialTrackingId);

    const fetchShipment = async (id: string) => {
        const cleanId = id.trim().toUpperCase();
        if (!cleanId) return;

        setError("");
        setLoading(true);

        try {
            const response = await fetch(`/api/track/${encodeURIComponent(cleanId)}`);
            const data = await response.json();

            if (data.ok) {
                setShipmentData(data.shipment);
            } else {
                setShipmentData(null);
                setError(data.error || "Colis introuvable");
            }
        } catch {
            setShipmentData(null);
            setError("Erreur lors de la recherche");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialTrackingId) {
            fetchShipment(initialTrackingId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTrackingId]);

    const handleTrack = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanId = trackingId.trim().toUpperCase();
        if (!cleanId) return;

        router.replace(`/track?trackingId=${encodeURIComponent(cleanId)}`);
        fetchShipment(cleanId);
    };

    const handleNewSearch = () => {
        setShipmentData(null);
        setError("");
        setLoading(false);
        setTrackingId("");
        router.replace("/track");
    };

    // ✅ IMPORTANT : Loader plein écran AVANT le return principal
    if (hasInitial && loading && !shipmentData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <header className="py-6">
                    <div className="mx-auto flex max-w-7xl justify-center px-6">
                        <div className="flex items-center gap-3">
                            <img
                                src="https://nimaplex.com/img.png"
                                alt="NIMAPLEX"
                                className="h-12 w-12 rounded-lg shadow-lg object-cover"
                            />
                            <div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  NIMAPLEX
                </span>
                                <p className="text-xs text-gray-500">Chargement du suivi...</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-2xl mx-auto px-6 py-12">
                    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                        <p className="text-gray-800 font-semibold">Recherche du colis...</p>
                        <p className="text-gray-500 text-sm mt-2">Veuillez patienter</p>
                    </div>
                </div>
            </div>
        );
    }

    const showForm = !shipmentData;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <header className="py-6">
                <div className="mx-auto flex max-w-7xl justify-center px-6">
                    <div className="flex items-center gap-3">
                        <img
                            src="https://nimaplex.com/img.png"
                            alt="NIMAPLEX"
                            className="h-12 w-12 rounded-lg shadow-lg object-cover"
                        />
                        <div>
                            <div className="flex items-center gap-2">
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  NIMAPLEX
                </span>
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <img src="/flags/ca.svg" alt="CA" className="w-4 h-3 rounded" />
                                    <span>→</span>
                                    <img src="/flags/ne.svg" alt="NE" className="w-4 h-3 rounded" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">Gestion de colis international</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Formulaire */}
                {showForm && (
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl shadow-lg p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Suivez votre colis</h2>
                                <p className="text-gray-600">
                                    Entrez votre numéro de suivi pour voir l'état de votre colis
                                </p>
                            </div>

                            <form onSubmit={handleTrack} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Numéro de suivi
                                    </label>
                                    <input
                                        type="text"
                                        value={trackingId}
                                        onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                                        placeholder="Ex: NECA-0001"
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8B0000] focus:border-transparent text-lg font-mono"
                                    />
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-800 text-sm">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-[#8B0000] to-[#DC143C] text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Recherche en cours..." : "Suivre mon colis"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Résultat */}
                {shipmentData && (
                    <div className="space-y-6">
                        <button
                            onClick={handleNewSearch}
                            className="inline-flex items-center gap-2 text-sm text-[#8B0000] hover:underline"
                        >
                            ← Nouvelle recherche
                        </button>

                        <ShipmentTracker
                            currentStatus={shipmentData.status}
                            origin={shipmentData.origin}
                            destination={shipmentData.destination}
                            weight={shipmentData.weightKg}
                            pieces={shipmentData.pieces || 1}
                            trackingId={shipmentData.trackingId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
