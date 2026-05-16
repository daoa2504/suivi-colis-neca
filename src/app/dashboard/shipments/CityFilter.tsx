// src/app/dashboard/shipments/CityFilter.tsx
"use client";

import { useRouter } from "next/navigation";

type Props = {
    cities: string[];
    currentCity: string;
    direction: string;
    searchQuery: string;
    currentConvoyId: string;
};

export default function CityFilter({
    cities,
    currentCity,
    direction,
    searchQuery,
    currentConvoyId,
}: Props) {
    const router = useRouter();

    const handleChange = (city: string) => {
        const params = new URLSearchParams();
        params.set("direction", direction);
        if (searchQuery) params.set("q", searchQuery);
        if (currentConvoyId) params.set("convoyId", currentConvoyId);
        if (city) params.set("city", city);

        router.push(`/dashboard/shipments?${params.toString()}`);
    };

    return (
        <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">Ville:</label>
            <select
                value={currentCity}
                onChange={(e) => handleChange(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
            >
                <option value="">Toutes les villes</option>
                {cities.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
        </div>
    );
}
