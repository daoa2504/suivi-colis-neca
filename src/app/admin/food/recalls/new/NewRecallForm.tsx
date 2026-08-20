"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Lot = {
    id: string;
    lotNumber: string;
    description: string;
    status: string;
    _count: { sales: number };
};

type Complaint = {
    id: string;
    complaintNumber: string;
    lotId: string | null;
    natureCategory: string;
    natureDescription: string;
} | null;

const REASONS = [
    { value: "BIOLOGICAL_HAZARD", label: "Danger biologique" },
    { value: "CHEMICAL_HAZARD", label: "Danger chimique" },
    { value: "PHYSICAL_HAZARD", label: "Danger physique" },
    { value: "UNDECLARED_ALLERGEN", label: "Allergène non déclaré" },
    { value: "QUALITY_DEFECT", label: "Défaut qualité" },
    { value: "REGULATORY_REQUIREMENT", label: "Exigence réglementaire" },
    { value: "VOLUNTARY", label: "Rappel volontaire" },
    { value: "OTHER", label: "Autre" },
] as const;

const CLASSIFICATIONS = [
    { value: "CLASS_I", label: "Classe I — Risque grave (conséquences graves santé)" },
    { value: "CLASS_II", label: "Classe II — Risque temporaire ou réversible" },
    { value: "CLASS_III", label: "Classe III — Peu ou pas de risque santé" },
] as const;

const TYPES = [
    { value: "REAL", label: "Rappel réel", desc: "Vrai rappel — le lot passera à RECALLED" },
    { value: "SIMULATION", label: "Simulation annuelle", desc: "Test — n'affecte pas le statut du lot (Article 7)" },
] as const;

export default function NewRecallForm({
    lots,
    preselectedLotId,
    triggeringComplaint,
}: {
    lots: Lot[];
    preselectedLotId: string | null;
    triggeringComplaint: Complaint;
}) {
    const router = useRouter();
    const [type, setType] = useState<"REAL" | "SIMULATION">("REAL");
    const [lotId, setLotId] = useState(preselectedLotId ?? "");
    const [reason, setReason] = useState<typeof REASONS[number]["value"] | "">(
        triggeringComplaint?.natureCategory === "BIOLOGICAL" ? "BIOLOGICAL_HAZARD" :
        triggeringComplaint?.natureCategory === "CHEMICAL" ? "CHEMICAL_HAZARD" :
        triggeringComplaint?.natureCategory === "PHYSICAL" ? "PHYSICAL_HAZARD" :
        ""
    );
    const [classification, setClassification] = useState<typeof CLASSIFICATIONS[number]["value"] | "">("");
    const [description, setDescription] = useState(triggeringComplaint?.natureDescription ?? "");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const selectedLot = lots.find((l) => l.id === lotId);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        if (!lotId) { setMsg("Sélectionnez un lot"); return; }
        if (!reason) { setMsg("Sélectionnez un motif"); return; }
        if (!classification) { setMsg("Sélectionnez une classification"); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/food/recalls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lotId,
                    type,
                    reason,
                    classification,
                    description,
                    triggeringComplaintId: triggeringComplaint?.id,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            router.push(`/admin/food/recalls/${data.recall.id}`);
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="bg-white p-6 rounded-lg border shadow-sm space-y-5">
            {triggeringComplaint && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r">
                    <p className="text-sm text-amber-900">
                        <strong>Rappel déclenché depuis la plainte </strong>
                        <span className="font-mono">{triggeringComplaint.complaintNumber}</span>.
                        Le motif et la description sont pré-remplis.
                    </p>
                </div>
            )}

            {/* Type */}
            <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                    Type de rappel <span className="text-red-600">*</span>
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {TYPES.map((t) => (
                        <label
                            key={t.value}
                            className={`p-3 border rounded cursor-pointer ${
                                type === t.value
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-200 hover:border-gray-400"
                            }`}
                        >
                            <input
                                type="radio"
                                name="type"
                                value={t.value}
                                checked={type === t.value}
                                onChange={() => setType(t.value)}
                                className="mr-2"
                            />
                            <span className="font-medium">{t.label}</span>
                            <div className="text-xs text-gray-600 mt-0.5 ml-6">{t.desc}</div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Lot */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot à rappeler <span className="text-red-600">*</span>
                </label>
                <select
                    required
                    value={lotId}
                    onChange={(e) => setLotId(e.target.value)}
                    className="input border p-2 w-full rounded bg-white"
                >
                    <option value="">-- Sélectionner le lot --</option>
                    {lots.map((l) => (
                        <option key={l.id} value={l.id}>
                            {l.lotNumber} — {l.description.slice(0, 50)} ({l._count.sales} vente{l._count.sales > 1 ? "s" : ""})
                            {l.status === "RECALLED" ? " · déjà rappelé" : ""}
                        </option>
                    ))}
                </select>
                {selectedLot && (
                    <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r text-sm text-blue-900">
                        <strong>{selectedLot.description}</strong>
                        <br />
                        <span className="text-xs">
                            {selectedLot._count.sales} vente{selectedLot._count.sales > 1 ? "s" : ""} enregistrée{selectedLot._count.sales > 1 ? "s" : ""} —
                            {" "}la liste des clients affectés sera générée automatiquement.
                        </span>
                    </div>
                )}
            </div>

            {/* Motif */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif du rappel <span className="text-red-600">*</span>
                </label>
                <select
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="input border p-2 w-full rounded bg-white"
                >
                    <option value="">-- Choisir --</option>
                    {REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>
            </div>

            {/* Classification */}
            <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">
                    Classification (norme ACIA) <span className="text-red-600">*</span>
                </span>
                <div className="space-y-2">
                    {CLASSIFICATIONS.map((c) => (
                        <label
                            key={c.value}
                            className={`block p-3 border rounded cursor-pointer ${
                                classification === c.value
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-200 hover:border-gray-400"
                            }`}
                        >
                            <input
                                type="radio"
                                name="classification"
                                value={c.value}
                                checked={classification === c.value}
                                onChange={() => setClassification(c.value)}
                                className="mr-2"
                            />
                            <span className="text-sm font-medium">{c.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description du rappel <span className="text-red-600">*</span>
                </label>
                <textarea
                    required
                    minLength={10}
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input border p-2 w-full rounded"
                    placeholder="Expliquer précisément le problème détecté et les mesures de sécurité recommandées"
                />
            </div>

            {msg && (
                <div className="text-sm p-3 rounded bg-red-100 text-red-800">{msg}</div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={loading || !lotId}
                    className="bg-red-600 text-white px-6 py-2 rounded font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? "Création…" : "🔔 Créer le rappel + générer les contacts"}
                </button>
            </div>
        </form>
    );
}
