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

interface ShipmentEvent {
    id: string;
    type: string;
    description: string | null;
    location: string | null;
    occurredAt: string | null;
    createdAt: string;
}

interface ShipmentTrackerProps {
    currentStatus: ShipmentStatus;
    origin: string;
    destination: string;
    weight: number;
    pieces: number;
    trackingId: string;
    receiverCity?: string | null;
    convoyDate?: string | null;
    events?: ShipmentEvent[];
    createdAt?: string | null;
    updatedAt?: string | null;
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

// Délai standard de livraison (jours ouvrables)
const STANDARD_DELIVERY_DAYS = 7;

function addBusinessDays(start: Date, days: number) {
    const d = new Date(start);
    let added = 0;
    while (added < days) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) added++;
    }
    return d;
}

function formatDateFR(d: Date) {
    return d.toLocaleDateString("fr-CA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

function formatDateTimeFR(d: Date | string) {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString("fr-CA", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

function daysUntil(target: Date) {
    const now = new Date();
    const ms = target.getTime() - now.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function ShipmentTracker({
    currentStatus,
    origin,
    destination,
    weight,
    trackingId,
    receiverCity,
    convoyDate,
    events,
    createdAt,
    updatedAt,
}: ShipmentTrackerProps) {
    const currentStepIndex = useMemo(() => {
        const i = TRACKING_STEPS.findIndex((step) => step.statuses.includes(currentStatus));
        return i >= 0 ? i : 0;
    }, [currentStatus]);

    const isDelivered = currentStatus === "DELIVERED";

    // Position de l'icône mobile — alignée sur l'étape (1 position = 1 étape)
    // pour que l'avion / le badge soit toujours juste au-dessus de l'icône de l'étape active
    const STEP_POSITION: Record<number, number> = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1 };
    const t = STEP_POSITION[currentStepIndex] ?? 0;
    // Ligne horizontale plate : x linéaire, y fixe
    const LINE_Y = TRAJ_H - 30;
    const plane = { x: t * TRAJ_W, y: LINE_Y, angleDeg: 0 };

    // === ETA ===
    const etaInfo = useMemo(() => {
        if (!convoyDate) return null;
        const start = new Date(convoyDate);
        const eta = addBusinessDays(start, STANDARD_DELIVERY_DAYS);
        const days = daysUntil(eta);
        return { eta, days };
    }, [convoyDate]);

    // === Timeline d'événements ===
    // Combine ShipmentEvent + transitions implicites depuis createdAt / status
    const timeline = useMemo(() => {
        const items: { label: string; date: Date; description?: string; isFuture?: boolean }[] = [];

        // Création
        if (createdAt) {
            items.push({
                label: "Colis enregistré par nos agents",
                date: new Date(createdAt),
            });
        }

        // Événements ShipmentEvent explicites
        if (events && events.length > 0) {
            for (const ev of events) {
                items.push({
                    label: ev.description || ev.type,
                    date: new Date(ev.occurredAt || ev.createdAt),
                    description: ev.location || undefined,
                });
            }
        }

        // Dernière mise à jour si elle apporte une info (statut transitionné via notify)
        if (updatedAt && currentStepIndex > 0) {
            const lastLabel: Record<number, string> = {
                1: "En route — convoi parti vers la destination",
                2: "Arrivé à la douane",
                3: "Disponible pour récupération",
                4: "Colis récupéré par le destinataire",
            };
            const label = lastLabel[currentStepIndex];
            const updateDate = new Date(updatedAt);
            const exists = items.find(
                (i) => Math.abs(i.date.getTime() - updateDate.getTime()) < 5_000 && i.label === label
            );
            if (label && !exists) {
                items.push({ label, date: updateDate });
            }
        }

        // Étapes futures (placeholders) — incluent toujours "Colis récupéré" en dernier
        const futureLabels: Record<number, string[]> = {
            0: ["Convoi en route", "Arrivée à la douane", "Prêt pour récupération", "Colis récupéré"],
            1: ["Arrivée à la douane", "Prêt pour récupération", "Colis récupéré"],
            2: ["Prêt pour récupération", "Colis récupéré"],
            3: ["Colis récupéré"],
            4: [],
        };
        const today = new Date();
        for (const f of futureLabels[currentStepIndex] ?? []) {
            items.push({ label: f, date: today, isFuture: true });
        }

        // Tri chronologique
        return items.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [createdAt, updatedAt, events, currentStepIndex]);

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

            {/* === CARTE ETA — Estimation de livraison === */}
            {etaInfo && !isDelivered && (
                <div className="px-4 sm:px-6 pt-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-lg bg-gradient-to-br from-[#8B0000]/5 to-[#DC143C]/5 border border-[#8B0000]/15">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B0000] to-[#DC143C] text-white flex items-center justify-center shadow-md flex-shrink-0">
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" />
                                    <line x1="16" x2="16" y1="2" y2="6" />
                                    <line x1="8" x2="8" y1="2" y2="6" />
                                    <line x1="3" x2="21" y1="10" y2="10" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                                    Récupération prévue
                                </p>
                                <p className="text-lg sm:text-xl font-bold text-gray-900">
                                    {formatDateFR(etaInfo.eta)}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                                Délai estimé
                            </p>
                            <p className="text-lg font-semibold text-[#8B0000]">
                                {etaInfo.days > 0
                                    ? `dans ${etaInfo.days} jour${etaInfo.days > 1 ? "s" : ""}`
                                    : etaInfo.days === 0
                                        ? "aujourd'hui"
                                        : "à confirmer"}
                            </p>
                        </div>
                    </div>
                </div>
            )}

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

            {/* === TRAJECTOIRE HORIZONTALE COURBE (desktop) === */}
            <div className="hidden md:block relative px-8 pt-8 pb-4">
                <svg
                    viewBox={`0 0 ${TRAJ_W} ${TRAJ_H}`}
                    className="w-full h-44"
                    preserveAspectRatio="none"
                >
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

                    {/* Ligne horizontale de fond (pointillée) */}
                    <line
                        x1="0"
                        y1={LINE_Y}
                        x2={TRAJ_W}
                        y2={LINE_Y}
                        stroke="#cbd5e1"
                        strokeWidth="3"
                        strokeDasharray="6 8"
                        strokeLinecap="round"
                    />

                    {/* Ligne de progression */}
                    {t > 0 && (
                        <line
                            x1="0"
                            y1={LINE_Y}
                            x2={t * TRAJ_W}
                            y2={LINE_Y}
                            stroke="url(#progressGrad)"
                            strokeWidth="4"
                            strokeLinecap="round"
                            style={{ transition: "all 700ms ease-out" }}
                        />
                    )}

                    {/* Marqueurs début / fin */}
                    <circle cx="0" cy={LINE_Y} r="8" fill="#8B0000" />
                    <circle cx="0" cy={LINE_Y} r="14" fill="#8B0000" opacity="0.2" />
                    <circle cx={TRAJ_W} cy={LINE_Y} r="8" fill="#94a3b8" />
                    <circle cx={TRAJ_W} cy={LINE_Y} r="14" fill="#94a3b8" opacity="0.2" />
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
                        // En transit → avion en décollage (nose-up fixe, plus dynamique)
                        <div className="plane-float">
                            <FlyingPlane
                                className="w-12 h-12 text-[#8B0000] drop-shadow-md"
                                style={{ transform: "rotate(-25deg)" }}
                            />
                        </div>
                    ) : currentStepIndex === 0 ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconReceived className="w-5 h-5" />
                        </div>
                    ) : currentStepIndex === 2 ? (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconCustoms className="w-6 h-6" />
                        </div>
                    ) : currentStepIndex === 3 ? (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-lg ring-4 ring-white">
                            <IconBox className="w-6 h-6" />
                        </div>
                    ) : (
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

            {/* === TIMELINE D'ÉVÉNEMENTS === */}
            {timeline.length > 0 && (
                <div className="px-4 sm:px-6 pt-6 pb-6">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
                        Chronologie
                    </h3>
                    <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5">
                        {timeline.map((item, idx) => {
                            const isFuture = !!item.isFuture;
                            return (
                                <li key={idx} className="ml-5">
                                    <span
                                        className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${
                                            isFuture
                                                ? "bg-gray-300"
                                                : "bg-gradient-to-br from-[#8B0000] to-[#DC143C]"
                                        }`}
                                    />
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <p
                                            className={`text-sm font-semibold ${
                                                isFuture ? "text-gray-400" : "text-gray-900"
                                            }`}
                                        >
                                            {item.label}
                                        </p>
                                        {!isFuture && (
                                            <time className="text-xs text-gray-500 font-mono">
                                                {formatDateTimeFR(item.date)}
                                            </time>
                                        )}
                                        {isFuture && (
                                            <span className="text-[10px] uppercase tracking-widest text-gray-400">
                                                Prochaine étape
                                            </span>
                                        )}
                                    </div>
                                    {item.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}

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
