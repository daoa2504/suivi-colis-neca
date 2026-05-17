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

interface PaymentEntry {
    id: string;
    amount: number;
    currency: "CAD" | "XOF" | string;
    paidAt: string;
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
    paymentStatus?: "PAID" | "PARTIAL" | "UNPAID" | null;
    amountPaid?: number | null;
    payments?: PaymentEntry[];
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
    paymentStatus,
    amountPaid,
    payments,
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

    // === ETA contextuel (avant/à temps/en retard, ou disponible/en avance) ===
    const etaInfo = useMemo(() => {
        if (!convoyDate) return null;
        const start = new Date(convoyDate);
        const eta = addBusinessDays(start, STANDARD_DELIVERY_DAYS);
        const days = daysUntil(eta);

        // === Cas 1 : colis déjà PRÊT pour récupération ===
        if (currentStatus === "READY_FOR_PICKUP") {
            const readyDate = updatedAt ? new Date(updatedAt) : new Date();
            const diffDays = Math.round(
                (readyDate.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays < -1) {
                return {
                    mode: "ready_early" as const,
                    eta,
                    readyDate,
                    days: -diffDays,
                };
            }
            if (diffDays > 1) {
                return {
                    mode: "ready_late" as const,
                    eta,
                    readyDate,
                    days: diffDays,
                };
            }
            return { mode: "ready_on_time" as const, eta, readyDate, days: 0 };
        }

        // === Cas 2 : colis déjà récupéré (DELIVERED) — on n'affiche pas l'ETA ===
        if (currentStatus === "DELIVERED") {
            return null;
        }

        // === Cas 3 : encore en cours — vérifier retard / dans les délais ===
        if (days < 0) {
            return { mode: "in_progress_late" as const, eta, days: -days };
        }
        return { mode: "in_progress" as const, eta, days };
    }, [convoyDate, currentStatus, updatedAt]);

    // === Timeline d'événements — 5 étapes affichées en permanence ===
    // Chaque étape a un statut : completed (avec ou sans date), current (avec date), future
    const timeline = useMemo(() => {
        type TLItem = {
            label: string;
            date: Date | null;
            state: "completed" | "current" | "future";
            isFuture?: boolean;
        };

        const STAGES = [
            "Colis enregistré par nos agents",
            "En route — convoi parti vers la destination",
            "Arrivé à la douane",
            "Disponible pour récupération",
            "Colis récupéré",
        ];

        const createdDate = createdAt ? new Date(createdAt) : null;
        const updatedDate = updatedAt ? new Date(updatedAt) : null;

        // Construit l'item correspondant à chaque étape
        const items: TLItem[] = STAGES.map((label, idx) => {
            if (idx < currentStepIndex) {
                // Étape complétée — on a la date uniquement pour l'étape 0 (création)
                return {
                    label,
                    date: idx === 0 ? createdDate : null,
                    state: "completed",
                };
            }
            if (idx === currentStepIndex) {
                // Étape courante — date = updatedAt si on a transitionné, sinon createdAt (étape 0)
                return {
                    label,
                    date: idx === 0 ? createdDate : updatedDate ?? createdDate,
                    state: "current",
                };
            }
            // Étape future
            return { label, date: null, state: "future", isFuture: true };
        });

        // Inject ShipmentEvent réels (s'il y en a) pour enrichir avec timestamps précis
        if (events && events.length > 0) {
            for (const ev of events) {
                const matchIdx = STAGES.findIndex((s) =>
                    (ev.description || ev.type).toLowerCase().includes(s.split("—")[0].trim().toLowerCase())
                );
                if (matchIdx >= 0 && !items[matchIdx].date) {
                    items[matchIdx].date = new Date(ev.occurredAt || ev.createdAt);
                }
            }
        }

        return items;
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

            {/* === CARTE ETA — adaptée selon l'état du colis === */}
            {etaInfo && (() => {
                // Détermine couleurs + libellés selon le mode
                const cfg = (() => {
                    switch (etaInfo.mode) {
                        case "ready_early":
                            return {
                                bg: "from-green-500/10 to-emerald-400/10",
                                border: "border-green-500/30",
                                iconBg: "from-green-500 to-emerald-600",
                                titleColor: "text-green-700",
                                title: "Disponible en avance",
                                date: formatDateFR(etaInfo.readyDate!),
                                subtitle: "Statut",
                                detail: `Prêt ${etaInfo.days} jour${etaInfo.days > 1 ? "s" : ""} avant la date prévue`,
                                detailColor: "text-green-700",
                                icon: "check",
                            };
                        case "ready_on_time":
                            return {
                                bg: "from-blue-500/10 to-sky-400/10",
                                border: "border-blue-500/30",
                                iconBg: "from-blue-500 to-sky-600",
                                titleColor: "text-blue-700",
                                title: "Colis disponible",
                                date: formatDateFR(etaInfo.readyDate!),
                                subtitle: "Statut",
                                detail: "Prêt dans les délais — récupérez votre colis",
                                detailColor: "text-blue-700",
                                icon: "box",
                            };
                        case "ready_late":
                            return {
                                bg: "from-amber-500/10 to-orange-400/10",
                                border: "border-amber-500/30",
                                iconBg: "from-amber-500 to-orange-600",
                                titleColor: "text-amber-700",
                                title: "Colis disponible",
                                date: formatDateFR(etaInfo.readyDate!),
                                subtitle: "Statut",
                                detail: `Disponible avec ${etaInfo.days} jour${etaInfo.days > 1 ? "s" : ""} de retard — merci pour votre patience`,
                                detailColor: "text-amber-700",
                                icon: "box",
                            };
                        case "in_progress_late":
                            return {
                                bg: "from-amber-500/10 to-orange-400/10",
                                border: "border-amber-500/30",
                                iconBg: "from-amber-500 to-orange-600",
                                titleColor: "text-amber-700",
                                title: "Récupération prévue",
                                date: formatDateFR(etaInfo.eta),
                                subtitle: "Délai dépassé",
                                detail: `Léger retard de ${etaInfo.days} jour${etaInfo.days > 1 ? "s" : ""} — votre colis arrive bientôt`,
                                detailColor: "text-amber-700",
                                icon: "calendar",
                            };
                        default: // in_progress
                            return {
                                bg: "from-[#8B0000]/5 to-[#DC143C]/5",
                                border: "border-[#8B0000]/15",
                                iconBg: "from-[#8B0000] to-[#DC143C]",
                                titleColor: "text-gray-500",
                                title: "Récupération prévue",
                                date: formatDateFR(etaInfo.eta),
                                subtitle: "Délai estimé",
                                detail:
                                    etaInfo.days > 0
                                        ? `dans ${etaInfo.days} jour${etaInfo.days > 1 ? "s" : ""}`
                                        : "aujourd'hui",
                                detailColor: "text-[#8B0000]",
                                icon: "calendar",
                            };
                    }
                })();

                return (
                    <div className="px-4 sm:px-6 pt-5">
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-lg bg-gradient-to-br ${cfg.bg} border ${cfg.border}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${cfg.iconBg} text-white flex items-center justify-center shadow-md flex-shrink-0`}>
                                    {cfg.icon === "check" ? (
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                    ) : cfg.icon === "box" ? (
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                            <line x1="12" x2="12" y1="22.08" y2="12" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                            <line x1="16" x2="16" y1="2" y2="6" />
                                            <line x1="8" x2="8" y1="2" y2="6" />
                                            <line x1="3" x2="21" y1="10" y2="10" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <p className={`text-xs uppercase tracking-widest font-semibold ${cfg.titleColor}`}>
                                        {cfg.title}
                                    </p>
                                    <p className="text-lg sm:text-xl font-bold text-gray-900">
                                        {cfg.date}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                                    {cfg.subtitle}
                                </p>
                                <p className={`text-base sm:text-lg font-semibold ${cfg.detailColor} max-w-[230px] sm:text-right`}>
                                    {cfg.detail}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

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

            {/* === CARTE PAIEMENT — état + alerte si non payé en totalité === */}
            {paymentStatus && (() => {
                const isPaid = paymentStatus === "PAID";
                const isUnpaid = paymentStatus === "UNPAID";
                // Totaux par devise depuis les paiements
                const totals = (payments || []).reduce<Record<string, number>>((acc, p) => {
                    acc[p.currency] = (acc[p.currency] || 0) + p.amount;
                    return acc;
                }, {});
                const totalEntries = Object.entries(totals);

                const cfg = isPaid
                    ? {
                          bg: "from-green-500/10 to-emerald-400/10",
                          border: "border-green-500/30",
                          iconBg: "from-green-500 to-emerald-600",
                          title: "Paiement effectué",
                          titleColor: "text-green-700",
                          subtitle: "Statut",
                          detail: "Paiement reçu — vous pouvez récupérer votre colis",
                          detailColor: "text-green-700",
                      }
                    : isUnpaid
                        ? {
                              bg: "from-red-500/10 to-rose-400/10",
                              border: "border-red-500/40",
                              iconBg: "from-red-600 to-rose-700",
                              title: "Paiement non effectué",
                              titleColor: "text-red-700",
                              subtitle: "Statut",
                              detail: "Veuillez régler avant la récupération de votre colis",
                              detailColor: "text-red-700",
                          }
                        : {
                              bg: "from-amber-500/10 to-orange-400/10",
                              border: "border-amber-500/30",
                              iconBg: "from-amber-500 to-orange-600",
                              title: "Paiement partiel",
                              titleColor: "text-amber-700",
                              subtitle: "Statut",
                              detail: "Veuillez régler le solde avant la récupération",
                              detailColor: "text-amber-700",
                          };

                return (
                    <div className="px-4 sm:px-6 pt-4">
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-lg bg-gradient-to-br ${cfg.bg} border ${cfg.border}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${cfg.iconBg} text-white flex items-center justify-center shadow-md flex-shrink-0`}>
                                    {isPaid ? (
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="6" width="20" height="12" rx="2" />
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M6 12h.01M18 12h.01" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <p className={`text-xs uppercase tracking-widest font-semibold ${cfg.titleColor}`}>
                                        {cfg.title}
                                    </p>
                                    {totalEntries.length > 0 ? (
                                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                                            {totalEntries
                                                .map(([cur, total]) => `${total.toFixed(2)} ${cur}`)
                                                .join(" · ")}
                                            {!isPaid && (
                                                <span className="text-sm font-normal text-gray-500 ml-2">payé</span>
                                            )}
                                        </p>
                                    ) : isUnpaid ? (
                                        <p className="text-lg sm:text-xl font-bold text-gray-900">
                                            Aucun paiement enregistré
                                        </p>
                                    ) : (
                                        <p className="text-lg sm:text-xl font-bold text-gray-900">—</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                                    {cfg.subtitle}
                                </p>
                                <p className={`text-sm sm:text-base font-semibold ${cfg.detailColor} max-w-[240px] sm:text-right`}>
                                    {cfg.detail}
                                </p>
                            </div>
                        </div>

                        {/* Bandeau d'alerte plus visible si non payé */}
                        {!isPaid && (
                            <div className="mt-3 flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-red-50 border-l-4 border-red-500">
                                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" x2="12" y1="9" y2="13" />
                                    <line x1="12" x2="12.01" y1="17" y2="17" />
                                </svg>
                                <div className="text-sm text-red-800">
                                    <strong>Paiement requis :</strong>{" "}
                                    {isUnpaid
                                        ? "Aucun versement n'a été enregistré. Merci de régler le montant dû avant de récupérer votre colis."
                                        : "Votre paiement est incomplet. Merci de régler le solde restant avant de récupérer votre colis."}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

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
                        <linearGradient
                            id="progressGrad"
                            x1="0"
                            y1="0"
                            x2={TRAJ_W}
                            y2="0"
                            gradientUnits="userSpaceOnUse"
                        >
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

                    {/* Ligne de progression — pleine, du début jusqu'à l'avion */}
                    {t > 0 && (
                        <line
                            x1="0"
                            y1={LINE_Y}
                            x2={t * TRAJ_W}
                            y2={LINE_Y}
                            stroke="url(#progressGrad)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            style={{ transition: "all 700ms ease-out" }}
                        />
                    )}

                    {/* Ligne restante — pointillée, après l'avion jusqu'à la destination */}
                    {t < 1 && (
                        <line
                            x1={t * TRAJ_W}
                            y1={LINE_Y}
                            x2={TRAJ_W}
                            y2={LINE_Y}
                            stroke="#cbd5e1"
                            strokeWidth="3"
                            strokeDasharray="6 8"
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

            {/* === VERSION MOBILE — timeline verticale avec trajectoire === */}
            <div className="md:hidden p-4">
                <div className="relative">
                    {/* Ligne verticale de fond (avant et après l'avion) */}
                    <div className="absolute left-6 top-6 bottom-6 w-0.5 -translate-x-1/2 pointer-events-none">
                        {/* Segment parcouru (plein, du haut jusqu'à l'étape active) */}
                        <div
                            className="absolute left-0 right-0 top-0 bg-gradient-to-b from-[#8B0000] to-[#DC143C] rounded-full transition-all duration-700"
                            style={{
                                height: `${(currentStepIndex / (TRACKING_STEPS.length - 1)) * 100}%`,
                            }}
                        />
                        {/* Segment restant (pointillé, vertical) */}
                        <div
                            className="absolute left-0 right-0 bottom-0 rounded-full transition-all duration-700"
                            style={{
                                height: `${((TRACKING_STEPS.length - 1 - currentStepIndex) / (TRACKING_STEPS.length - 1)) * 100}%`,
                                backgroundImage:
                                    "repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 6px, transparent 6px, transparent 14px)",
                            }}
                        />
                    </div>

                    {/* Étapes */}
                    <div className="space-y-5">
                        {TRACKING_STEPS.map((step, index) => {
                            const isCompleted = index <= currentStepIndex;
                            const isActive = index === currentStepIndex;
                            const StepIcon = step.Icon;
                            return (
                                <div key={step.label} className="flex items-start gap-4 relative">
                                    <div
                                        className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all duration-300 ${
                                            isCompleted
                                                ? "bg-gradient-to-br from-slate-700 to-slate-900 border-slate-700 text-white shadow-md"
                                                : "bg-white border-gray-300 text-gray-400"
                                        } ${isActive ? "scale-110 ring-4 ring-[#DC143C]/30" : ""}`}
                                    >
                                        <StepIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 pt-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p
                                                className={`font-semibold text-sm ${
                                                    isActive
                                                        ? "text-slate-900"
                                                        : isCompleted
                                                            ? "text-gray-900"
                                                            : "text-gray-400"
                                                }`}
                                            >
                                                {step.label}
                                            </p>
                                            {isActive && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-white animate-pulse">
                                                    En cours
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                                    </div>

                                    {/* Avion / badge contextuel à droite de l'étape active */}
                                    {isActive && !isDelivered && (
                                        <div className="absolute right-0 top-1 plane-float">
                                            {currentStepIndex === 1 ? (
                                                <FlyingPlane
                                                    className="w-10 h-10 text-[#8B0000] drop-shadow-md"
                                                    style={{ transform: "rotate(-25deg)" }}
                                                />
                                            ) : currentStepIndex === 0 ? (
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center shadow-md">
                                                    <IconReceived className="w-5 h-5" />
                                                </div>
                                            ) : currentStepIndex === 2 ? (
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-md">
                                                    <IconCustoms className="w-5 h-5" />
                                                </div>
                                            ) : currentStepIndex === 3 ? (
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md">
                                                    <IconBox className="w-5 h-5" />
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {/* Coche verte sur l'étape récupérée */}
                                    {isActive && isDelivered && (
                                        <div className="absolute right-0 top-1">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-700 text-white flex items-center justify-center shadow-md ring-2 ring-green-300">
                                                <IconCheck className="w-5 h-5" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* === TIMELINE D'ÉVÉNEMENTS — 5 étapes affichées en permanence === */}
            {timeline.length > 0 && (
                <div className="px-4 sm:px-6 pt-6 pb-6">
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
                        Chronologie
                    </h3>
                    <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5">
                        {timeline.map((item, idx) => {
                            const isFuture = item.state === "future";
                            const isCurrent = item.state === "current";
                            const isCompleted = item.state === "completed";

                            return (
                                <li key={idx} className="ml-5">
                                    <span
                                        className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-white ${
                                            isFuture
                                                ? "bg-gray-300"
                                                : isCurrent
                                                    ? "bg-gradient-to-br from-[#8B0000] to-[#DC143C] ring-[#DC143C]/20"
                                                    : "bg-gradient-to-br from-slate-600 to-slate-800"
                                        }`}
                                    />
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <p
                                            className={`text-sm font-semibold ${
                                                isFuture
                                                    ? "text-gray-400"
                                                    : isCurrent
                                                        ? "text-slate-900"
                                                        : "text-gray-800"
                                            }`}
                                        >
                                            {item.label}
                                        </p>
                                        {item.date ? (
                                            <time className="text-xs text-gray-500 font-mono">
                                                {formatDateTimeFR(item.date)}
                                            </time>
                                        ) : isFuture ? (
                                            <span className="text-[10px] uppercase tracking-widest text-gray-400">
                                                Prochaine étape
                                            </span>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-widest text-gray-400">
                                                Complété
                                            </span>
                                        )}
                                        {isCurrent && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-white animate-pulse">
                                                En cours
                                            </span>
                                        )}
                                    </div>
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
