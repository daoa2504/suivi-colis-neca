"use client";

// src/app/admin/food/complaints/[id]/ComplaintWorkflow.tsx
// Interface d'enquête workflow (Article 82 RSAC) : 6 sections structurées
// avec update partielle en direct.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Complaint = any;

const STATUS_OPTIONS = [
    { value: "RECEIVED", label: "Reçue" },
    { value: "INVESTIGATION", label: "Enquête en cours" },
    { value: "SUPPLIER_CONTACTED", label: "Fournisseur contacté" },
    { value: "RESPONDED", label: "Client informé" },
    { value: "RESOLVED", label: "Résolue" },
    { value: "CLOSED", label: "Fermée (archivée)" },
] as const;

const RISK_OPTIONS = [
    { value: "HIGH", label: "Élevé" },
    { value: "MEDIUM", label: "Moyen" },
    { value: "LOW", label: "Faible" },
    { value: "NONE", label: "Aucun" },
] as const;

const CHANNEL_OPTIONS = [
    { value: "PHONE", label: "Téléphone" },
    { value: "EMAIL", label: "Email" },
    { value: "IN_PERSON", label: "En personne" },
    { value: "MAIL", label: "Courrier postal" },
    { value: "OTHER", label: "Autre" },
] as const;

const RESOLUTION_OPTIONS = [
    { value: "REPLACEMENT", label: "Remplacement" },
    { value: "REFUND", label: "Remboursement" },
    { value: "APOLOGY_ONLY", label: "Excuses uniquement" },
    { value: "NO_ACTION_NEEDED", label: "Aucune action nécessaire" },
    { value: "RECALL_INITIATED", label: "Rappel déclenché" },
    { value: "OTHER", label: "Autre" },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
    BIOLOGICAL: "Danger biologique",
    CHEMICAL: "Danger chimique",
    PHYSICAL: "Danger physique",
    QUALITY: "Qualité",
    OTHER: "Autre",
    NONE: "Aucun risque santé",
};

const STATUS_COLOR: Record<string, string> = {
    RECEIVED: "bg-blue-100 text-blue-800",
    INVESTIGATION: "bg-amber-100 text-amber-800",
    SUPPLIER_CONTACTED: "bg-purple-100 text-purple-800",
    RESPONDED: "bg-cyan-100 text-cyan-800",
    RESOLVED: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-200 text-gray-700",
};

function fmt(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-CA", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function toDateInput(d: Date | string | null | undefined): string {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
}

export default function ComplaintWorkflow({ initial }: { initial: Complaint }) {
    const router = useRouter();
    const [complaint, setComplaint] = useState<Complaint>(initial);
    const [saving, setSaving] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function patch(payload: Partial<Complaint>, section: string) {
        setSaving(section);
        setMsg(null);
        try {
            const res = await fetch(`/api/food/complaints/${complaint.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            setComplaint(data.complaint);
            setMsg(`✅ ${section} enregistré`);
            router.refresh();
            setTimeout(() => setMsg(null), 3000);
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
        } finally {
            setSaving(null);
        }
    }

    return (
        <div className="space-y-6">
            {/* --- HEADER --- */}
            <header className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <span className="font-mono text-xl font-bold text-red-800 bg-red-50 px-3 py-1 rounded">
                        {complaint.complaintNumber}
                    </span>
                    <StatusBadge value={complaint.status} />
                    <RiskBadge value={complaint.riskLevel} />
                    {complaint.triggeredRecall && (
                        <span className="px-2 py-1 text-xs rounded bg-red-600 text-white font-semibold">
                            ⚠️ Rappel déclenché
                        </span>
                    )}
                </div>
                {/* Action : déclencher un rappel */}
                {complaint.riskLevel === "HIGH" || complaint.isHealthRisk ? (
                    <Link
                        href={`/admin/food/recalls/new?complaintId=${complaint.id}`}
                        className="inline-block mt-2 text-sm bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800 font-medium"
                    >
                        🔔 Déclencher un rappel depuis cette plainte
                    </Link>
                ) : (
                    <p className="text-xs text-gray-500 mt-2">
                        <Link href={`/admin/food/recalls/new?complaintId=${complaint.id}`} className="text-red-700 hover:underline">
                            Déclencher un rappel depuis cette plainte →
                        </Link>
                    </p>
                )}
                <p className="text-sm text-gray-700">
                    Reçue le <strong>{fmt(complaint.receivedAt)}</strong> via <strong>{complaint.channel}</strong>
                    {complaint.handledBy && (
                        <> · Traitée par <strong>{complaint.handledBy.username}</strong></>
                    )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    Conservation obligatoire jusqu'au {fmt(complaint.retentionUntil)} (Art. 82 RSAC)
                </p>
            </header>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            {/* --- SECTION 1 : Détails initiaux (lecture seule) --- */}
            <Section title="1. Réception de la plainte" step={1}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Info label="Nom du client" value={complaint.clientNameSnapshot} />
                    <Info label="Email" value={complaint.clientEmail} link={complaint.clientEmail ? `mailto:${complaint.clientEmail}` : undefined} />
                    <Info label="Téléphone" value={complaint.clientPhone} link={complaint.clientPhone ? `tel:${complaint.clientPhone}` : undefined} />
                    <Info label="Client en base" value={complaint.client ? `${complaint.client.customerCode} — ${complaint.client.name}` : "Non enregistré"} />
                    <Info label="Numéro de lot" value={complaint.lotNumberSnapshot ?? "—"} mono />
                    <Info label="Produit concerné" value={complaint.productDescription ?? "—"} />
                    <Info label="Nature" value={CATEGORY_LABEL[complaint.natureCategory] ?? complaint.natureCategory} />
                    <Info label="Risque santé initial" value={complaint.isHealthRisk ? "Oui" : "Non"} />
                </div>
                <div className="mt-4">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">
                        Description
                    </p>
                    <div className="p-3 bg-gray-50 border rounded text-sm whitespace-pre-wrap">
                        {complaint.natureDescription}
                    </div>
                </div>
            </Section>

            {/* --- SECTION 2 : Évaluation --- */}
            <EvaluationSection complaint={complaint} patch={patch} saving={saving} />

            {/* --- SECTION 3 : Enquête --- */}
            <InvestigationSection complaint={complaint} patch={patch} saving={saving} />

            {/* --- SECTION 4 : Fournisseur --- */}
            <SupplierSection complaint={complaint} patch={patch} saving={saving} />

            {/* --- SECTION 5 : Réponse au client --- */}
            <ResponseSection complaint={complaint} patch={patch} saving={saving} />

            {/* --- SECTION 6 : ACIA (CFIA) --- */}
            <CfiaSection complaint={complaint} patch={patch} saving={saving} />
        </div>
    );
}

// ===============================
// Sections
// ===============================

function EvaluationSection({ complaint, patch, saving }: any) {
    const [risk, setRisk] = useState(complaint.riskLevel);
    const [isHealthRisk, setIsHealthRisk] = useState(complaint.isHealthRisk);
    const [status, setStatus] = useState(complaint.status);

    return (
        <Section title="2. Évaluation du risque + statut" step={2}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Statut de la plainte">
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Niveau de risque">
                    <select
                        value={risk}
                        onChange={(e) => setRisk(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        {RISK_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Risque pour la santé ?">
                    <label className="flex items-center gap-2 p-2 border rounded bg-white">
                        <input
                            type="checkbox"
                            checked={isHealthRisk}
                            onChange={(e) => setIsHealthRisk(e.target.checked)}
                        />
                        <span>Oui, représente un risque santé</span>
                    </label>
                </Field>
            </div>
            <SaveBtn
                onClick={() => patch({ status, riskLevel: risk, isHealthRisk }, "évaluation")}
                loading={saving === "évaluation"}
            />
        </Section>
    );
}

function InvestigationSection({ complaint, patch, saving }: any) {
    const [checked, setChecked] = useState(complaint.traceabilityChecked);
    const [notes, setNotes] = useState(complaint.investigationNotes ?? "");
    return (
        <Section title="3. Enquête" step={3}>
            <label className="flex items-center gap-3 p-3 border rounded mb-3 bg-blue-50/40">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                <div>
                    <div className="font-medium">Registres de traçabilité vérifiés</div>
                    <div className="text-xs text-gray-600">
                        Retrouver quels clients ont reçu ce lot dans /admin/food/lots
                    </div>
                    {complaint.traceabilityCheckedAt && (
                        <div className="text-xs text-gray-500 mt-0.5">
                            Vérifié le {fmt(complaint.traceabilityCheckedAt)}
                        </div>
                    )}
                </div>
            </label>
            <Field label="Journal d'enquête">
                <textarea
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input border p-2 w-full rounded"
                    placeholder="Étapes suivies, observations, décisions…"
                />
            </Field>
            <SaveBtn
                onClick={() => patch({ traceabilityChecked: checked, investigationNotes: notes }, "enquête")}
                loading={saving === "enquête"}
            />
        </Section>
    );
}

function SupplierSection({ complaint, patch, saving }: any) {
    const [contacted, setContacted] = useState(complaint.supplierContacted);
    const [response, setResponse] = useState(complaint.supplierResponse ?? "");
    return (
        <Section title="4. Fournisseur au Niger" step={4}>
            <label className="flex items-center gap-3 p-3 border rounded mb-3 bg-purple-50/40">
                <input
                    type="checkbox"
                    checked={contacted}
                    onChange={(e) => setContacted(e.target.checked)}
                />
                <div>
                    <div className="font-medium">Fournisseur étranger contacté</div>
                    {complaint.supplierContactedAt && (
                        <div className="text-xs text-gray-500">
                            Contacté le {fmt(complaint.supplierContactedAt)}
                        </div>
                    )}
                </div>
            </label>
            <Field label="Retour du fournisseur">
                <textarea
                    rows={4}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="input border p-2 w-full rounded"
                    placeholder="Ce que le fournisseur a répondu…"
                />
            </Field>
            <SaveBtn
                onClick={() => patch({ supplierContacted: contacted, supplierResponse: response }, "fournisseur")}
                loading={saving === "fournisseur"}
            />
        </Section>
    );
}

function ResponseSection({ complaint, patch, saving }: any) {
    const [respondedAt, setRespondedAt] = useState(toDateInput(complaint.respondedAt));
    const [responseChannel, setResponseChannel] = useState(complaint.responseChannel ?? "");
    const [responseSummary, setResponseSummary] = useState(complaint.responseSummary ?? "");
    const [resolution, setResolution] = useState(complaint.resolution ?? "");
    const [resolutionNotes, setResolutionNotes] = useState(complaint.resolutionNotes ?? "");
    const [correctiveMeasures, setCorrectiveMeasures] = useState(complaint.correctiveMeasures ?? "");
    return (
        <Section title="5. Réponse au client + mesures" step={5}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Date de réponse">
                    <input
                        type="date"
                        value={respondedAt}
                        onChange={(e) => setRespondedAt(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
                <Field label="Canal de réponse">
                    <select
                        value={responseChannel}
                        onChange={(e) => setResponseChannel(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">—</option>
                        {CHANNEL_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </Field>
            </div>
            <Field label="Résumé de la réponse">
                <textarea
                    rows={3}
                    value={responseSummary}
                    onChange={(e) => setResponseSummary(e.target.value)}
                    className="input border p-2 w-full rounded"
                    placeholder="Ce qu'on a dit au client…"
                />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Résolution offerte">
                    <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="input border p-2 w-full rounded bg-white"
                    >
                        <option value="">—</option>
                        {RESOLUTION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Notes de résolution">
                    <input
                        type="text"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="input border p-2 w-full rounded"
                    />
                </Field>
            </div>
            <Field label="Mesures correctives (pour éviter récidive)">
                <textarea
                    rows={3}
                    value={correctiveMeasures}
                    onChange={(e) => setCorrectiveMeasures(e.target.value)}
                    className="input border p-2 w-full rounded"
                    placeholder="Actions internes pour éviter que ça se reproduise…"
                />
            </Field>
            <SaveBtn
                onClick={() =>
                    patch(
                        {
                            respondedAt: respondedAt || null,
                            responseChannel: responseChannel || null,
                            responseSummary,
                            resolution: resolution || null,
                            resolutionNotes,
                            correctiveMeasures,
                        },
                        "réponse client",
                    )
                }
                loading={saving === "réponse client"}
            />
        </Section>
    );
}

function CfiaSection({ complaint, patch, saving }: any) {
    const [required, setRequired] = useState(complaint.cfiaNotificationRequired);
    const [notifiedAt, setNotifiedAt] = useState(toDateInput(complaint.cfiaNotifiedAt));
    const [reference, setReference] = useState(complaint.cfiaReference ?? "");
    return (
        <Section title="6. Notification ACIA (CFIA)" step={6}>
            <label className="flex items-center gap-3 p-3 border rounded mb-3 bg-orange-50/40">
                <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                />
                <div>
                    <div className="font-medium">L'ACIA doit être avisée</div>
                    <div className="text-xs text-gray-600">
                        À cocher si risque santé confirmé ou rappel déclenché
                    </div>
                </div>
            </label>
            {required && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Date de notification ACIA">
                        <input
                            type="date"
                            value={notifiedAt}
                            onChange={(e) => setNotifiedAt(e.target.value)}
                            className="input border p-2 w-full rounded"
                        />
                    </Field>
                    <Field label="N° de dossier ACIA">
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="input border p-2 w-full rounded"
                            placeholder="ex: 2026-XX-YYYY"
                        />
                    </Field>
                </div>
            )}
            <SaveBtn
                onClick={() =>
                    patch(
                        {
                            cfiaNotificationRequired: required,
                            cfiaNotifiedAt: required ? (notifiedAt || null) : null,
                            cfiaReference: required ? reference : null,
                        },
                        "ACIA",
                    )
                }
                loading={saving === "ACIA"}
            />
        </Section>
    );
}

// ===============================
// UI primitives
// ===============================

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
    return (
        <section className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                    {step}
                </span>
                <h2 className="text-lg font-bold">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block mb-3">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
            {children}
        </label>
    );
}

function Info({ label, value, link, mono }: { label: string; value: string | null; link?: string; mono?: boolean }) {
    if (!value) value = "—";
    const content = link ? (
        <a href={link} className="text-blue-600 hover:underline">{value}</a>
    ) : (
        <span className={mono ? "font-mono" : ""}>{value}</span>
    );
    return (
        <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className="text-sm text-gray-900 mt-0.5">{content}</p>
        </div>
    );
}

function StatusBadge({ value }: { value: string }) {
    const opt = STATUS_OPTIONS.find((o) => o.value === value);
    return (
        <span className={`px-3 py-1 rounded text-xs font-semibold ${STATUS_COLOR[value] ?? "bg-gray-100"}`}>
            {opt?.label ?? value}
        </span>
    );
}

function RiskBadge({ value }: { value: string }) {
    const map: Record<string, string> = {
        HIGH: "bg-red-100 text-red-800",
        MEDIUM: "bg-amber-100 text-amber-800",
        LOW: "bg-gray-100 text-gray-700",
        NONE: "bg-gray-100 text-gray-500",
    };
    const opt = RISK_OPTIONS.find((o) => o.value === value);
    return (
        <span className={`px-3 py-1 rounded text-xs font-semibold ${map[value] ?? "bg-gray-100"}`}>
            Risque {opt?.label ?? value}
        </span>
    );
}

function SaveBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
    return (
        <div className="flex justify-end mt-4">
            <button
                type="button"
                onClick={onClick}
                disabled={loading}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
                {loading ? "Enregistrement…" : "Enregistrer cette section"}
            </button>
        </div>
    );
}
