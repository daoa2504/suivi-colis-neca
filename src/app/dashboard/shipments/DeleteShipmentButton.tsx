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
            const res = await fetch(`/dashboard/shipments/${id}`, {
                method: "DELETE",
                headers: { Accept: "application/json" },
            });
            const data =
                res.headers.get("Content-Type")?.includes("application/json")
                    ? await res.json()
                    : { ok: false, error: await res.text()};
            if (!res.ok || !data.ok) throw new Error(data?.error || "Suppression échouée");
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