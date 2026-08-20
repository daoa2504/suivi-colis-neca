"use client";

// src/app/admin/food/recalls/[id]/RecallWorkflow.tsx
// Interface de gestion d'un rappel avec workflow ACIA complet.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Recall = any;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
    ACTIVE: { label: "Actif", color: "bg-red-100 text-red-800" },
    MONITORING: { label: "Récupération", color: "bg-amber-100 text-amber-800" },
    COMPLETED: { label: "Terminé", color: "bg-blue-100 text-blue-800" },
    CLOSED: { label: "Clôturé", color: "bg-green-100 text-green-800" },
};

const CLASS_LABEL: Record<string, string> = {
    CLASS_I: "Classe I — Risque grave",
    CLASS_II: "Classe II — Risque temporaire",
    CLASS_III: "Classe III — Peu de risque",
};

const REASON_LABEL: Record<string, string> = {
    BIOLOGICAL_HAZARD: "Danger biologique",
    CHEMICAL_HAZARD: "Danger chimique",
    PHYSICAL_HAZARD: "Danger physique",
    UNDECLARED_ALLERGEN: "Allergène non déclaré",
    QUALITY_DEFECT: "Défaut qualité",
    REGULATORY_REQUIREMENT: "Exigence réglementaire",
    VOLUNTARY: "Rappel volontaire",
    OTHER: "Autre",
};

const CHANNELS = [
    { value: "PHONE", label: "Téléphone" },
    { value: "EMAIL", label: "Email" },
    { value: "IN_PERSON", label: "En personne" },
    { value: "MAIL", label: "Courrier" },
    { value: "OTHER", label: "Autre" },
];

function fmt(d: Date | string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(n: number | null | undefined) {
    if (n === null || n === undefined) return "—";
    return n.toLocaleString("fr-CA", { maximumFractionDigits: 2 });
}
function toDate(d: Date | string | null | undefined): string {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
}

export default function RecallWorkflow({ initial }: { initial: Recall }) {
    const router = useRouter();
    const [recall, setRecall] = useState<Recall>(initial);
    const [saving, setSaving] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    async function patch(payload: any, section: string) {
        setSaving(section);
        setMsg(null);
        try {
            const res = await fetch(`/api/food/recalls/${recall.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            setRecall(data.recall);
            setMsg(`✅ ${section} enregistré`);
            router.refresh();
            setTimeout(() => setMsg(null), 3000);
        } catch (err: any) {
            setMsg(`❌ ${err?.message ?? "Erreur"}`);
        } finally {
            setSaving(null);
        }
    }

    // Contact update
    async function patchContact(contactId: string, payload: any) {
        const res = await fetch(`/api/food/recalls/${recall.id}/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
        setRecall({
            ...recall,
            contacts: recall.contacts.map((c: any) => c.id === contactId ? { ...c, ...data.contact } : c),
        });
        return data.contact;
    }

    // KPIs
    const totalContacts = recall.contacts.length;
    const contactedCount = recall.contacts.filter((c: any) => c.contactedAt).length;
    const returnedCount = recall.contacts.filter((c: any) => c.productReturned).length;
    const totalReceived = recall.contacts.reduce((s: number, c: any) => s + (c.quantityReceived ?? 0), 0);
    const totalReturned = recall.contacts.reduce((s: number, c: any) => s + (c.quantityReturned ?? 0), 0);
    const totalDestroyedByContact = recall.contacts.reduce((s: number, c: any) => s + (c.quantityDestroyed ?? 0), 0);
    const stillOut = totalReceived - totalReturned - totalDestroyedByContact;

    return (
        <div className="space-y-6">
            {/* ─── HEADER ─────────────────────────────────────────────── */}
            <header className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                    <span className="font-mono text-xl font-bold text-red-800 bg-red-50 px-3 py-1 rounded">
                        {recall.recallNumber}
                    </span>
                    <span className={`px-3 py-1 rounded text-xs font-semibold ${STATUS_LABEL[recall.status].color}`}>
                        {STATUS_LABEL[recall.status].label}
                    </span>
                    {recall.type === "SIMULATION" && (
                        <span className="px-3 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                            SIMULATION
                        </span>
                    )}
                    <span className="text-xs text-gray-500">
                        Initié le {fmt(recall.initiatedAt)}
                        {recall.createdBy && ` par ${recall.createdBy.username}`}
                    </span>
                </div>
                <p className="text-sm text-gray-700">
                    Lot <Link href={`/admin/food/lots/${recall.lotId}`} className="font-mono font-semibold text-emerald-800 hover:underline">{recall.lot.lotNumber}</Link>
                    {" · "}
                    <strong>{CLASS_LABEL[recall.classification]}</strong>
                    {" · "}
                    Motif : {REASON_LABEL[recall.reason]}
                </p>
                {recall.triggeringComplaint && (
                    <p className="text-xs text-gray-600 mt-1">
                        Déclenché par la plainte {" "}
                        <Link href={`/admin/food/complaints/${recall.triggeringComplaint.id}`} className="font-mono text-red-700 hover:underline">
                            {recall.triggeringComplaint.complaintNumber}
                        </Link>
                    </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                    Rétention obligatoire jusqu'au {fmt(recall.retentionUntil)} (Article 7)
                </p>
            </header>

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            {/* ─── KPI globaux ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Kpi label="Clients affectés" value={totalContacts.toString()} />
                <Kpi label="Contactés" value={`${contactedCount} / ${totalContacts}`} accent={contactedCount === totalContacts ? "text-green-700" : "text-amber-700"} />
                <Kpi label="Retours" value={returnedCount.toString()} accent="text-blue-700" />
                <Kpi label="Kg récupérés / distribués" value={`${fmtNum(totalReturned)} / ${fmtNum(totalReceived)}`} />
                <Kpi label="Encore chez clients" value={fmtNum(Math.max(0, stillOut)) + " kg"} accent={stillOut > 0 ? "text-red-700" : "text-green-700"} />
            </div>

            {/* ─── Description initiale (lecture seule) ───────────────── */}
            <Section title="Description du rappel" step={1}>
                <div className="p-3 bg-gray-50 border rounded text-sm whitespace-pre-wrap">
                    {recall.description}
                </div>
            </Section>

            {/* ─── Contacts (le cœur du rappel) ──────────────────────── */}
            <ContactsSection contacts={recall.contacts} patchContact={patchContact} />

            {/* ─── Cycle de vie ──────────────────────────────────────── */}
            <LifecycleSection recall={recall} patch={patch} saving={saving} />

            {/* ─── Communication + ACIA ──────────────────────────────── */}
            <CommunicationSection recall={recall} patch={patch} saving={saving} />

            {/* ─── Bilan + Rapport de clôture ────────────────────────── */}
            <ClosureSection recall={recall} patch={patch} saving={saving} />
        </div>
    );
}

// ============================================================================
// Section : Contacts
// ============================================================================

function ContactsSection({ contacts, patchContact }: any) {
    return (
        <Section title="Contacts clients (auto-générés depuis les ventes)" step={2}>
            {contacts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                    Aucun client n'a été enregistré comme ayant reçu ce lot.
                </p>
            ) : (
                <div className="space-y-3">
                    {contacts.map((c: any) => (
                        <ContactRow key={c.id} contact={c} patchContact={patchContact} />
                    ))}
                </div>
            )}
        </Section>
    );
}

function ContactRow({ contact, patchContact }: any) {
    const [expanded, setExpanded] = useState(false);
    const [contactedAt, setContactedAt] = useState(toDate(contact.contactedAt));
    const [contactChannel, setContactChannel] = useState(contact.contactChannel ?? "");
    const [contactNotes, setContactNotes] = useState(contact.contactNotes ?? "");
    const [productReturned, setProductReturned] = useState(contact.productReturned);
    const [quantityReturned, setQuantityReturned] = useState(contact.quantityReturned ?? "");
    const [returnedAt, setReturnedAt] = useState(toDate(contact.returnedAt));
    const [quantityDestroyed, setQuantityDestroyed] = useState(contact.quantityDestroyed ?? "");
    const [destroyedAt, setDestroyedAt] = useState(toDate(contact.destroyedAt));
    const [saving, setSaving] = useState(false);
    const [rowMsg, setRowMsg] = useState<string | null>(null);

    async function save() {
        setSaving(true);
        setRowMsg(null);
        try {
            await patchContact(contact.id, {
                contactedAt: contactedAt || null,
                contactChannel: contactChannel || null,
                contactNotes,
                productReturned,
                quantityReturned: quantityReturned === "" ? null : Number(quantityReturned),
                returnedAt: returnedAt || null,
                quantityDestroyed: quantityDestroyed === "" ? null : Number(quantityDestroyed),
                destroyedAt: destroyedAt || null,
            });
            setRowMsg("✅ enregistré");
            setTimeout(() => setRowMsg(null), 2000);
        } catch (e: any) {
            setRowMsg(`❌ ${e?.message}`);
        } finally {
            setSaving(false);
        }
    }

    async function quickContact() {
        const today = new Date().toISOString().slice(0, 10);
        setContactedAt(today);
        setSaving(true);
        try {
            await patchContact(contact.id, { contactedAt: today });
            setRowMsg("✅ marqué comme contacté");
            setTimeout(() => setRowMsg(null), 2000);
        } catch (e: any) {
            setRowMsg(`❌ ${e?.message}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className={`border rounded-lg ${contact.contactedAt ? "bg-white" : "bg-red-50/40 border-red-200"}`}>
            <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-blue-800">
                            {contact.client.customerCode}
                        </span>
                        <span className="font-medium">{contact.client.name}</span>
                        <span className="text-xs text-gray-600">
                            · {fmtNum(contact.quantityReceived)} kg reçus
                        </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-3 flex-wrap">
                        {contact.client.phone && <span>📞 {contact.client.phone}</span>}
                        {contact.client.email && <span>✉️ {contact.client.email}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {contact.contactedAt ? (
                        <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                            Contacté le {fmt(contact.contactedAt)}
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={quickContact}
                            disabled={saving}
                            className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                            📞 Marquer contacté
                        </button>
                    )}
                    {contact.productReturned && (
                        <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
                            Retourné · {fmtNum(contact.quantityReturned)} kg
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => setExpanded((s) => !s)}
                        className="text-xs text-gray-600 hover:text-gray-900"
                    >
                        {expanded ? "▲ Fermer" : "▼ Détails"}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t p-4 bg-gray-50 space-y-3">
                    {/* Contact */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Field label="Date de contact">
                            <input type="date" value={contactedAt} onChange={(e) => setContactedAt(e.target.value)} className="input border p-2 w-full rounded" />
                        </Field>
                        <Field label="Canal de contact">
                            <select value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} className="input border p-2 w-full rounded bg-white">
                                <option value="">—</option>
                                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </Field>
                    </div>
                    <Field label="Notes du contact">
                        <input value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} className="input border p-2 w-full rounded" />
                    </Field>

                    {/* Retour */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                        <Field label="Produit retourné ?">
                            <label className="flex items-center gap-2 p-2 border rounded bg-white">
                                <input type="checkbox" checked={productReturned} onChange={(e) => setProductReturned(e.target.checked)} />
                                <span>Oui</span>
                            </label>
                        </Field>
                        <Field label="Quantité retournée (kg)">
                            <input type="number" step="0.01" min="0" value={quantityReturned} onChange={(e) => setQuantityReturned(e.target.value)} className="input border p-2 w-full rounded" />
                        </Field>
                        <Field label="Date retour">
                            <input type="date" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} className="input border p-2 w-full rounded" />
                        </Field>
                    </div>

                    {/* Destruction */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                        <Field label="Quantité détruite (kg)">
                            <input type="number" step="0.01" min="0" value={quantityDestroyed} onChange={(e) => setQuantityDestroyed(e.target.value)} className="input border p-2 w-full rounded" />
                        </Field>
                        <Field label="Date destruction">
                            <input type="date" value={destroyedAt} onChange={(e) => setDestroyedAt(e.target.value)} className="input border p-2 w-full rounded" />
                        </Field>
                    </div>

                    {rowMsg && (
                        <div className={`text-sm p-2 rounded ${rowMsg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {rowMsg}
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button type="button" onClick={save} disabled={saving} className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                            {saving ? "Enregistrement…" : "Enregistrer"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Autres sections
// ============================================================================

function LifecycleSection({ recall, patch, saving }: any) {
    const [activatedAt, setActivatedAt] = useState(toDate(recall.activatedAt));
    const [completedAt, setCompletedAt] = useState(toDate(recall.completedAt));
    const [closedAt, setClosedAt] = useState(toDate(recall.closedAt));
    const [status, setStatus] = useState(recall.status);

    return (
        <Section title="Cycle de vie du rappel" step={3}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Statut">
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="input border p-2 w-full rounded bg-white">
                        <option value="DRAFT">Brouillon</option>
                        <option value="ACTIVE">Actif</option>
                        <option value="MONITORING">Récupération en cours</option>
                        <option value="COMPLETED">Terminé</option>
                        <option value="CLOSED">Clôturé</option>
                    </select>
                </Field>
                <Field label="Activé le">
                    <input type="date" value={activatedAt} onChange={(e) => setActivatedAt(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
                <Field label="Terminé le">
                    <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
                <Field label="Clôturé le">
                    <input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
            </div>
            <SaveBtn
                onClick={() => patch({ status, activatedAt: activatedAt || null, completedAt: completedAt || null, closedAt: closedAt || null }, "cycle de vie")}
                loading={saving === "cycle de vie"}
            />
        </Section>
    );
}

function CommunicationSection({ recall, patch, saving }: any) {
    const [publicNoticeText, setPublicNoticeText] = useState(recall.publicNoticeText ?? "");
    const [publicNoticeUrl, setPublicNoticeUrl] = useState(recall.publicNoticeUrl ?? "");
    const [cfiaNotifiedAt, setCfiaNotifiedAt] = useState(toDate(recall.cfiaNotifiedAt));
    const [cfiaReference, setCfiaReference] = useState(recall.cfiaReference ?? "");
    const [cfiaNoticeUrl, setCfiaNoticeUrl] = useState(recall.cfiaNoticeUrl ?? "");

    return (
        <Section title="Communication publique + ACIA" step={4}>
            <Field label="Texte du communiqué public">
                <textarea rows={4} value={publicNoticeText} onChange={(e) => setPublicNoticeText(e.target.value)} className="input border p-2 w-full rounded" placeholder="Communiqué destiné à être diffusé publiquement" />
            </Field>
            <Field label="URL du communiqué public">
                <input type="url" value={publicNoticeUrl} onChange={(e) => setPublicNoticeUrl(e.target.value)} className="input border p-2 w-full rounded" placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t">
                <Field label="ACIA notifiée le">
                    <input type="date" value={cfiaNotifiedAt} onChange={(e) => setCfiaNotifiedAt(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
                <Field label="N° dossier ACIA">
                    <input value={cfiaReference} onChange={(e) => setCfiaReference(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
                <Field label="URL avis ACIA">
                    <input type="url" value={cfiaNoticeUrl} onChange={(e) => setCfiaNoticeUrl(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
            </div>
            <SaveBtn
                onClick={() => patch({ publicNoticeText, publicNoticeUrl, cfiaNotifiedAt: cfiaNotifiedAt || null, cfiaReference, cfiaNoticeUrl }, "communication")}
                loading={saving === "communication"}
            />
        </Section>
    );
}

function ClosureSection({ recall, patch, saving }: any) {
    const [quantityRecovered, setQuantityRecovered] = useState(recall.quantityRecovered ?? "");
    const [quantityDestroyed, setQuantityDestroyed] = useState(recall.quantityDestroyed ?? "");
    const [closureReport, setClosureReport] = useState(recall.closureReport ?? "");

    return (
        <Section title="Bilan + Rapport de clôture" step={5}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Total récupéré (kg)">
                    <input type="number" step="0.01" min="0" value={quantityRecovered} onChange={(e) => setQuantityRecovered(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
                <Field label="Total détruit (kg)">
                    <input type="number" step="0.01" min="0" value={quantityDestroyed} onChange={(e) => setQuantityDestroyed(e.target.value)} className="input border p-2 w-full rounded" />
                </Field>
            </div>
            <Field label="Rapport de clôture">
                <textarea rows={6} value={closureReport} onChange={(e) => setClosureReport(e.target.value)} className="input border p-2 w-full rounded" placeholder="Bilan détaillé du rappel : mesures prises, résultats, leçons apprises, actions correctives..." />
            </Field>
            <SaveBtn
                onClick={() => patch({ quantityRecovered: quantityRecovered === "" ? null : quantityRecovered, quantityDestroyed: quantityDestroyed === "" ? null : quantityDestroyed, closureReport }, "clôture")}
                loading={saving === "clôture"}
            />
        </Section>
    );
}

// ============================================================================
// UI primitives
// ============================================================================

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
    return (
        <section className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
                <span className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">{step}</span>
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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="bg-white p-3 rounded-lg border shadow-sm">
            <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
            <p className={`text-lg font-bold mt-1 ${accent ?? "text-gray-900"}`}>{value}</p>
        </div>
    );
}

function SaveBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
    return (
        <div className="flex justify-end mt-4">
            <button type="button" onClick={onClick} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium">
                {loading ? "Enregistrement…" : "Enregistrer cette section"}
            </button>
        </div>
    );
}
