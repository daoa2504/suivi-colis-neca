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
        description: "Colis enregistré par nos agents",
    },
    {
        status: ["IN_TRANSIT", "IN_TRANSIT_STOP"],
        label: "En transit",
        icon: "✈️",
        description: "Le colis a quitté l'origine",
    },
    {
        status: ["IN_CUSTOMS"],
        label: "À la douane",
        icon: "🛃",
        description: "Traitement douanier en cours",
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
        description: "Colis remis au destinataire",
    },
];

function getStatusLabel(s: ShipmentStatus) {
    const labels: Record<ShipmentStatus, string> = {
        CREATED: "Enregistré",
        RECEIVED_IN_NIGER: "Reçu au Niger",
        RECEIVED_IN_CANADA: "Reçu au Canada",
        IN_TRANSIT: "En route",
        IN_TRANSIT_STOP: "En escale",
        IN_CUSTOMS: "À la douane",
        READY_FOR_PICKUP: "Prêt pour récupération",
        DELIVERED: "Récupéré",
    };
    return labels[s] ?? s;
}

export default function ShipmentTracker({
    currentStatus,
    origin,
    destination,
    weight,
    trackingId,
}: ShipmentTrackerProps) {
    const currentStepIndex = useMemo(() => {
        const i = TRACKING_STEPS.findIndex((step) => step.status.includes(currentStatus));
        return i >= 0 ? i : 0;
    }, [currentStatus]);

    const isDelivered = currentStatus === "DELIVERED";
    const planePosition =
        (currentStepIndex / (TRACKING_STEPS.length - 1)) * 100;

    const countryLabel = (codes: string) => {
        if (codes === "NE") return "🇳🇪 Niger";
        if (codes === "CA") return "🇨🇦 Canada";
        return codes;
    };

    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* En-tête tracking */}
            <div className="bg-gradient-to-r from-[#8B0000] to-[#DC143C] p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase opacity-80 tracking-widest">Numéro de suivi</p>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold">
                            {trackingId}
                        </h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase opacity-80 tracking-widest">Statut actuel</p>
                        <p className="font-semibold text-sm sm:text-base">{getStatusLabel(currentStatus)}</p>
                    </div>
                </div>
            </div>

            {/* Carte récap */}
            <div className="px-4 sm:px-6 pt-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Origine</p>
                        <p className="font-semibold text-sm sm:text-base">{countryLabel(origin)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Destination</p>
                        <p className="font-semibold text-sm sm:text-base">{countryLabel(destination)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-500 mb-1">Poids</p>
                        <p className="font-semibold text-sm sm:text-base">{weight ?? "—"} kg</p>
                    </div>
                </div>
            </div>

            {/* === ZONE TRAJECTOIRE AVION (desktop) === */}
            <div className="hidden md:block relative px-8 pt-8 pb-4">
                {/* Ciel décoratif */}
                <div className="absolute inset-x-8 top-8 bottom-24 rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-white overflow-hidden">
                    {/* Petits nuages */}
                    <div className="absolute top-3 left-[10%] text-2xl opacity-30">☁️</div>
                    <div className="absolute top-8 left-[35%] text-xl opacity-40">☁️</div>
                    <div className="absolute top-5 left-[65%] text-2xl opacity-30">☁️</div>
                    <div className="absolute top-10 left-[85%] text-lg opacity-40">☁️</div>
                </div>

                {/* Conteneur de la piste */}
                <div className="relative h-40">
                    {/* Ligne de piste (fond) */}
                    <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-200 rounded-full" />

                    {/* Ligne de progression (rouge) */}
                    <div
                        className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-[#8B0000] to-[#DC143C] rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${planePosition}%` }}
                    />

                    {/* Avion animé */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out z-10"
                        style={{
                            left: `${planePosition}%`,
                            transform: `translate(-50%, -50%) translateY(${isDelivered ? 0 : -22}px)`,
                        }}
                    >
                        <div className={isDelivered ? "" : "plane-float"}>
                            {isDelivered ? (
                                <div className="text-4xl drop-shadow-xl">📍</div>
                            ) : (
                                <span
                                    className="inline-block text-5xl drop-shadow-xl"
                                    style={{ transform: "rotate(-25deg)" }}
                                >
                                    ✈️
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Trace de fumée derrière l'avion */}
                    {!isDelivered && planePosition > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                            style={{
                                left: 0,
                                width: `${Math.max(planePosition - 4, 0)}%`,
                                height: 20,
                            }}
                        >
                            <div className="h-full w-full opacity-50 bg-[radial-gradient(circle_at_right,rgba(220,20,60,0.4),transparent_70%)]" />
                        </div>
                    )}

                    {/* Étapes */}
                    <div className="absolute inset-x-0 top-full pt-3 flex justify-between">
                        {TRACKING_STEPS.map((step, index) => {
                            const isCompleted = index <= currentStepIndex;
                            const isActive = index === currentStepIndex;
                            return (
                                <div
                                    key={step.label}
                                    className="flex flex-col items-center"
                                    style={{ width: `${100 / TRACKING_STEPS.length}%` }}
                                >
                                    <div
                                        className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xl lg:text-2xl border-4 transition-all duration-300 ${
                                            isCompleted
                                                ? "bg-gradient-to-br from-[#E57373] to-[#EF5350] border-[#E57373] text-white shadow-md"
                                                : "bg-white border-gray-300"
                                        } ${isActive ? "scale-110 ring-4 ring-[#DC143C]/30" : ""}`}
                                    >
                                        <span>{step.icon}</span>
                                    </div>
                                    <p
                                        className={`mt-2 text-xs lg:text-sm font-semibold text-center ${
                                            isActive
                                                ? "text-[#8B0000]"
                                                : isCompleted
                                                    ? "text-gray-900"
                                                    : "text-gray-400"
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {isActive && !isDelivered && (
                                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#8B0000] text-white animate-pulse">
                                            En cours
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Marqueurs origine / destination */}
                    <div className="absolute -top-2 left-0 text-2xl">📍</div>
                    <div className="absolute -top-2 right-0 text-2xl">🏁</div>
                </div>
            </div>

            {/* === VERSION MOBILE — liste verticale avec avion === */}
            <div className="md:hidden p-4 space-y-4">
                {TRACKING_STEPS.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isActive = index === currentStepIndex;
                    return (
                        <div key={step.label} className="flex items-center gap-3 relative">
                            <div
                                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-4 flex-shrink-0 ${
                                    isCompleted
                                        ? "bg-gradient-to-br from-[#E57373] to-[#EF5350] border-[#E57373] text-white"
                                        : "bg-gray-100 border-gray-300"
                                } ${isActive ? "ring-4 ring-[#DC143C]/30" : ""}`}
                            >
                                {step.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
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
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#8B0000] text-white animate-pulse">
                                            En cours
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500">{step.description}</p>
                            </div>
                            {isActive && !isDelivered && (
                                <span className="text-2xl absolute -right-1 plane-float">
                                    ✈️
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bandeau message statut */}
            <div className="m-4 sm:m-6 p-4 sm:p-5 bg-gradient-to-r from-[#8B0000]/10 to-[#DC143C]/10 rounded-lg border-l-4 border-[#8B0000]">
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900">
                    {isDelivered
                        ? "🎉 Votre colis a été récupéré avec succès !"
                        : `${TRACKING_STEPS[currentStepIndex].icon} ${TRACKING_STEPS[currentStepIndex].description}`}
                </p>
            </div>

            {/* Style avion */}
            <style jsx>{`
                @keyframes planeFloat {
                    0%, 100% { transform: translateY(0px) rotate(-25deg); }
                    50% { transform: translateY(-6px) rotate(-25deg); }
                }
                .plane-float :global(span),
                .plane-float :global(div) {
                    animation: planeFloat 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
