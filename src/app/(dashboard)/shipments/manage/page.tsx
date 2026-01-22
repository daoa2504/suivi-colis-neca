// src/app/(dashboard)/shipments/manage/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type ShipmentStatus =
    | "CREATED"
    | "RECEIVED_IN_NIGER"      // ✅ AJOUTEZ CETTE LIGNE
    | "RECEIVED_IN_CANADA"     // ✅ AJOUTEZ CETTE LIGNE
    | "IN_TRANSIT"
    | "IN_TRANSIT_STOP"
    | "IN_CUSTOMS"
    | "READY_FOR_PICKUP"
    | "DELIVERED";

interface Convoy {
    id: string;
    date: string;
    direction: string;
    totalShipments: number;
}

interface Shipment {
    id: number;
    trackingId: string;
    receiverName: string;
    receiverCity: string;
    senderCity: string;
    status: ShipmentStatus;
    convoyId: number;
}

export default function ManageShipmentsPage() {
    const { data: session } = useSession();
    const [activeTab, setActiveTab] = useState<"convoy" | "city" | "individual">("convoy");

    // États pour l'onglet CONVOI
    const [convoys, setConvoys] = useState<Convoy[]>([]);
    const [selectedConvoy, setSelectedConvoy] = useState<string | null>(null);
    const [convoyStatus, setConvoyStatus] = useState<"IN_TRANSIT" | "IN_TRANSIT_STOP" | "IN_CUSTOMS">("IN_TRANSIT");
    const [convoyLocation, setConvoyLocation] = useState("");

    // États pour l'onglet VILLE
    const [cities, setCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState("");
    const [selectedConvoyForCity, setSelectedConvoyForCity] = useState<string | null>(null);

    // États pour l'onglet INDIVIDUEL
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchConvoys();
        fetchCities();
        fetchShipments();
    }, []);

    const fetchConvoys = async () => {
        const response = await fetch("/api/convoys/list");
        const data = await response.json();
        if (data.ok) setConvoys(data.convoys);
    };

    const fetchCities = async () => {
        const response = await fetch("/api/shipments/cities");
        const data = await response.json();
        if (data.ok) setCities(data.cities);
    };

    const fetchShipments = async () => {
        const response = await fetch("/api/shipments/all");
        const data = await response.json();
        if (data.ok) setShipments(data.shipments);
    };

    // ========== MISE À JOUR PAR CONVOI ==========
    const handleUpdateConvoy = async () => {
        if (!selectedConvoy) {
            alert("Veuillez sélectionner un convoi");
            return;
        }

        const confirmed = confirm(
            `Voulez-vous mettre à jour TOUS les colis de ce convoi au statut "${convoyStatus}" ?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/convoys/${selectedConvoy}/update-status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: convoyStatus,
                    currentLocation: convoyLocation,
                }),
            });

            const data = await response.json();

            if (data.ok) {
                alert(`✅ ${data.updatedCount} colis mis à jour !`);
                fetchShipments();
            } else {
                alert("❌ Erreur : " + data.error);
            }
        } catch (error) {
            alert("❌ Erreur lors de la mise à jour");
        }
    };

    // ========== MISE À JOUR PAR VILLE ==========
    const handleUpdateByCity = async () => {
        if (!selectedCity || !selectedConvoyForCity) {
            alert("Veuillez sélectionner un convoi et une ville");
            return;
        }

        const confirmed = confirm(
            `Voulez-vous marquer tous les colis de ${selectedCity} comme "Prêts pour récupération" ?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/convoys/${selectedConvoyForCity}/update-by-city`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    city: selectedCity,
                    status: "READY_FOR_PICKUP",
                }),
            });

            const data = await response.json();

            if (data.ok) {
                alert(`✅ ${data.updatedCount} colis de ${selectedCity} marqués comme prêts !`);
                fetchShipments();
            } else {
                alert("❌ Erreur : " + data.error);
            }
        } catch (error) {
            alert("❌ Erreur lors de la mise à jour");
        }
    };

    // ========== MISE À JOUR INDIVIDUELLE ==========
    const handleMarkAsDelivered = async (shipmentId: number, trackingId: string) => {
        const confirmed = confirm(
            `Confirmer la récupération du colis ${trackingId} ?`
        );

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/shipments/${shipmentId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "DELIVERED",
                }),
            });

            const data = await response.json();

            if (data.ok) {
                alert(`✅ Colis ${trackingId} marqué comme récupéré !`);
                fetchShipments();
            } else {
                alert("❌ Erreur : " + data.error);
            }
        } catch (error) {
            alert("❌ Erreur lors de la mise à jour");
        }
    };

    const filteredShipments = shipments.filter(s =>
            s.status !== "DELIVERED" && (
                s.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.receiverName.toLowerCase().includes(searchTerm.toLowerCase())
            )
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* En-tête */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Gestion des statuts de colis
                    </h1>
                    <p className="text-gray-600">
                        Mettez à jour les colis par convoi, par ville ou individuellement
                    </p>
                </div>

                {/* Onglets */}
                <div className="flex gap-2 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab("convoy")}
                        className={`px-6 py-3 font-medium transition-all ${
                            activeTab === "convoy"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        🚚 Par Convoi
                    </button>
                    <button
                        onClick={() => setActiveTab("city")}
                        className={`px-6 py-3 font-medium transition-all ${
                            activeTab === "city"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        📍 Par Ville
                    </button>
                    <button
                        onClick={() => setActiveTab("individual")}
                        className={`px-6 py-3 font-medium transition-all ${
                            activeTab === "individual"
                                ? "text-blue-600 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        📦 Individuellement
                    </button>
                </div>

                {/* ========== ONGLET 1 : PAR CONVOI ========== */}
                {activeTab === "convoy" && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Mettre à jour tout un convoi
                        </h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Utilisez cette option pour mettre à jour tous les colis d'un convoi en même temps
                            (En route, En escale, À la douane)
                        </p>

                        <div className="space-y-6">
                            {/* Sélection du convoi */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Convoi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedConvoy || ""}
                                    onChange={(e) => setSelectedConvoy(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Sélectionner un convoi</option>
                                    {convoys.map((convoy) => (
                                        <option key={convoy.id} value={convoy.id}>
                                            Convoi du {new Date(convoy.date).toLocaleDateString("fr-CA")} -
                                            {convoy.direction} ({convoy.totalShipments} colis)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Sélection du statut */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Nouveau statut <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setConvoyStatus("IN_TRANSIT")}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            convoyStatus === "IN_TRANSIT"
                                                ? "border-blue-600 bg-blue-50 shadow-md"
                                                : "border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="text-3xl mb-2">✈️</div>
                                        <div className="font-semibold">En route</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConvoyStatus("IN_TRANSIT_STOP")}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            convoyStatus === "IN_TRANSIT_STOP"
                                                ? "border-blue-600 bg-blue-50 shadow-md"
                                                : "border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="text-3xl mb-2">🛬</div>
                                        <div className="font-semibold">En escale</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConvoyStatus("IN_CUSTOMS")}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            convoyStatus === "IN_CUSTOMS"
                                                ? "border-blue-600 bg-blue-50 shadow-md"
                                                : "border-gray-200 hover:border-gray-300"
                                        }`}
                                    >
                                        <div className="text-3xl mb-2">🛃</div>
                                        <div className="font-semibold">À la douane</div>
                                    </button>
                                </div>
                            </div>

                            {/* Localisation */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Localisation (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={convoyLocation}
                                    onChange={(e) => setConvoyLocation(e.target.value)}
                                    placeholder="Ex: Aéroport Pearson Toronto"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Bouton de mise à jour */}
                            <button
                                onClick={handleUpdateConvoy}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                            >
                                Mettre à jour le convoi
                            </button>
                        </div>
                    </div>
                )}

                {/* ========== ONGLET 2 : PAR VILLE ========== */}
                {activeTab === "city" && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Marquer les colis d'une ville comme "Prêts"
                        </h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Utilisez cette option quand les colis d'une ville spécifique sont arrivés et prêts pour récupération
                        </p>

                        <div className="space-y-6">
                            {/* Sélection du convoi */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Convoi <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedConvoyForCity || ""}
                                    onChange={(e) => setSelectedConvoyForCity(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Sélectionner un convoi</option>
                                    {convoys.map((convoy) => (
                                        <option key={convoy.id} value={convoy.id}>
                                            Convoi du {new Date(convoy.date).toLocaleDateString("fr-CA")} -
                                            {convoy.direction}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Sélection de la ville */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Ville <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Sélectionner une ville</option>
                                    {cities.map((city) => (
                                        <option key={city} value={city}>
                                            📍 {city}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Bouton de mise à jour */}
                            <button
                                onClick={handleUpdateByCity}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                            >
                                📦 Marquer comme prêts pour récupération
                            </button>
                        </div>
                    </div>
                )}

                {/* ========== ONGLET 3 : INDIVIDUELLEMENT ========== */}
                {activeTab === "individual" && (
                    <div className="bg-white rounded-lg shadow">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                Marquer un colis comme récupéré
                            </h2>
                            <input
                                type="text"
                                placeholder="🔍 Rechercher par tracking ID ou nom du client..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Tracking ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Ville
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Statut actuel
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Action
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                {filteredShipments.map((shipment) => (
                                    <tr key={shipment.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-semibold text-blue-600">
                          {shipment.trackingId}
                        </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shipment.receiverName}
                                        </td>
                                        <td className="px-6 py-4">
                                            {shipment.receiverCity}
                                        </td>
                                        <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            shipment.status === "READY_FOR_PICKUP"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                        }`}>
                          {shipment.status === "READY_FOR_PICKUP" ? "📦 Prêt" : "🚚 En transit"}
                        </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {shipment.status === "READY_FOR_PICKUP" && (
                                                <button
                                                    onClick={() => handleMarkAsDelivered(shipment.id, shipment.trackingId)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    ✅ Marquer comme récupéré
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>

                            {filteredShipments.length === 0 && (
                                <div className="p-12 text-center text-gray-500">
                                    Aucun colis trouvé
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}