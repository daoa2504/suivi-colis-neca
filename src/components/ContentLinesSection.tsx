// src/components/ContentLinesSection.tsx
//
// Section « Contenu de l'envoi » : une liste de lignes, chacune étant soit un
// colis, soit un appareil. Un même client peut donc confier un carton de
// vêtements ET une télévision en une seule saisie, sous un seul numéro de
// suivi — il récupère tout ensemble.
//
// Remplace ContentKindSection, qui n'admettait qu'une nature par envoi.
//
// Le composant est contrôlé par son parent : il n'expose pas de champs
// nommés pour FormData, car un tableau de longueur variable ne s'y prête pas.
// Les trois formulaires lisent donc `onChange`.

"use client";

import { useEffect, useRef, useState } from "react";
import { DEVICE_TYPES, DEVICE_TYPE_OTHER, type ItemKind } from "@/lib/itemKind";

export type ContentLine = {
    /** Clé de rendu, pas envoyée au serveur. */
    key: string;
    itemKind: Exclude<ItemKind, "MIXED">;
    label: string;
    quantity: string;
    weightKg: string;
    deviceType: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
};

export type ContentValue = {
    lines: ContentLine[];
    packageCount: string;
};

let seq = 0;
const nextKey = () => `l${++seq}`;

export function emptyLine(itemKind: Exclude<ItemKind, "MIXED"> = "PARCEL"): ContentLine {
    return {
        key: nextKey(),
        itemKind,
        label: "",
        quantity: "1",
        weightKg: "",
        deviceType: "",
        lengthCm: "",
        widthCm: "",
        heightCm: "",
    };
}

/** Champ numérique de formulaire → nombre ou null. */
function num(s: string): number | null {
    const t = (s ?? "").trim();
    if (!t) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

/**
 * Convertit les lignes saisies en charge utile pour l'API.
 * Partagé par les trois formulaires, pour qu'ils envoient tous la même forme.
 */
export function toApiItems(lines: ContentLine[]) {
    return lines.map((l) => ({
        itemKind: l.itemKind,
        label: l.label.trim(),
        quantity: num(l.quantity) ?? 1,
        weightKg: num(l.weightKg),
        deviceType: l.deviceType.trim() || null,
        lengthCm: num(l.lengthCm),
        widthCm: num(l.widthCm),
        heightCm: num(l.heightCm),
    }));
}

/** Reconstruit les lignes d'édition à partir de ce que renvoie la base. */
export function fromApiItems(
    items: {
        itemKind?: string | null;
        label?: string | null;
        quantity?: number | null;
        weightKg?: number | null;
        deviceType?: string | null;
        lengthCm?: number | null;
        widthCm?: number | null;
        heightCm?: number | null;
    }[]
): ContentLine[] {
    if (!items?.length) return [emptyLine()];
    return items.map((it) => ({
        key: nextKey(),
        itemKind: it.itemKind === "DEVICE" ? "DEVICE" : "PARCEL",
        label: it.label ?? "",
        quantity: String(it.quantity ?? 1),
        weightKg: it.weightKg?.toString() ?? "",
        deviceType: it.deviceType ?? "",
        lengthCm: it.lengthCm?.toString() ?? "",
        widthCm: it.widthCm?.toString() ?? "",
        heightCm: it.heightCm?.toString() ?? "",
    }));
}

/** Un type connu va dans le <select> ; tout le reste bascule sur « Autre ». */
function splitDeviceType(deviceType: string): { selected: string; other: string } {
    if (!deviceType) return { selected: "", other: "" };
    return (DEVICE_TYPES as readonly string[]).includes(deviceType)
        ? { selected: deviceType, other: "" }
        : { selected: DEVICE_TYPE_OTHER, other: deviceType };
}

export default function ContentLinesSection({
    resetSignal = 0,
    initial,
    onChange,
}: {
    resetSignal?: number;
    initial?: Partial<ContentValue>;
    onChange: (value: ContentValue) => void;
}) {
    const [lines, setLines] = useState<ContentLine[]>(
        initial?.lines?.length ? initial.lines : [emptyLine()]
    );
    const [packageCount, setPackageCount] = useState(initial?.packageCount || "1");

    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setLines([emptyLine()]);
        setPackageCount("1");
    }, [resetSignal]);

    useEffect(() => {
        onChange({ lines, packageCount });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lines, packageCount]);

    function patch(key: string, changes: Partial<ContentLine>) {
        setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));
    }

    function addLine(kind: Exclude<ItemKind, "MIXED">) {
        setLines((prev) => [...prev, emptyLine(kind)]);
    }

    function removeLine(key: string) {
        setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
    }

    const parcels = lines.filter((l) => l.itemKind === "PARCEL").length;
    const devices = lines.filter((l) => l.itemKind === "DEVICE").length;

    return (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="label text-sm font-medium text-neutral-700">
                    Contenu de l'envoi <span className="text-red-600">*</span>
                </span>
                <span className="text-xs text-neutral-500">
                    {parcels > 0 && `${parcels} colis`}
                    {parcels > 0 && devices > 0 && " · "}
                    {devices > 0 && `${devices} appareil${devices > 1 ? "s" : ""}`}
                </span>
            </div>

            <div className="space-y-3">
                {lines.map((line, index) => (
                    <LineCard
                        key={line.key}
                        line={line}
                        index={index}
                        canRemove={lines.length > 1}
                        onPatch={(changes) => patch(line.key, changes)}
                        onRemove={() => removeLine(line.key)}
                    />
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => addLine("PARCEL")}
                    className="px-3 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-700 hover:border-neutral-500 transition-colors"
                >
                    📦 Ajouter un colis
                </button>
                <button
                    type="button"
                    onClick={() => addLine("DEVICE")}
                    className="px-3 py-1.5 rounded-md border border-neutral-300 bg-white text-sm font-medium text-neutral-700 hover:border-neutral-500 transition-colors"
                >
                    🔌 Ajouter un appareil
                </button>
            </div>

            <div className="border-t border-neutral-200 pt-3">
                <label
                    htmlFor="packageCount"
                    className="label block mb-1 text-sm font-medium text-neutral-700"
                >
                    Nombre de cartons remis <span className="text-red-600">*</span>
                </label>
                <input
                    id="packageCount"
                    required
                    type="number"
                    step="1"
                    min="1"
                    value={packageCount}
                    onChange={(e) => setPackageCount(e.target.value)}
                    className="input border p-2 w-full rounded"
                />
                <p className="mt-1 text-xs text-neutral-500">
                    Colis physiques, tous contenus confondus. C'est ce compte qui figure sur la
                    liste de colisage présentée en douane.
                </p>
            </div>
        </div>
    );
}

function LineCard({
    line,
    index,
    canRemove,
    onPatch,
    onRemove,
}: {
    line: ContentLine;
    index: number;
    canRemove: boolean;
    onPatch: (changes: Partial<ContentLine>) => void;
    onRemove: () => void;
}) {
    const isDevice = line.itemKind === "DEVICE";
    const split = splitDeviceType(line.deviceType);
    const [selectedType, setSelectedType] = useState(split.selected);
    const [otherType, setOtherType] = useState(split.other);
    const isOther = selectedType === DEVICE_TYPE_OTHER;

    function applyType(selected: string, other: string) {
        setSelectedType(selected);
        setOtherType(other);
        onPatch({
            deviceType: selected === DEVICE_TYPE_OTHER ? other.trim() : selected,
        });
    }

    return (
        <div
            className={`rounded-md border p-3 space-y-3 ${
                isDevice ? "border-amber-200 bg-amber-50/40" : "border-neutral-200 bg-neutral-50/60"
            }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{isDevice ? "🔌" : "📦"}</span>
                    <span className="text-sm font-semibold text-neutral-800">
                        {isDevice ? "Appareil" : "Colis"} {index + 1}
                    </span>
                </div>
                {canRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-xs text-red-600 hover:underline"
                    >
                        Retirer
                    </button>
                )}
            </div>

            {isDevice ? (
                <>
                    <div>
                        <label className="label block mb-1 text-xs font-medium text-neutral-700">
                            Type d'appareil <span className="text-red-600">*</span>
                        </label>
                        <select
                            required
                            value={selectedType}
                            onChange={(e) => applyType(e.target.value, otherType)}
                            className="input border p-2 w-full rounded bg-white text-sm"
                        >
                            <option value="">— Sélectionner —</option>
                            {DEVICE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                            <option value={DEVICE_TYPE_OTHER}>Autre (préciser)</option>
                        </select>
                    </div>

                    {isOther && (
                        <div>
                            <label className="label block mb-1 text-xs font-medium text-neutral-700">
                                Préciser le type <span className="text-red-600">*</span>
                            </label>
                            <input
                                required
                                value={otherType}
                                onChange={(e) => applyType(DEVICE_TYPE_OTHER, e.target.value)}
                                placeholder="ex : four à micro-ondes"
                                className="input border p-2 w-full rounded text-sm"
                            />
                        </div>
                    )}

                    <div>
                        <span className="label block mb-1 text-xs font-medium text-neutral-700">
                            Dimensions{" "}
                            <span className="text-neutral-400 font-normal">(optionnel, cm)</span>
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                            <NumInput
                                label="Longueur"
                                value={line.lengthCm}
                                onChange={(v) => onPatch({ lengthCm: v })}
                            />
                            <NumInput
                                label="Largeur"
                                value={line.widthCm}
                                onChange={(v) => onPatch({ widthCm: v })}
                            />
                            <NumInput
                                label="Hauteur"
                                value={line.heightCm}
                                onChange={(v) => onPatch({ heightCm: v })}
                            />
                        </div>
                    </div>
                </>
            ) : (
                <div>
                    <label className="label block mb-1 text-xs font-medium text-neutral-700">
                        Description du contenu <span className="text-red-600">*</span>
                    </label>
                    <input
                        required
                        value={line.label}
                        onChange={(e) => onPatch({ label: e.target.value })}
                        placeholder="ex : vêtements, produits d'hygiène"
                        className="input border p-2 w-full rounded text-sm"
                    />
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="label block mb-1 text-xs font-medium text-neutral-700">
                        Quantité
                    </label>
                    <input
                        type="number"
                        step="1"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => onPatch({ quantity: e.target.value })}
                        className="input border p-2 w-full rounded text-sm"
                    />
                </div>
                <div>
                    <label className="label block mb-1 text-xs font-medium text-neutral-700">
                        Poids (kg){" "}
                        {isDevice ? (
                            <span className="text-neutral-400 font-normal">(optionnel)</span>
                        ) : (
                            <span className="text-red-600">*</span>
                        )}
                    </label>
                    <input
                        required={!isDevice}
                        type="number"
                        step="any"
                        min="0"
                        value={line.weightKg}
                        onChange={(e) => onPatch({ weightKg: e.target.value })}
                        placeholder={isDevice ? "si connu" : "ex : 22"}
                        className="input border p-2 w-full rounded text-sm"
                    />
                </div>
            </div>
        </div>
    );
}

function NumInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <input
            type="number"
            step="any"
            min="0"
            placeholder={label}
            aria-label={`${label} en cm`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input border p-2 w-full rounded text-sm"
        />
    );
}
