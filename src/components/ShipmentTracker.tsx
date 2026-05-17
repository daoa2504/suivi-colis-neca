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
        <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z" />
            <path d="m9 14 2 2 4-4" />
        </svg>
    );
}
function IconPlane(props: { className?: string }) {
    return (
        <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
    );
}
function IconCustoms(props: { className?: string }) {
    return (
        <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
function IconBox(props: { className?: string }) {
    return (
        <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
    );
}
function IconCheck(props: { className?: string }) {
    return (
        <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}

// Avion vue de dessus (Bootstrap Icons "airplane-fill"), pointe vers la DROITE
// après une rotation de 90° appliquée par défaut. Forme reconnaissable d'airliner.
function FlyingPlane(props: { className?: string; style?: React.CSSProperties }) {
    return (
        <svg
            className={props.className}
            style={props.style}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
        >
            {/* La forme native pointe vers le HAUT — on tourne 90° pour qu'elle pointe à droite */}
            <g transform="rotate(90 8 8)">
                <path d="M6.428 1.151C6.708.591 7.213 0 8 0s1.292.592 1.572 1.151C9.852 1.71 10 2.36 10 3v3.691l5.17 2.585a1.5 1.5 0 0 1 .83 1.342V12a.5.5 0 0 1-.582.493l-5.507-.918-.375 2.253 1.318 1.318A.5.5 0 0 1 10.5 16h-5a.5.5 0 0 1-.354-.854l1.318-1.318-.375-2.253-5.507.918A.5.5 0 0 1 0 12v-1.382a1.5 1.5 0 0 1 .83-1.342L6 6.691V3c0-.64.148-1.29.428-1.849Z" />
            </g>
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
    { statuses: ["CREATED", "RECEIVED_IN_NIGER", "RECEIVED_IN_CANADA"], label: "Reçu", description: "Colis enregistré par nos agents", Icon: IconReceived },
    { statuses: ["IN_TRANSIT", "IN_TRANSIT_STOP"], label: "En transit", description: "Le colis a quitté l'origine", Icon: IconPlane },
    { statuses: ["IN_CUSTOMS"], label: "À la douane", description: "Traitement douanier en cours", Icon: IconCustoms },
    { statuses: ["READY_FOR_PICKUP"], label: "Prêt", description: "Disponible pour récupération", Icon: IconBox },
    { statuses: ["DELIVERED"], label: "Récupéré", description: "Colis remis au destinataire", Icon: IconCheck },
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

// Dimensions du SVG de trajectoire
const TRAJ_W = 1000;
const TRAJ_H = 200;
const ARC_AMP = 80; // amplitude verticale de l'arc

/** Position et rotation du point sur la courbe pour un t ∈ [0,1] */
function getPointOnArc(t: number) {
    const x = t * TRAJ_W; // x linéaire
    // y suit -sin(πt) → l'arc monte au milieu (y plus petit en SVG = plus haut)
    const yBase = TRAJ_H - 30; // ligne de base
    const y = yBase - ARC_AMP * Math.sin(Math.PI * t);
    // tangente : dy/dt = -ARC_AMP * π * cos(πt), dx/dt = TRAJ_W
    const dy = -ARC_AMP * Math.PI * Math.cos(Math.PI * t);
    const dx = TRAJ_W;
    const angleRad = Math.atan2(dy, dx);
    return { x, y, angleDeg: (angleRad * 180) / Math.PI };
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

    // Position de l'icône mobile sur la courbe selon le statut métier :
    // - Reçu (0)         → origine (gauche)
    // - En transit (1)   → milieu de la courbe (apex du vol)
    // - À la douane (2)  → destination (le colis a atterri)
    // - Prêt (3)         → destination
    // - Récupéré (4)     → destination
    const STEP_POSITION: Record<number, number> = { 0: 0, 1: 0.5, 2: 1, 3: 1, 4: 1 };
    const t = STEP_POSITION[currentStepIndex] ?? 0;
    const plane = getPointOnArc(t);

    // Path SVG de la courbe (quadratique) — utilisé pour la ligne grise de fond
    // et la ligne rouge de progression
    const arcPath = useMemo(() => {
        const yBase = TRAJ_H - 30;
        // Construit un chemin avec plusieurs points pour rester proche du sin
        const points: string[] = [];
        const N = 60;
        for (let i = 0; i <= N; i++) {
            const tt = i / N;
            const x = tt * TRAJ_W;
            const y = yBase - ARC_AMP * Math.sin(Math.PI * tt);
            points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        return points.join(" ");
    }, []);

    // Path partiel pour la progression (jusqu'au t actuel)
    const arcPathProgress = useMemo(() => {
        const yBase = TRAJ_H - 30;
        const points: string[] = [];
        const N = Math.max(2, Math.floor(60 * t));
        for (let i = 0; i <= N; i++) {
            const tt = (i / N) * t;
            const x = tt * TRAJ_W;
            const y = yBase - ARC_AMP * Math.sin(Math.PI * tt);
            points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        return points.join(" ");
    }, [t]);

    // Drapeaux selon direction
    const originFlag = origin === "NE" ? "/flags/ne.svg" : origin === "CA" ? "/flags/ca.svg" : null;
    const destFlag = destination === "NE" ? "/flags/ne.svg" : destination === "CA" ? "/flags/ca.svg" : null;
    const countryLabel = (c: string) => (c === "NE" ? "Niger" : c === "CA" ? "Canada" : c);

    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            {/* En-tête tracking — gris anthracite + drapeaux direction */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase opacity-70 tracking-widest">Numéro de suivi</p>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-mono font-bold">
                            {trackingId}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            {originFlag && (
                                <img src={originFlag} alt={countryLabel(origin)} className="w-6 h-4 rounded-sm shadow-sm" />
                            )}
                            <span className="text-sm opacity-80">{countryLabel(origin)}</span>
                            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <span className="text-sm opacity-80">{countryLabel(destination)}</span>
                            {destFlag && (
                                <img src={destFlag} alt={countryLabel(destination)} className="w-6 h-4 rounded-sm shadow-sm" />
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs uppercase opacity-70 tracking-widest">Statut actuel</p>
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

            {/* === TRAJECTOIRE COURBE (desktop) === */}
            <div className="hidden md:block relative px-8 pt-8 pb-4">
                <svg
                    viewBox={`0 0 ${TRAJ_W} ${TRAJ_H}`}
                    className="w-full h-44"
                    preserveAspectRatio="none"
                >
                    {/* Ciel décoratif */}
                    <defs>
                        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#e0f2fe" />
                            <stop offset="100%" stopColor="#ffffff" />
                        </linearGradient>
                        <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#8B0000" />
                            <stop offset="100%" stopColor="#DC143C" />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width={TRAJ_W} height={TRAJ_H - 20} fill="url(#sky)" rx="16" />

                    {/* Nuages décoratifs */}
                    <text x="180" y="55" fontSize="32" opacity="0.35">☁</text>
                    <text x="430" y="40" fontSize="28" opacity="0.4">☁</text>
                    <text x="680" y="60" fontSize="32" opacity="0.35">☁</text>
                    <text x="870" y="50" fontSize="24" opacity="0.4">☁</text>

                    {/* Courbe de fond (pointillée) */}
                    <path
                        d={arcPath}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="3"
                        strokeDasharray="6 8"
                        strokeLinecap="round"
                    />

                    {/* Courbe de progression */}
                    {t > 0 && (
                        <path
                            d={arcPathProgress}
                            fill="none"
                            stroke="url(#progressGrad)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            style={{ transition: "all 700ms ease-out" }}
                        />
                    )}

                    {/* Marqueurs début / fin */}
                    <circle cx="0" cy={TRAJ_H - 30} r="8" fill="#8B0000" />
                    <circle cx="0" cy={TRAJ_H - 30} r="14" fill="#8B0000" opacity="0.2" />
                    <circle cx={TRAJ_W} cy={TRAJ_H - 30} r="8" fill="#94a3b8" />
                    <circle cx={TRAJ_W} cy={TRAJ_H - 30} r="14" fill="#94a3b8" opacity="0.2" />
                </svg>

                {/* Icône mobile en position sur la courbe — varie selon l'étape */}
                <div
                    className="absolute pointer-events-none transition-all duration-700 ease-out"
                    style={{
                        left: `calc(${(plane.x / TRAJ_W) * 100}% + 32px)`,
                        top: `calc(${(plane.y / TRAJ_H) * 11}rem + 1rem)`,
                        transform: "translate(-50%, -50%)",
                    }}
                >
                    {currentStepIndex === 1 ? (
                        // En transit → avion qui vole avec rotation tangente
                        <div className="plane-float">
                            <FlyingPlane
                                className="w-12 h-12 text-[#8B0000] drop-shadow-md"
                                style={{ transform: `rotate(${plane.angleDeg}deg)` }}
                            />
                        </div>
                    ) : currentStepIndex === 0 ? (
                        // Reçu → petit badge à l'origine
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconReceived className="w-5 h-5" />
                        </div>
                    ) : currentStepIndex === 2 ? (
                        // À la douane → bouclier (le colis a atterri, traitement douanier)
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconCustoms className="w-6 h-6" />
                        </div>
                    ) : currentStepIndex === 3 ? (
                        // Prêt → boîte à destination
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconBox className="w-6 h-6" />
                        </div>
                    ) : (
                        // Récupéré → coche verte
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 text-white flex items-center justify-center shadow-lg ring-4 ring-green-300">
                            <IconCheck className="w-6 h-6" />
                        </div>
                    )}
                </div>

                {/* Étapes en bas */}
                <div className="grid grid-cols-5 gap-2 mt-2">
                    {TRACKING_STEPS.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;
                        const isActive = index === currentStepIndex;
                        const StepIcon = step.Icon;
                        return (
                            <div key={step.label} className="flex flex-col items-center text-center">
                                <div
                                    className={`w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                                        isCompleted
                                            ? "bg-gradient-to-br from-slate-700 to-slate-900 border-slate-700 text-white shadow-md"
                                            : "bg-white border-gray-300 text-gray-400"
                                    } ${isActive ? "scale-110 ring-4 ring-slate-400/40" : ""}`}
                                >
                                    <StepIcon className="w-6 h-6 lg:w-7 lg:h-7" />
                                </div>
                                <p
                                    className={`mt-2 text-xs lg:text-sm font-semibold ${
                                        isActive ? "text-slate-900" : isCompleted ? "text-gray-900" : "text-gray-400"
                                    }`}
                                >
                                    {step.label}
                                </p>
                                {isActive && !isDelivered && (
                                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-white animate-pulse">
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
                                        ? "bg-gradient-to-br from-slate-700 to-slate-900 border-slate-700 text-white"
                                        : "bg-gray-50 border-gray-300 text-gray-400"
                                } ${isActive ? "ring-4 ring-slate-400/40" : ""}`}
                            >
                                <StepIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <p
                                        className={`font-semibold text-sm ${
                                            isActive ? "text-slate-900" : isCompleted ? "text-gray-900" : "text-gray-400"
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {isActive && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-white animate-pulse">
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

            <style jsx>{`
                @keyframes planeFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-4px); }
                }
                .plane-float {
                    animation: planeFloat 2.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
