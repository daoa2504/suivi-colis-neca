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

interface ShipmentTrackerProps {
    currentStatus: ShipmentStatus;
    origin: string;
    destination: string;
    weight: number;
    pieces: number;
    trackingId: string;
}

// === Icônes SVG (Heroicons-style outline, traits 2) ===
function IconReceived(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z" />
            <path d="m9 14 2 2 4-4" />
        </svg>
    );
}
function IconPlane(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
    );
}
function IconCustoms(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
function IconBox(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
    );
}
function IconCheck(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

// === Avion qui se déplace sur la trajectoire ===
function FlyingPlane(props: { className?: string }) {
    return (
        <svg
            className={props.className}
            viewBox="0 0 64 64"
            fill="currentColor"
        >
            <path d="M61 27.4 38.6 25 27.4 5l-5.6 1.4 5 19.8L8 27.6 4 30l16 7-2 9 5 2 5-6 13.4 5 1.4-5.6L23 35.6 41 33l5 11 5-2-2-9z" />
        </svg>
    );
}

type StepDef = {
    statuses: ShipmentStatus[];
    label: string;
    description: string;
    Icon: (p: { className?: string }) => JSX.Element;
};

const TRACKING_STEPS: StepDef[] = [
    {
        statuses: ["CREATED", "RECEIVED_IN_NIGER", "RECEIVED_IN_CANADA"],
        label: "Reçu",
        description: "Colis enregistré par nos agents",
        Icon: IconReceived,
    },
    {
        statuses: ["IN_TRANSIT", "IN_TRANSIT_STOP"],
        label: "En transit",
        description: "Le colis a quitté l'origine",
        Icon: IconPlane,
    },
    {
        statuses: ["IN_CUSTOMS"],
        label: "À la douane",
        description: "Traitement douanier en cours",
        Icon: IconCustoms,
    },
    {
        statuses: ["READY_FOR_PICKUP"],
        label: "Prêt",
        description: "Disponible pour récupération",
        Icon: IconBox,
    },
    {
        statuses: ["DELIVERED"],
        label: "Récupéré",
        description: "Colis remis au destinataire",
        Icon: IconCheck,
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
        const i = TRACKING_STEPS.findIndex((step) => step.statuses.includes(currentStatus));
        return i >= 0 ? i : 0;
    }, [currentStatus]);

    const isDelivered = currentStatus === "DELIVERED";
    const planePosition = (currentStepIndex / (TRACKING_STEPS.length - 1)) * 100;

    const countryLabel = (codes: string) => {
        if (codes === "NE") return "Niger";
        if (codes === "CA") return "Canada";
        return codes;
    };

    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* En-tête tracking */}
            <div className="bg-gradient-to-r from-[#8B0000] to-[#DC143C] p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase opacity-80 tracking-widest">Numéro de suivi</p>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold">
                            {trackingId}
                        </h2>
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
            <div className="hidden md:block relative px-8 pt-10 pb-8">
                {/* Ciel décoratif */}
                <div className="absolute inset-x-8 top-10 h-28 rounded-2xl bg-gradient-to-b from-sky-100 via-sky-50 to-white" />

                {/* Conteneur de la piste */}
                <div className="relative h-28 mb-4">
                    {/* Ligne de piste (fond) */}
                    <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-gray-200 rounded-full" />

                    {/* Ligne de progression (rouge) */}
                    <div
                        className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-[#8B0000] to-[#DC143C] rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${planePosition}%` }}
                    />

                    {/* Traînée derrière l'avion */}
                    {!isDelivered && planePosition > 4 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 z-0 pointer-events-none"
                            style={{
                                left: 0,
                                width: `${Math.max(planePosition - 4, 0)}%`,
                                height: 18,
                            }}
                        >
                            <div className="h-full w-full opacity-50 bg-[radial-gradient(circle_at_right,rgba(220,20,60,0.5),transparent_70%)]" />
                        </div>
                    )}

                    {/* Avion animé */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out z-10"
                        style={{
                            left: `${planePosition}%`,
                            transform: `translate(-50%, -50%) translateY(${isDelivered ? 0 : -28}px)`,
                        }}
                    >
                        <div className={isDelivered ? "" : "plane-float"}>
                            {isDelivered ? (
                                <IconCheck className="w-10 h-10 text-[#8B0000] drop-shadow-md" />
                            ) : (
                                <FlyingPlane className="w-12 h-12 text-[#8B0000] drop-shadow-md" />
                            )}
                        </div>
                    </div>

                    {/* Marqueurs origine / destination */}
                    <div className="absolute -top-1 left-0 w-3 h-3 rounded-full bg-[#8B0000] ring-4 ring-[#8B0000]/20" />
                    <div className="absolute -top-1 right-0 w-3 h-3 rounded-full bg-gray-400 ring-4 ring-gray-300" />
                </div>

                {/* Étapes */}
                <div className="grid grid-cols-5 gap-2">
                    {TRACKING_STEPS.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;
                        const isActive = index === currentStepIndex;
                        const StepIcon = step.Icon;
                        return (
                            <div key={step.label} className="flex flex-col items-center text-center">
                                <div
                                    className={`w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                                        isCompleted
                                            ? "bg-gradient-to-br from-[#8B0000] to-[#DC143C] border-[#8B0000] text-white shadow-md"
                                            : "bg-white border-gray-300 text-gray-400"
                                    } ${isActive ? "scale-110 ring-4 ring-[#DC143C]/30" : ""}`}
                                >
                                    <StepIcon className="w-7 h-7 lg:w-8 lg:h-8" />
                                </div>
                                <p
                                    className={`mt-2 text-xs lg:text-sm font-semibold ${
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
            </div>

            {/* === VERSION MOBILE === */}
            <div className="md:hidden p-4 space-y-3">
                {TRACKING_STEPS.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isActive = index === currentStepIndex;
                    const StepIcon = step.Icon;
                    return (
                        <div key={step.label} className="flex items-center gap-3">
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                                    isCompleted
                                        ? "bg-gradient-to-br from-[#8B0000] to-[#DC143C] border-[#8B0000] text-white"
                                        : "bg-gray-50 border-gray-300 text-gray-400"
                                } ${isActive ? "ring-4 ring-[#DC143C]/30" : ""}`}
                            >
                                <StepIcon className="w-6 h-6" />
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
                        </div>
                    );
                })}
            </div>

            {/* Style avion */}
            <style jsx>{`
                @keyframes planeFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-6px); }
                }
                .plane-float {
                    animation: planeFloat 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
