"use client";

import { useState } from "react";
import SendCustomEmailModal from "@/components/SendCustomEmailModal";

export default function CustomEmailLauncher() {
    const [open, setOpen] = useState(false);
    const [defaultDirection, setDefaultDirection] = useState<"" | "NE_TO_CA" | "CA_TO_NE">("");

    function openWith(dir: "" | "NE_TO_CA" | "CA_TO_NE") {
        setDefaultDirection(dir);
        setOpen(true);
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => openWith("CA_TO_NE")}
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-red-400 transition-all text-left"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <img src="/flags/ca.svg" alt="CA" className="w-7 h-5 rounded-sm border border-gray-200" />
                        <span className="text-gray-500">→</span>
                        <img src="/flags/ne.svg" alt="NE" className="w-7 h-5 rounded-sm border border-gray-200" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">Clients Canada → Niger</h3>
                    <p className="text-sm text-gray-600">
                        Cibler uniquement les clients qui envoient un colis vers le Niger.
                    </p>
                </button>

                <button
                    onClick={() => openWith("NE_TO_CA")}
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-green-400 transition-all text-left"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <img src="/flags/ne.svg" alt="NE" className="w-7 h-5 rounded-sm border border-gray-200" />
                        <span className="text-gray-500">→</span>
                        <img src="/flags/ca.svg" alt="CA" className="w-7 h-5 rounded-sm border border-gray-200" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">Clients Niger → Canada</h3>
                    <p className="text-sm text-gray-600">
                        Cibler uniquement les clients dont le colis vient du Niger.
                    </p>
                </button>

                <button
                    onClick={() => openWith("")}
                    className="block p-6 bg-white rounded-lg border shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left"
                >
                    <div className="text-2xl mb-2">✉️</div>
                    <h3 className="font-semibold text-lg mb-1">Tous les clients</h3>
                    <p className="text-sm text-gray-600">
                        Ouvrir le modal sans préfiltre, vous filtrez ensuite dedans (direction, convoi).
                    </p>
                </button>
            </div>

            <SendCustomEmailModal
                isOpen={open}
                onClose={() => setOpen(false)}
                defaultDirection={defaultDirection}
            />
        </>
    );
}
