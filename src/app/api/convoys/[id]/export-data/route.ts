// src/app/api/convoys/[id]/export-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/convoys/[id]/export-data — Admin only
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const convoy = await prisma.convoy.findUnique({
        where: { id },
        include: {
            shipments: {
                orderBy: [{ receiverCity: "asc" }, { receiverName: "asc" }],
                include: {
                    items: { orderBy: { createdAt: "asc" } },
                },
            },
        },
    });

    if (!convoy) {
        return NextResponse.json({ ok: false, error: "Convoi introuvable" }, { status: 404 });
    }

    // En-tête officielle de la liste de colisage : jamais codée en dur,
    // toujours lue depuis le profil d'entreprise actif.
    const company = await prisma.companyProfile.findFirst({ where: { active: true } });

    return NextResponse.json({
        ok: true,
        company: company
            ? {
                  legalName: company.legalName,
                  displayName: company.displayName,
                  address: company.address,
                  city: company.city,
                  province: company.province,
                  postalCode: company.postalCode,
                  country: company.country,
                  email: company.email,
                  phone: company.phone,
                  neq: company.neq,
                  gstNumber: company.gstNumber,
                  qstNumber: company.qstNumber,
              }
            : null,
        convoy: {
            id: convoy.id,
            date: convoy.date,
            direction: convoy.direction,
        },
        shipments: convoy.shipments.map((s) => ({
            id: s.id,
            trackingId: s.trackingId,
            receiverName: s.receiverName,
            receiverPhone: s.receiverPhone,
            receiverCity: s.receiverCity,
            weightKg: s.weightKg,
            itemKind: s.itemKind,
            deviceType: s.deviceType,
            packageCount: s.packageCount,
            lengthCm: s.lengthCm,
            widthCm: s.widthCm,
            heightCm: s.heightCm,
            receiverAddress: s.receiverAddress,
            receiverPoBox: s.receiverPoBox,
            paymentStatus: s.paymentStatus,
            amountPaid: s.amountPaid,
            pickupLastName: s.pickupLastName,
            pickupFirstName: s.pickupFirstName,
            pickupQuartier: s.pickupQuartier,
            pickupPhone: s.pickupPhone,
            items: s.items.map((it) => ({
                id: it.id,
                label: it.label,
                quantity: it.quantity,
                weightKg: it.weightKg,
            })),
        })),
    });
}
