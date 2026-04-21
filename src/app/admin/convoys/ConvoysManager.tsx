"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Convoy = {
    id: string;
    date: string;
    direction: "NE_TO_CA" | "CA_TO_NE";
    totalShipments: number;
};

export default function ConvoysManager({ initialConvoys }: { initialConvoys: Convoy[] }) {
    const router = useRouter();
    const [convoys, setConvoys] = useState<Convoy[]>(initialConvoys);
    const [date, setDate] = useState("");
    const [direction, setDirection] = useState<"NE_TO_CA" | "CA_TO_NE">("CA_TO_NE");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    async function onCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const res = await fetch("/api/convoys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, direction }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                const err = typeof data.error === "string" ? data.error : "Création échouée";
                throw new Error(err);
            }
            setConvoys((prev) =>
                [
                    {
                        id: data.convoy.id,
                        date: new Date(data.convoy.date).toISOString().slice(0, 10),
                        direction: data.convoy.direction,
                        totalShipments: 0,
                    },
                    ...prev,
                ].sort((a, b) => (a.date < b.date ? 1 : -1))
            );
            setDate("");
            setMsg("✅ Convoi créé");
            router.refresh();
        } catch (err: any) {
            setMsg(`❌ ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function onDelete(id: string) {
        if (!confirm("Supprimer ce convoi ?")) return;
        try {
            const res = await fetch(`/api/convoys/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setMsg(`❌ ${data.error || "Suppression échouée"}`);
                return;
            }
            setConvoys((prev) => prev.filter((c) => c.id !== id));
            setMsg("✅ Convoi supprimé");
            router.refresh();
        } catch (err: any) {
            setMsg(`❌ ${err.message}`);
        }
    }

    const dirLabel = (d: Convoy["direction"]) => (d === "NE_TO_CA" ? "NE → CA" : "CA → NE");

    return (
        <div className="space-y-8">
            {/* Formulaire de création */}
            <section className="bg-white p-6 rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold mb-4">Créer un nouveau convoi</h2>
                <form onSubmit={onCreate} className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="border p-2 rounded w-48"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Direction</label>
                        <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value as any)}
                            className="border p-2 rounded w-48"
                        >
                            <option value="CA_TO_NE">Canada → Niger</option>
                            <option value="NE_TO_CA">Niger → Canada</option>
                        </select>
                    </div>
                    <button
                        disabled={loading || !date}
                        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-60"
                    >
                        {loading ? "Création…" : "Créer le convoi"}
                    </button>
                </form>
                {msg && (
                    <div
                        className={`mt-4 p-3 rounded text-sm ${
                            msg.startsWith("✅")
                                ? "bg-green-50 text-green-800 border border-green-200"
                                : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                    >
                        {msg}
                    </div>
                )}
            </section>

            {/* Liste des convois */}
            <section className="bg-white rounded-lg border shadow-sm">
                <h2 className="text-lg font-semibold p-4 border-b">Convois existants ({convoys.length})</h2>
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Direction</th>
                        <th className="text-left p-3">Colis</th>
                        <th className="text-left p-3">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {convoys.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-mono">{c.date}</td>
                            <td className="p-3">
                  <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          c.direction === "CA_TO_NE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                      }`}
                  >
                    {dirLabel(c.direction)}
                  </span>
                            </td>
                            <td className="p-3">{c.totalShipments}</td>
                            <td className="p-3">
                                <button
                                    onClick={() => onDelete(c.id)}
                                    disabled={c.totalShipments > 0}
                                    title={c.totalShipments > 0 ? "Impossible : colis rattachés" : "Supprimer"}
                                    className="text-red-600 hover:underline text-xs disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                                >
                                    Supprimer
                                </button>
                            </td>
                        </tr>
                    ))}
                    {convoys.length === 0 && (
                        <tr>
                            <td colSpan={4} className="p-6 text-center text-gray-500">
                                Aucun convoi. Créez-en un ci-dessus.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
