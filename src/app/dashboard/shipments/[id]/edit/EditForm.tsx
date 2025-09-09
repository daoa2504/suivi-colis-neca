// src/app/dashboard/shipments/[id]/EditForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Shipment = {
    id: string;
    trackingId: string;
    receiverName: string;
    receiverEmail: string;
    receiverPhone?: string | null;
    weightKg?: number | null;
    notes?: string | null;

    // 🔸 nouveaux champs “adresse au Canada”
    receiverAddress?: string | null;
    receiverCity?: string | null;
    receiverPoBox?: string | null;
};

export default function EditForm({ shipment }: { shipment: Shipment }) {
    const router = useRouter();
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMsg(null);

        const fd = new FormData(e.currentTarget);

        // ⚠️ on typpe/normalise ce qui doit être nombre ou string optionnelle
        const payload = {
            receiverName: String(fd.get("receiverName") || "").trim(),
            receiverEmail: String(fd.get("receiverEmail") || "").trim(),
            receiverPhone: (fd.get("receiverPhone") as string) || null,
            weightKg:
                fd.get("weightKg") && String(fd.get("weightKg")).length > 0
                    ? Number(fd.get("weightKg"))
                    : null,
            notes: (fd.get("notes") as string) || null,

            // 🔸 nouveaux champs
            receiverAddress: (fd.get("receiverAddress") as string) || null,
            receiverCity: (fd.get("receiverCity") as string) || null,
            receiverPoBox: (fd.get("receiverPoBox") as string) || null,
        };

        try {
            const res = await fetch(`/dashboard/shipments/${shipment.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = res.headers.get("Content-Type")?.includes("application/json")
                ? await res.json()
                : { ok: res.ok, error: await res.text() };

            if (!res.ok || !data?.ok) {
                throw new Error((data as any)?.error || "Mise à jour échouée");
            }

            setMsg("✅ Modifications enregistrées");
            router.refresh();
        } catch (err: any) {
            setMsg(`Erreur : ${err?.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-4 grid gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="label">
                        Nom du destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        name="receiverName"
                        defaultValue={shipment.receiverName}
                        className="input"
                        required
                    />
                </div>

                <div>
                    <label className="label">
                        Email destinataire <span className="text-red-600">*</span>
                    </label>
                    <input
                        name="receiverEmail"
                        type="email"
                        defaultValue={shipment.receiverEmail}
                        className="input"
                        required
                    />
                </div>

                <div>
                    <label className="label">Téléphone</label>
                    <input
                        name="receiverPhone"
                        defaultValue={shipment.receiverPhone || ""}
                        className="input"
                        placeholder="(optionnel)"
                    />
                </div>

                <div>
                    <label className="label">Poids (kg)</label>
                    <input
                        name="weightKg"
                        type="number"
                        step="0.01"
                        defaultValue={shipment.weightKg ?? ""}
                        className="input"
                        placeholder="ex: 2.5"
                    />
                </div>
            </div>

            <fieldset className="grid gap-4">
                <legend className="label font-semibold">Adresse au Canada</legend>

                <div>
                    <label className="label">Adresse</label>
                    <input
                        name="receiverAddress"
                        defaultValue={shipment.receiverAddress || ""}
                        className="input"
                        placeholder="N°, rue…"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Ville (Canada)</label>
                        <input
                            name="receiverCity"
                            defaultValue={shipment.receiverCity || ""}
                            className="input"
                            placeholder="ex: Montréal, Toronto…"
                        />
                    </div>

                    <div>
                        <label className="label">Boîte postale</label>
                        <input
                            name="receiverPoBox"
                            defaultValue={shipment.receiverPoBox || ""}
                            className="input"
                            placeholder="ex: CP J1K2R1"
                        />
                    </div>
                </div>
            </fieldset>

            <div>
                <label className="label">Notes</label>
                <textarea
                    name="notes"
                    defaultValue={shipment.notes || ""}
                    className="textarea"
                    placeholder="(optionnel)"
                />
            </div>

            <div className="flex items-center gap-3">
                <button disabled={loading} className="btn-primary">
                    {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
                {msg && <span className="text-sm">{msg}</span>}
            </div>
        </form>
    );
}