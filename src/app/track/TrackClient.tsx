"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ShipmentTracker from "@/components/ShipmentTracker";

const POLL_INTERVAL_MS = 20_000; // 20 secondes

export default function TrackClient({ initialTrackingId }: { initialTrackingId: string }) {
    const router = useRouter();

    const [trackingId, setTrackingId] = useState(initialTrackingId);
    const [shipmentData, setShipmentData] = useState<any>(null);
    const [loading, setLoading] = useState(Boolean(initialTrackingId));
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const hasInitial = Boolean(initialTrackingId);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchShipment = async (id: string, silent = false) => {
        const cleanId = id.trim().toUpperCase();
        if (!cleanId) return;

        if (!silent) {
            setError("");
            setLoading(true);
        }

        try {
            const response = await fetch(`/api/track/${encodeURIComponent(cleanId)}`, {
                cache: "no-store",
            });
            const data = await response.json();

            if (data.ok) {
                setShipmentData(data.shipment);
                setLastUpdated(new Date());
            } else {
                if (!silent) {
                    setShipmentData(null);
                    setError(data.error || "Colis introuvable");
                }
            }
        } catch {
            if (!silent) {
                setShipmentData(null);
                setError("Erreur lors de la recherche");
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (initialTrackingId) {
            fetchShipment(initialTrackingId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTrackingId]);

    // Polling temps réel : refetch toutes les 20s tant que pas DELIVERED
    useEffect(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (!shipmentData?.trackingId) return;
        if (shipmentData.status === "DELIVERED") return; // terminal, plus besoin de poll

        pollRef.current = setInterval(() => {
            fetchShipment(shipmentData.trackingId, true);
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shipmentData?.trackingId, shipmentData?.status]);

    const handleTrack = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanId = trackingId.trim().toUpperCase();
        if (!cleanId) return;

        router.replace(`/track/${encodeURIComponent(cleanId)}`);
        fetchShipment(cleanId);
    };

    const handleNewSearch = () => {
        setShipmentData(null);
        setError("");
        setLoading(false);
        setTrackingId("");
        router.replace("/track");
    };

    const PublicHeader = () => (
        <header className="py-6 sm:py-8 bg-white border-b border-gray-100">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
                <div className="flex items-center justify-center gap-4 sm:gap-10">
                    {/* Drapeau Canada (gauche) */}
                    <img
                        src="/flags/ca.svg"
                        alt="Canada"
                        className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover shadow-md ring-2 ring-white flex-shrink-0"
                    />

                    {/* Bloc central : logo + nom + slogan */}
                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <img
                                src="https://nimaplex.com/img.png"
                                alt="NIMAPLEX"
                                className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg shadow-sm object-cover"
                            />
                            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-[#8B0000] to-[#DC143C] bg-clip-text text-transparent">
                                NIMAPLEX
                            </h1>
                        </div>
                        <p className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-gray-600 italic">
                            Plus qu'une solution, un service d'excellence globale
                        </p>
                    </div>

                    {/* Drapeau Niger (droite) */}
                    <img
                        src="/flags/ne.svg"
                        alt="Niger"
                        className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover shadow-md ring-2 ring-white flex-shrink-0"
                    />
                </div>
            </div>
        </header>
    );

    // ✅ IMPORTANT : Loader plein écran AVANT le return principal
    if (hasInitial && loading && !shipmentData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <PublicHeader />
                <div className="max-w-2xl mx-auto px-6 py-8">
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
            <PublicHeader />

            <div className="max-w-7xl mx-auto px-6 py-6">
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
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <button
                                onClick={handleNewSearch}
                                className="inline-flex items-center gap-2 text-sm text-[#8B0000] hover:underline"
                            >
                                ← Nouvelle recherche
                            </button>
                            {lastUpdated && shipmentData.status !== "DELIVERED" && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Mise à jour automatique · dernière vérification{" "}
                                    {lastUpdated.toLocaleTimeString("fr-CA", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </p>
                            )}
                        </div>

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
