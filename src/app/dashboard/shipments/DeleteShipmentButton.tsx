"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteShipmentButton({ id }: { id: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm("Supprimer ce colis ? Cette action est irréversible.")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/shipments/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data?.error || "Erreur API");
            router.refresh();
        } catch (e: any) {
            alert(e.message || "Erreur lors de la suppression");
        } finally {
            setLoading(false);
        }
    }

    return (
        <button onClick={onDelete} disabled={loading} className="btn-ghost">
            {loading ? "Suppression…" : "Supprimer"}
        </button>
    );
}