// src/app/agent/ca/CAForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CAForm() {
    const router = useRouter();
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        const form = e.currentTarget;                 // ✅ garde une ref stable
        const fd = new FormData(form);

        const payload = {
            // regroupe par convoi
            convoyDate: String(fd.get("convoyDate") || "").trim(),

            receiverName: String(fd.get("receiverName") || "").trim(),
            receiverEmail: String(fd.get("receiverEmail") || "").trim(),
            receiverPhone: (fd.get("receiverPhone") as string) || null,

            weightKg:
                fd.get("weightKg") && String(fd.get("weightKg")).length > 0
                    ? Number(fd.get("weightKg"))
                    : null,

            receiverAddress: (fd.get("receiverAddress") as string) || null,
            receiverCity: (fd.get("receiverCity") as string) || null,
            receiverPoBox: (fd.get("receiverPoBox") as string) || null,
            notes: (fd.get("notes") as string) || null,

            // ✅ force le sens CA -> GN pour l'emailing et le suivi
            originCountry: "Canada",
            destinationCountry: "Guinea",
        };

        try {
            const res = await fetch("/api/shipments/ca", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data =
                res.headers.get("content-type")?.includes("application/json")
                    ? await res.json()
                    : { ok: false, error: await res.text() };

            if (!res.ok || !(data as any).ok) {
                throw new Error((data as any).error || "Création échouée");
            }

            // ✅ un seul reset, sur l'instance sauvée
            form.reset();
            setMsg(`✅ Colis enregistré. Tracking: ${(data as any).trackingId}`);
            router.refresh();
        } catch (err: any) {
            setMsg(`Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 max-w-2xl">
            <div>
                <label className="label">
                    Date du convoi (CA → GN) <span className="text-red-600">*</span>
                </label>
                <input name="convoyDate" type="date" className="input" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="label">
                        Nom destinataire <span className="text-red-600">*</span>
                    </label>
                    <input name="receiverName" className="input" required />
                </div>
                <div>
                    <label className="label">
                        Email destinataire <span className="text-red-600">*</span>
                    </label>
                    <input name="receiverEmail" type="email" className="input" required />
                </div>
                <div>
                    <label className="label">Téléphone</label>
                    <input name="receiverPhone" className="input" placeholder="(optionnel)" />
                </div>
                <div>
                    <label className="label">Poids (kg)</label>
                    <input name="weightKg" type="number" step="0.01" className="input" />
                </div>
            </div>

            <fieldset className="grid gap-4">
                <legend className="label font-semibold">Adresse (Guinée)</legend>
                <div>
                    <label className="label">Adresse</label>
                    <input name="receiverAddress" className="input" placeholder="quartier, rue…" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Ville</label>
                        <input name="receiverCity" className="input" placeholder="ex: Conakry" />
                    </div>
                    <div>
                        <label className="label">Boîte postale</label>
                        <input name="receiverPoBox" className="input" placeholder="(optionnel)" />
                    </div>
                </div>
            </fieldset>

            <div>
                <label className="label">Notes</label>
                <textarea name="notes" className="textarea" placeholder="(optionnel)" />
            </div>

            <div className="flex items-center gap-3">
                <button disabled={loading} className="btn-primary">
                    {loading ? "Enregistrement…" : "Enregistrer le colis"}
                </button>
                {msg && <p className="text-sm">{msg}</p>}
            </div>
        </form>
    );
}