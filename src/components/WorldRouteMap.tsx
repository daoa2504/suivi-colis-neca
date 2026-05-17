// src/components/WorldRouteMap.tsx
"use client";

import { useMemo } from "react";

/**
 * Carte du monde simplifiée (Afrique-Atlantique-Amérique du Nord)
 * Projection Mercator approchée, focalisée sur la zone utile.
 *
 * - Plot lat/lng → SVG x/y via une projection Mercator dans le viewBox 1000x500
 * - Cadrage : lat 5°N à 65°N, lng -130°W à 30°E
 */
const VIEW_W = 1000;
const VIEW_H = 500;
const MIN_LNG = -130;
const MAX_LNG = 30;
const MIN_LAT = 5;
const MAX_LAT = 65;

// Mercator y projection (radians)
function mercY(latDeg: number) {
    const lat = (latDeg * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}
const MERC_MIN_Y = mercY(MIN_LAT);
const MERC_MAX_Y = mercY(MAX_LAT);

function project(lat: number, lng: number) {
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * VIEW_W;
    const y = VIEW_H - ((mercY(lat) - MERC_MIN_Y) / (MERC_MAX_Y - MERC_MIN_Y)) * VIEW_H;
    return { x, y };
}

// Coordonnées des principales villes utilisées par NIMAPLEX
const CITY_COORDS: Record<string, { lat: number; lng: number; country: "CA" | "NE" }> = {
    Niamey: { lat: 13.5117, lng: 2.1252, country: "NE" },
    Montréal: { lat: 45.5017, lng: -73.5673, country: "CA" },
    Montreal: { lat: 45.5017, lng: -73.5673, country: "CA" },
    Québec: { lat: 46.8139, lng: -71.208, country: "CA" },
    Quebec: { lat: 46.8139, lng: -71.208, country: "CA" },
    Sherbrooke: { lat: 45.4042, lng: -71.8929, country: "CA" },
    Laval: { lat: 45.6066, lng: -73.7124, country: "CA" },
    Gatineau: { lat: 45.4765, lng: -75.7013, country: "CA" },
    Longueuil: { lat: 45.5311, lng: -73.5187, country: "CA" },
    Saguenay: { lat: 48.4198, lng: -71.0664, country: "CA" },
    Lévis: { lat: 46.7382, lng: -71.2465, country: "CA" },
    "Trois-Rivières": { lat: 46.3432, lng: -72.5432, country: "CA" },
    Terrebonne: { lat: 45.7, lng: -73.65, country: "CA" },
    Drummondville: { lat: 45.886, lng: -72.483, country: "CA" },
    "Saint-Jérôme": { lat: 45.78, lng: -74.0, country: "CA" },
    Rimouski: { lat: 48.4488, lng: -68.5236, country: "CA" },
};
// Fallback : centre du Canada (Ottawa) si la ville exacte est inconnue
const CA_FALLBACK = { lat: 45.4215, lng: -75.6972, country: "CA" as const };

function getCityCoords(
    cityName: string | null,
    country: "CA" | "NE"
): { lat: number; lng: number; label: string; country: "CA" | "NE" } {
    if (country === "NE") {
        return { ...CITY_COORDS["Niamey"], label: "Niamey" };
    }
    if (cityName && CITY_COORDS[cityName]) {
        return { ...CITY_COORDS[cityName], label: cityName };
    }
    return { ...CA_FALLBACK, label: cityName || "Canada" };
}

/** Renvoie un point sur l'arc grand-cercle entre A et B paramétré par t ∈ [0,1]. */
function pointOnGreatCircleArc(
    a: { x: number; y: number },
    b: { x: number; y: number },
    t: number,
    arcHeight = 80
) {
    // Approximation : arc parabolique vertical par-dessus la ligne droite
    const x = a.x + (b.x - a.x) * t;
    const yLine = a.y + (b.y - a.y) * t;
    const yArc = yLine - arcHeight * Math.sin(Math.PI * t);
    // tangente approximative
    const dx = b.x - a.x;
    const dy = (b.y - a.y) - arcHeight * Math.PI * Math.cos(Math.PI * t);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    return { x, y: yArc, angleDeg };
}

// --- Continents approximatifs (paths) — Africa & North America focalisés ---
// Ces shapes sont volontairement simplifiés (silhouettes), pas de précision géographique.
const CONTINENTS_PATH = `
  M 38 110 L 60 90 L 100 80 L 145 75 L 175 80 L 210 92 L 235 110 L 250 130 L 245 160 L 255 195 L 245 230 L 220 255 L 180 270 L 155 260 L 130 270 L 95 285 L 90 300 L 100 320 L 110 340 L 95 360 L 75 370 L 55 360 L 40 335 L 35 305 L 30 270 L 28 235 L 30 200 L 35 165 L 32 138 Z
  M 160 35 L 200 30 L 245 32 L 290 38 L 320 50 L 305 70 L 280 78 L 250 75 L 215 70 L 180 65 L 155 55 Z
  M 460 60 L 500 50 L 550 45 L 600 50 L 640 60 L 660 75 L 670 95 L 680 120 L 670 145 L 650 160 L 620 165 L 600 180 L 615 200 L 615 220 L 590 235 L 565 230 L 540 215 L 525 205 L 510 195 L 490 195 L 470 200 L 460 185 L 470 170 L 480 155 L 475 130 L 470 110 L 465 90 L 462 78 Z
  M 690 80 L 720 78 L 750 82 L 760 100 L 750 115 L 730 120 L 705 115 L 695 100 Z
`;

export default function WorldRouteMap({
    originCountry,
    destinationCountry,
    receiverCity,
    progress, // 0 to 1
    statusLabel,
}: {
    originCountry: "NE" | "CA" | string;
    destinationCountry: "NE" | "CA" | string;
    receiverCity: string | null;
    progress: number;
    statusLabel: string;
}) {
    const origin = useMemo(
        () => getCityCoords(originCountry === "CA" ? receiverCity : null, originCountry as "NE" | "CA"),
        [originCountry, receiverCity]
    );
    const destination = useMemo(
        () => getCityCoords(destinationCountry === "CA" ? receiverCity : null, destinationCountry as "NE" | "CA"),
        [destinationCountry, receiverCity]
    );

    const A = project(origin.lat, origin.lng);
    const B = project(destination.lat, destination.lng);

    // Path SVG de l'arc complet
    const arcPath = useMemo(() => {
        const points: string[] = [];
        const N = 50;
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const p = pointOnGreatCircleArc(A, B, t);
            points.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
        }
        return points.join(" ");
    }, [A.x, A.y, B.x, B.y]);

    // Path de progression jusqu'à `progress`
    const progressPath = useMemo(() => {
        if (progress <= 0) return "";
        const points: string[] = [];
        const N = Math.max(2, Math.floor(50 * progress));
        for (let i = 0; i <= N; i++) {
            const t = (i / N) * progress;
            const p = pointOnGreatCircleArc(A, B, t);
            points.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
        }
        return points.join(" ");
    }, [A.x, A.y, B.x, B.y, progress]);

    const planePoint = pointOnGreatCircleArc(A, B, progress);
    const isDelivered = progress >= 1 && statusLabel.toLowerCase().includes("récup");

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="w-full h-auto rounded-2xl"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dbeafe" />
                        <stop offset="100%" stopColor="#eff6ff" />
                    </linearGradient>
                    <linearGradient id="continentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f8fafc" />
                        <stop offset="100%" stopColor="#e2e8f0" />
                    </linearGradient>
                    <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8B0000" />
                        <stop offset="100%" stopColor="#DC143C" />
                    </linearGradient>
                </defs>

                {/* Océan / fond */}
                <rect width={VIEW_W} height={VIEW_H} fill="url(#oceanGrad)" />

                {/* Grille discrète (latitudes) */}
                {[15, 30, 45, 60].map((latVal) => {
                    const y = project(latVal, 0).y;
                    return (
                        <line
                            key={latVal}
                            x1={0}
                            y1={y}
                            x2={VIEW_W}
                            y2={y}
                            stroke="#cbd5e1"
                            strokeOpacity="0.4"
                            strokeDasharray="4 6"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Continents stylisés */}
                <path
                    d={CONTINENTS_PATH}
                    fill="url(#continentGrad)"
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeOpacity="0.7"
                />

                {/* Arc de trajectoire (fond pointillé) */}
                <path
                    d={arcPath}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2.5"
                    strokeDasharray="5 7"
                    strokeLinecap="round"
                />

                {/* Arc de progression */}
                {progressPath && (
                    <path
                        d={progressPath}
                        fill="none"
                        stroke="url(#arcGrad)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        style={{ transition: "all 700ms ease-out" }}
                    />
                )}

                {/* Marqueur origine */}
                <g>
                    <circle cx={A.x} cy={A.y} r="14" fill="#8B0000" opacity="0.25" />
                    <circle cx={A.x} cy={A.y} r="7" fill="#8B0000" />
                    <circle cx={A.x} cy={A.y} r="3" fill="white" />
                    <text
                        x={A.x + 14}
                        y={A.y + 5}
                        fontSize="16"
                        fontWeight="600"
                        fill="#1f2937"
                    >
                        {origin.label}
                    </text>
                    <text
                        x={A.x + 14}
                        y={A.y + 22}
                        fontSize="12"
                        fill="#64748b"
                    >
                        {origin.country === "NE" ? "Niger" : "Canada"} • Origine
                    </text>
                </g>

                {/* Marqueur destination */}
                <g>
                    <circle cx={B.x} cy={B.y} r="14" fill="#0f172a" opacity="0.18" />
                    <circle cx={B.x} cy={B.y} r="7" fill="#0f172a" />
                    <circle cx={B.x} cy={B.y} r="3" fill="white" />
                    <text
                        x={B.x - 14}
                        y={B.y + 5}
                        fontSize="16"
                        fontWeight="600"
                        fill="#1f2937"
                        textAnchor="end"
                    >
                        {destination.label}
                    </text>
                    <text
                        x={B.x - 14}
                        y={B.y + 22}
                        fontSize="12"
                        fill="#64748b"
                        textAnchor="end"
                    >
                        {destination.country === "NE" ? "Niger" : "Canada"} • Destination
                    </text>
                </g>

                {/* Avion ou check sur l'arc */}
                {!isDelivered ? (
                    <g
                        style={{ transition: "all 700ms ease-out" }}
                        transform={`translate(${planePoint.x} ${planePoint.y}) rotate(${planePoint.angleDeg})`}
                    >
                        <g transform="translate(-18 -18)">
                            <svg viewBox="0 0 16 16" width="36" height="36" overflow="visible">
                                <g transform="rotate(90 8 8)">
                                    <path
                                        fill="#8B0000"
                                        d="M6.428 1.151C6.708.591 7.213 0 8 0s1.292.592 1.572 1.151C9.852 1.71 10 2.36 10 3v3.691l5.17 2.585a1.5 1.5 0 0 1 .83 1.342V12a.5.5 0 0 1-.582.493l-5.507-.918-.375 2.253 1.318 1.318A.5.5 0 0 1 10.5 16h-5a.5.5 0 0 1-.354-.854l1.318-1.318-.375-2.253-5.507.918A.5.5 0 0 1 0 12v-1.382a1.5 1.5 0 0 1 .83-1.342L6 6.691V3c0-.64.148-1.29.428-1.849Z"
                                    />
                                </g>
                            </svg>
                        </g>
                    </g>
                ) : (
                    <g transform={`translate(${B.x} ${B.y - 30})`}>
                        <circle r="18" fill="#16a34a" />
                        <circle r="22" fill="#16a34a" opacity="0.3" />
                        <path
                            d="M -7 0 L -2 5 L 8 -5"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </g>
                )}
            </svg>
        </div>
    );
}
