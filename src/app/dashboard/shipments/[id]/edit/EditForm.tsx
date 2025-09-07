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
    price?: number | null;
    notes?: string | null;
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
        const body = Object.fromEntries(fd.entries());
        try {
            const res = await fetch(`/api/shipments/${shipment.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data?.error || "Erreur API");
            setMsg("✅ Modifications enregistrées");
            router.refresh();
        } catch (err: any) {
            setMsg(`Erreur : ${err.message || "inconnue"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="mt-4 grid max-w-xl gap-4">
            <div>
                <label className="label">Nom destinataire</label>
                <input name="receiverName" defaultValue={shipment.receiverName} className="input" required />
            </div>
            <div>
                <label className="label">Email</label>
                <input name="receiverEmail" type="email" defaultValue={shipment.receiverEmail} className="input" required />
            </div>
            <div>
                <label className="label">Téléphone</label>
                <input name="receiverPhone" defaultValue={shipment.receiverPhone || ""} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="label">Poids (kg)</label>
                    <input name="weightKg" defaultValue={shipment.weightKg ?? ""} className="input" />
                </div>
                <div>
                    <label className="label">Prix</label>
                    <input name="price" defaultValue={shipment.price ?? ""} className="input" />
                </div>
            </div>
            <div>
                <label className="label">Notes</label>
                <textarea name="notes" defaultValue={shipment.notes || ""} className="textarea" />
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