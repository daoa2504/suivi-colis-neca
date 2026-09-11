// src/components/ContentKindSection.tsx
//
// Section « Nature du contenu », partagée par les formulaires d'ajout (CA, NE)
// et de modification d'un colis.
//   - Colis    → poids obligatoire
//   - Appareil → type obligatoire, dimensions et poids facultatifs
//
// Deux modes d'utilisation, selon le formulaire parent :
//   - lecture par FormData : les valeurs sortent par des <input name="...">
//   - parent contrôlé      : passer `initial` et lire `onChange`

"use client";

import { useEffect, useRef, useState } from "react";
import { DEVICE_TYPES, DEVICE_TYPE_OTHER, type ItemKind } from "@/lib/itemKind";

export type ContentValue = {
    itemKind: ItemKind;
    deviceType: string;
    weightKg: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
};

const EMPTY: ContentValue = {
    itemKind: "PARCEL",
    deviceType: "",
    weightKg: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
};

/** Un type connu va dans le <select> ; tout le reste bascule sur « Autre ». */
function splitDeviceType(deviceType: string): { selected: string; other: string } {
    if (!deviceType) return { selected: "", other: "" };
    return (DEVICE_TYPES as readonly string[]).includes(deviceType)
        ? { selected: deviceType, other: "" }
        : { selected: DEVICE_TYPE_OTHER, other: deviceType };
}

export default function ContentKindSection({
    resetSignal = 0,
    initial,
    onChange,
}: {
    /** Incrémenter cette valeur après un envoi réussi pour vider la section. */
    resetSignal?: number;
    /** Valeurs de départ, pour le formulaire de modification. */
    initial?: Partial<ContentValue>;
    /** Appelé à chaque changement, pour un parent qui construit son propre payload. */
    onChange?: (value: ContentValue) => void;
}) {
    const start: ContentValue = { ...EMPTY, ...initial };
    const startSplit = splitDeviceType(start.deviceType);

    const [kind, setKind] = useState<ItemKind>(start.itemKind);
    const [selectedType, setSelectedType] = useState(startSplit.selected);
    const [otherType, setOtherType] = useState(startSplit.other);
    const [weightKg, setWeightKg] = useState(start.weightKg);
    const [lengthCm, setLengthCm] = useState(start.lengthCm);
    const [widthCm, setWidthCm] = useState(start.widthCm);
    const [heightCm, setHeightCm] = useState(start.heightCm);

    const isDevice = kind === "DEVICE";
    const isOther = selectedType === DEVICE_TYPE_OTHER;
    const deviceType = isDevice ? (isOther ? otherType.trim() : selectedType) : "";

    // Le form.reset() du parent ne touche pas l'état React : on le suit à la main.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setKind("PARCEL");
        setSelectedType("");
        setOtherType("");
        setWeightKg("");
        setLengthCm("");
        setWidthCm("");
        setHeightCm("");
    }, [resetSignal]);

    // Remontée au parent contrôlé. Un colis n'emporte ni type ni dimensions.
    useEffect(() => {
        onChange?.({
            itemKind: kind,
            deviceType,
            weightKg,
            lengthCm: isDevice ? lengthCm : "",
            widthCm: isDevice ? widthCm : "",
            heightCm: isDevice ? heightCm : "",
        });
        // onChange est volontairement hors dépendances : les parents passent
        // souvent une fonction recréée à chaque rendu.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, deviceType, weightKg, lengthCm, widthCm, heightCm, isDevice]);

    return (
        <div className="rounded-lg border border-neutral-200 p-4 space-y-4">
            <div>
                <span className="label block mb-2 text-sm font-medium text-neutral-700">
                    Nature du contenu <span className="text-red-600">*</span>
                </span>

                <div className="grid grid-cols-2 gap-3">
                    <KindButton
                        active={!isDevice}
                        onClick={() => setKind("PARCEL")}
                        emoji="📦"
                        title="Colis"
                        hint="Poids requis"
                    />
                    <KindButton
                        active={isDevice}
                        onClick={() => setKind("DEVICE")}
                        emoji="🔌"
                        title="Appareil"
                        hint="Type requis"
                    />
                </div>

                <input type="hidden" name="itemKind" value={kind} />
            </div>

            {isDevice ? (
                <>
                    <div>
                        <label
                            htmlFor="deviceTypeSelect"
                            className="label block mb-1 text-sm font-medium text-neutral-700"
                        >
                            Type d'appareil <span className="text-red-600">*</span>
                        </label>
                        <select
                            id="deviceTypeSelect"
                            required
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="input border p-2 w-full rounded bg-white"
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
                            <label
                                htmlFor="deviceTypeOther"
                                className="label block mb-1 text-sm font-medium text-neutral-700"
                            >
                                Préciser le type <span className="text-red-600">*</span>
                            </label>
                            <input
                                id="deviceTypeOther"
                                required
                                value={otherType}
                                onChange={(e) => setOtherType(e.target.value)}
                                placeholder="ex : four à micro-ondes"
                                className="input border p-2 w-full rounded"
                            />
                        </div>
                    )}

                    {/* Type résolu : option choisie ou saisie libre */}
                    <input type="hidden" name="deviceType" value={deviceType} />

                    <div>
                        <span className="label block mb-1 text-sm font-medium text-neutral-700">
                            Dimensions{" "}
                            <span className="text-neutral-400 font-normal">(optionnel, en cm)</span>
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                            <DimInput
                                name="lengthCm"
                                label="Longueur"
                                value={lengthCm}
                                onChange={setLengthCm}
                            />
                            <DimInput
                                name="widthCm"
                                label="Largeur"
                                value={widthCm}
                                onChange={setWidthCm}
                            />
                            <DimInput
                                name="heightCm"
                                label="Hauteur"
                                value={heightCm}
                                onChange={setHeightCm}
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="weightKg"
                            className="label block mb-1 text-sm font-medium text-neutral-700"
                        >
                            Poids (kg){" "}
                            <span className="text-neutral-400 font-normal">(optionnel)</span>
                        </label>
                        <input
                            id="weightKg"
                            name="weightKg"
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="si connu"
                            value={weightKg}
                            onChange={(e) => setWeightKg(e.target.value)}
                            className="input border p-2 w-full rounded"
                        />
                    </div>
                </>
            ) : (
                <div>
                    <label
                        htmlFor="weightKg"
                        className="label block mb-1 text-sm font-medium text-neutral-700"
                    >
                        Poids (kg) <span className="text-red-600">*</span>
                    </label>
                    <input
                        id="weightKg"
                        name="weightKg"
                        required
                        type="number"
                        step="0.5"
                        min="0.1"
                        placeholder="ex: 2.5"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </div>
            )}
        </div>
    );
}

function DimInput({
    name,
    label,
    value,
    onChange,
}: {
    name: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <input
            name={name}
            type="number"
            step="1"
            min="0"
            placeholder={label}
            aria-label={`${label} en cm`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input border p-2 w-full rounded"
        />
    );
}

function KindButton({
    active,
    onClick,
    emoji,
    title,
    hint,
}: {
    active: boolean;
    onClick: () => void;
    emoji: string;
    title: string;
    hint: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-3 transition-colors ${
                active
                    ? "border-black bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
            }`}
        >
            <span className="text-xl leading-none">{emoji}</span>
            <span className="font-semibold text-sm">{title}</span>
            <span className={`text-[11px] ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                {hint}
            </span>
        </button>
    );
}
