"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteShipmentButton({
    id,
    trackingId,
}: {
    id: number;
    trackingId: string;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm(`Supprimer définitivement le colis ${trackingId} ? Cette action est irréversible.`)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/shipments/${id}`, {
                method: "DELETE",
                headers: { Accept: "application/json" },
            });
            const data =
                res.headers.get("Content-Type")?.includes("application/json")
                    ? await res.json()
                    : { ok: false, error: await res.text() };
            if (!res.ok || !data.ok) throw new Error(data?.error || "Suppression échouée");
            router.refresh();
        } catch (e: any) {
            alert(`❌ ${e.message || "Erreur lors de la suppression"}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={onDelete}
            disabled={loading}
            className="text-lg hover:scale-110 transition-transform disabled:opacity-50"
            title={loading ? "Suppression…" : "Supprimer (admin)"}
        >
            {loading ? "⏳" : "🗑️"}
        </button>
    );
}