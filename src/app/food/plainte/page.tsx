// src/app/food/plainte/page.tsx
// Formulaire public de plainte alimentaire (Article 82 RSAC).

import ComplaintForm from "./ComplaintForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
    title: "Signaler un problème produit — NIMAPLEX",
    description: "Déposer une plainte concernant un produit alimentaire importé.",
};

export default function FoodComplaintPage() {
    return (
        <main className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header brand */}
                <div className="flex items-center gap-3 mb-6">
                    <img src="/img.png" alt="NIMAPLEX" className="w-14 h-14 rounded-lg shadow-sm" />
                    <div>
                        <div className="text-xl font-bold text-gray-900">
                            NIMAPLEX<span className="text-[10px] font-semibold align-baseline ml-0.5">.INC</span>
                        </div>
                        <p className="text-xs text-gray-500">Traçabilité alimentaire · ACIA</p>
                    </div>
                </div>

                {/* Bandeau explicatif */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r">
                    <h1 className="text-lg font-bold text-blue-900 mb-1">
                        Signaler un problème sur un produit
                    </h1>
                    <p className="text-sm text-blue-800">
                        Merci de nous aider à améliorer la qualité de nos produits. Toute plainte
                        est enregistrée dans notre registre officiel conformément à l'Article 82
                        du RSAC. Un membre de notre équipe vous recontactera rapidement.
                    </p>
                </div>

                <ComplaintForm />

                <p className="text-xs text-gray-500 text-center mt-6">
                    Groupe NIMAPLEX INC. · Conservation minimale 2 ans (Art. 82 RSAC) ·
                    <a href="/" className="text-blue-600 hover:underline ml-1">Retour à l'accueil</a>
                </p>
            </div>
        </main>
    );
}
