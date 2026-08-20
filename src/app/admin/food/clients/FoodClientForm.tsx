"use client";

// src/app/admin/food/clients/FoodClientForm.tsx
// Formulaire réutilisable : création + édition d'un FoodClient.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    country?: string | null;
    notes?: string | null;
    active?: boolean;
};

export default function FoodClientForm({
    initial,
    mode,
}: {
    initial?: Client;
    mode: "create" | "edit";
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [form, setForm] = useState<Client>({
        name: initial?.name ?? "",
        email: initial?.email ?? "",
        phone: initial?.phone ?? "",
        address: initial?.address ?? "",
        city: initial?.city ?? "",
        province: initial?.province ?? "",
        postalCode: initial?.postalCode ?? "",
        country: initial?.country ?? "Canada",
        notes: initial?.notes ?? "",
        active: initial?.active ?? true,
    });

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);
        try {
            const url =
                mode === "create"
                    ? "/api/food/clients"
                    : `/api/food/clients/${initial!.id}`;
            const method = mode === "create" ? "POST" : "PATCH";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");

            setMsg("✅ Enregistré");
            setTimeout(() => {
                if (mode === "create") {
                    router.push(`/admin/food/clients/${data.client.id}`);
                } else {
                    router.refresh();
                }
            }, 400);
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
        } finally {
            setLoading(false);
        }
    }

    async function onDelete() {
        if (!initial?.id) return;
        if (!confirm("Désactiver ce client ? (soft-delete — l'historique est préservé)")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/food/clients/${initial.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
            router.push("/admin/food/clients");
        } catch (err: any) {
            setMsg(`❌ ${err?.message || "Erreur"}`);
            setLoading(false);
        }
    }

    function bind<K extends keyof Client>(field: K) {
        return {
            value: (form[field] ?? "") as string,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setForm({ ...form, [field]: e.target.value } as Client),
        };
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nom / Raison sociale" required>
                    <input required minLength={2} className="input border p-2 w-full rounded" {...bind("name")} />
                </Field>
                <Field label="Email">
                    <input type="email" className="input border p-2 w-full rounded" {...bind("email")} />
                </Field>
                <Field label="Téléphone">
                    <input type="tel" className="input border p-2 w-full rounded" {...bind("phone")} />
                </Field>
                <Field label="Adresse">
                    <input className="input border p-2 w-full rounded" {...bind("address")} />
                </Field>
                <Field label="Ville">
                    <input className="input border p-2 w-full rounded" {...bind("city")} />
                </Field>
                <Field label="Province">
                    <input className="input border p-2 w-full rounded" {...bind("province")} />
                </Field>
                <Field label="Code postal">
                    <input className="input border p-2 w-full rounded" {...bind("postalCode")} />
                </Field>
                <Field label="Pays">
                    <input className="input border p-2 w-full rounded" {...bind("country")} />
                </Field>
            </div>

            <Field label="Notes internes">
                <textarea rows={3} className="input border p-2 w-full rounded" {...bind("notes")} />
            </Field>

            {mode === "edit" && (
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={form.active !== false}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    Actif
                </label>
            )}

            {msg && (
                <div className={`text-sm p-3 rounded ${msg.startsWith("✅") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {msg}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    {mode === "edit" && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="text-sm text-red-600 hover:underline"
                            disabled={loading}
                        >
                            Désactiver ce client
                        </button>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? "Enregistrement…" : mode === "create" ? "Créer le client" : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </span>
            {children}
        </label>
    );
}
