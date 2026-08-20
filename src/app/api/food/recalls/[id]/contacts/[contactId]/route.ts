// src/app/api/food/recalls/[id]/contacts/[contactId]/route.ts
//
// PATCH : update d'un contact rappelé (contactedAt/channel/notes,
//         productReturned/quantityReturned/returnedAt,
//         quantityDestroyed/destroyedAt, notes)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { ComplaintChannel } from "@prisma/client";

export const runtime = "nodejs";

const CHANNELS: ComplaintChannel[] = ["PHONE", "EMAIL", "WEBSITE_FORM", "IN_PERSON", "MAIL", "OTHER"];

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; contactId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id, contactId } = await params;
    const existing = await prisma.recallContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.recallId !== id) {
        return NextResponse.json({ ok: false, error: "Contact introuvable" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body.contactedAt !== undefined) {
        data.contactedAt = body.contactedAt ? new Date(body.contactedAt) : null;
    }
    if (body.contactChannel !== undefined) {
        if (!body.contactChannel) {
            data.contactChannel = null;
        } else {
            const c = String(body.contactChannel).toUpperCase() as ComplaintChannel;
            if (!CHANNELS.includes(c)) {
                return NextResponse.json({ ok: false, error: "Canal invalide" }, { status: 400 });
            }
            data.contactChannel = c;
        }
    }
    if (body.contactNotes !== undefined) data.contactNotes = body.contactNotes || null;

    if (body.productReturned !== undefined) data.productReturned = Boolean(body.productReturned);
    if (body.quantityReturned !== undefined) {
        data.quantityReturned = body.quantityReturned !== null && body.quantityReturned !== ""
            ? Number(body.quantityReturned)
            : null;
    }
    if (body.returnedAt !== undefined) {
        data.returnedAt = body.returnedAt ? new Date(body.returnedAt) : null;
    }
    if (body.quantityDestroyed !== undefined) {
        data.quantityDestroyed = body.quantityDestroyed !== null && body.quantityDestroyed !== ""
            ? Number(body.quantityDestroyed)
            : null;
    }
    if (body.destroyedAt !== undefined) {
        data.destroyedAt = body.destroyedAt ? new Date(body.destroyedAt) : null;
    }
    if (body.notes !== undefined) data.notes = body.notes || null;

    const updated = await prisma.recallContact.update({
        where: { id: contactId },
        data,
        include: {
            client: {
                select: { id: true, customerCode: true, name: true, email: true, phone: true },
            },
        },
    });

    await logAudit({
        userId: session.user?.id ?? null,
        entityType: "RecallContact",
        entityId: contactId,
        action: "UPDATE",
        before: {
            contactedAt: existing.contactedAt,
            productReturned: existing.productReturned,
        },
        after: {
            contactedAt: updated.contactedAt,
            productReturned: updated.productReturned,
        },
    });

    return NextResponse.json({ ok: true, contact: updated });
}
