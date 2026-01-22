// src/components/ShipmentTracker.tsx
"use client";

import { useMemo } from "react";

type ShipmentStatus =
    | "CREATED"
    | "RECEIVED_IN_NIGER"
    | "RECEIVED_IN_CANADA"
    | "IN_TRANSIT"
    | "IN_TRANSIT_STOP"
    | "IN_CUSTOMS"
    | "READY_FOR_PICKUP"
    | "DELIVERED";

interface TrackingStep {
    status: ShipmentStatus[];
    label: string;
    icon: string;
    description: string;
}

interface ShipmentTrackerProps {
    currentStatus: ShipmentStatus;
    origin: string;
    destination: string;
    weight: number;
    pieces: number;
    trackingId: string;
}

const TRACKING_STEPS: TrackingStep[] = [
    {
        status: ["CREATED", "RECEIVED_IN_NIGER", "RECEIVED_IN_CANADA"],
        label: "Reçu",
        icon: "📝",
        description: "Colis enregistré",
    },
    {
        status: ["IN_TRANSIT"],
        label: "En route",
        icon: "✈️",
        description: "Le colis a quitté l'origine",
    },
    {
        status: ["IN_TRANSIT_STOP"],
        label: "En escale",
        icon: "🛬",
        description: "Escale intermédiaire",
    },
    {
        status: ["IN_CUSTOMS"],
        label: "À la douane",
        icon: "🛃",
        description: "Traitement douanier",
    },
    {
        status: ["READY_FOR_PICKUP"],
        label: "Prêt",
        icon: "📦",
        description: "Disponible pour récupération",
    },
    {
        status: ["DELIVERED"],
        label: "Récupéré",
        icon: "✅",
        description: "Colis récupéré",
    },
];

export default function ShipmentTracker({
                                            currentStatus,
                                            origin,
                                            destination,
                                            weight,
                                            trackingId,
                                        }: ShipmentTrackerProps) {
    const currentStepIndex = useMemo(() => {
        return TRACKING_STEPS.findIndex((step) => step.status.includes(currentStatus));
    }, [currentStatus]);

    const countryLabel = (codes: string) => {
        if (codes === "NE") return "Niger";
        if (codes === "CA") return "Canada";
        return codes;
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
            {/* En-tête avec numéro AWB */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 break-words">
                    Suivi : {trackingId}
                </h1>

                {/* Informations du colis - Responsive */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Origine</p>
                        <p className="font-semibold text-sm sm:text-base md:text-lg text-[#8B0000]">
                            {countryLabel(origin)}
                        </p>
                    </div>

                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Destination</p>
                        <p className="font-semibold text-sm sm:text-base md:text-lg text-[#8B0000]">
                            {countryLabel(destination)}
                        </p>
                    </div>

                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Poids</p>
                        <p className="font-semibold text-sm sm:text-base md:text-lg">
                            {weight} Kg
                        </p>
                    </div>
                </div>
            </div>

            {/* Barre de progression - Version Desktop (md et plus) */}
            <div className="hidden md:block relative">
                {/* Ligne de fond */}
                <div className="absolute top-14 left-0 right-0 h-1 bg-gray-200 z-0" />

                {/* Ligne de progression */}
                <div
                    className="absolute top-14 left-0 h-1 bg-gradient-to-r from-[#8B0000] to-[#DC143C] z-0 transition-all duration-500"
                    style={{
                        width: `${(currentStepIndex / (TRACKING_STEPS.length - 1)) * 100}%`,
                    }}
                />

                {/* Étapes Desktop */}
                <div className="relative flex justify-between items-start z-10">
                    {TRACKING_STEPS.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;
                        const isActive = index === currentStepIndex;
                        const isNext = index === currentStepIndex + 1;

                        return (
                            <div key={step.label} className="flex flex-col items-center flex-1">
                                {/* Cercle avec icône */}
                                <div
                                    className={`w-20 h-20 lg:w-28 lg:h-28 rounded-full flex items-center justify-center text-3xl lg:text-4xl transition-all duration-300 border-4 ${
                                        isCompleted
                                            ? "bg-gradient-to-br from-[#E57373] to-[#EF5350] border-[#E57373]"
                                            : isNext
                                                ? "bg-white border-[#DC143C] border-dashed animate-pulse"
                                                : "bg-gray-100 border-gray-300"
                                    }`}
                                >
                                    <span className={isCompleted ? "filter drop-shadow-lg" : ""}>
                                        {step.icon}
                                    </span>
                                </div>

                                {/* Label et description */}
                                <div className="mt-4 text-center">
                                    <p
                                        className={`font-semibold text-xs lg:text-sm mb-1 ${
                                            isActive
                                                ? "text-[#8B0000] text-sm lg:text-lg"
                                                : isCompleted
                                                    ? "text-gray-900"
                                                    : "text-gray-400"
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-gray-500 max-w-[80px] lg:max-w-[100px]">
                                        {step.description}
                                    </p>
                                </div>

                                {/* Indicateur d'état actif */}
                                {isActive && (
                                    <div className="mt-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#8B0000] text-white animate-pulse">
                                            En cours
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Version Mobile - Liste verticale (sm et moins) */}
            <div className="md:hidden space-y-4">
                {TRACKING_STEPS.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isActive = index === currentStepIndex;
                    const isNext = index === currentStepIndex + 1;

                    return (
                        <div key={step.label} className="flex items-center gap-4">
                            {/* Cercle avec icône - Plus petit sur mobile */}
                            <div
                                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl border-4 flex-shrink-0 ${
                                    isCompleted
                                        ? "bg-gradient-to-br from-[#E57373] to-[#EF5350] border-[#E57373]"
                                        : isNext
                                            ? "bg-white border-[#DC143C] border-dashed"
                                            : "bg-gray-100 border-gray-300"
                                }`}
                            >
                                {step.icon}
                            </div>

                            {/* Informations */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <p
                                        className={`font-semibold text-sm ${
                                            isActive
                                                ? "text-[#8B0000]"
                                                : isCompleted
                                                    ? "text-gray-900"
                                                    : "text-gray-400"
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {isActive && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B0000] text-white">
                                            En cours
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500">{step.description}</p>
                            </div>

                            {/* Check pour étapes complétées */}
                            {isCompleted && index < currentStepIndex && (
                                <div className="text-green-500 text-xl">✓</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Message de statut */}
            <div className="mt-8 sm:mt-12 p-4 sm:p-6 bg-gradient-to-r from-[#8B0000]/10 to-[#DC143C]/10 rounded-lg border-l-4 border-[#8B0000]">
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900">
                    {currentStepIndex === TRACKING_STEPS.length - 1
                        ? "🎉 Votre colis a été récupéré avec succès !"
                        : currentStepIndex >= 0
                            ? `📍 ${TRACKING_STEPS[currentStepIndex].description}`
                            : "⏳ Votre colis est en préparation"}
                </p>
            </div>
        </div>
    );
}