// src/app/dashboard/shipments/ConvoyFilter.tsx
"use client";

import { useRouter } from "next/navigation";

type Convoy = {
    id: string;
    date: Date;
};

type Props = {
    convoys: Convoy[];
    currentConvoyId: string;
    direction: string;
    searchQuery: string;
};

function fmtDate(d: Date) {
    // Utiliser UTC pour éviter les problèmes de fuseau horaire
    const date = new Date(d);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function ConvoyFilter({
                                         convoys,
                                         currentConvoyId,
                                         direction,
                                         searchQuery,
                                     }: Props) {
    const router = useRouter();

    const handleChange = (convoyId: string) => {
        const params = new URLSearchParams();
        params.set("direction", direction);
        if (searchQuery) params.set("q", searchQuery);
        if (convoyId) params.set("convoyId", convoyId);

        router.push(`/dashboard/shipments?${params.toString()}`);
    };

    return (
        <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">Convoi:</label>
            <select
                value={currentConvoyId}
                onChange={(e) => handleChange(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
            >
                <option value="">Tous les convois</option>
                {convoys.map((convoy) => (
                    <option key={convoy.id} value={convoy.id}>
                        {fmtDate(convoy.date)}
                    </option>
                ))}
            </select>
        </div>
    );
}