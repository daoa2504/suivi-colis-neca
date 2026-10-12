// src/app/api/shipments/[id]/photos/route.ts
//
// Photos d'un colis : liste et envoi.
//
// Le navigateur redimensionne et compresse avant d'envoyer (voir
// ShipmentPhotos.tsx) et joint sa propre vignette. Le serveur ne retouche
// donc aucune image : il vérifie, puis écrit. Rien à installer côté serveur,
// et surtout rien à téléverser en pleine résolution depuis un téléphone sur
// données mobiles.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    MAX_BYTES,
    MAX_PHOTOS_PER_SHIPMENT,
    savePhotoFile,
    sniffImage,
} from "@/lib/photoStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "AGENT_NE", "AGENT_CA"];

async function guard(idStr: string) {
    const id = Number(idStr);
    if (!Number.isInteger(id)) {
        return { error: NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 }) };
    }

    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session.user?.role ?? "")) {
        return { error: NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 }) };
    }

    const shipment = await prisma.shipment.findUnique({
        where: { id },
        select: { id: true, trackingId: true, receiverName: true },
    });
    if (!shipment) {
        return { error: NextResponse.json({ ok: false, error: "Colis introuvable" }, { status: 404 }) };
    }

    return { id, shipment, userId: session.user?.id ?? null };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const g = await guard(idStr);
    if ("error" in g) return g.error;

    const photos = await prisma.shipmentPhoto.findMany({
        where: { shipmentId: g.id },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            caption: true,
            mimeType: true,
            byteSize: true,
            width: true,
            height: true,
            createdAt: true,
            thumbKey: true,
            createdBy: { select: { username: true } },
        },
    });

    return NextResponse.json({
        ok: true,
        trackingId: g.shipment.trackingId,
        receiverName: g.shipment.receiverName,
        photos: photos.map((p) => ({
            id: p.id,
            caption: p.caption,
            mimeType: p.mimeType,
            byteSize: p.byteSize,
            width: p.width,
            height: p.height,
            createdAt: p.createdAt,
            hasThumb: Boolean(p.thumbKey),
            takenBy: p.createdBy?.username ?? null,
        })),
    });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: idStr } = await params;
    const g = await guard(idStr);
    if ("error" in g) return g.error;

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ ok: false, error: "Envoi illisible" }, { status: 400 });
    }

    const file = form.get("photo");
    const thumb = form.get("thumb");
    const caption = (form.get("caption") as string | null)?.trim() || null;
    const width = Number(form.get("width")) || null;
    const height = Number(form.get("height")) || null;

    if (!(file instanceof Blob) || file.size === 0) {
        return NextResponse.json({ ok: false, error: "Aucune photo reçue" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { ok: false, error: `Photo trop lourde (max ${Math.round(MAX_BYTES / 1024 / 1024)} Mo)` },
            { status: 413 }
        );
    }

    const already = await prisma.shipmentPhoto.count({ where: { shipmentId: g.id } });
    if (already >= MAX_PHOTOS_PER_SHIPMENT) {
        return NextResponse.json(
            { ok: false, error: `Maximum ${MAX_PHOTOS_PER_SHIPMENT} photos par colis` },
            { status: 409 }
        );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) {
        return NextResponse.json(
            { ok: false, error: "Format non reconnu — JPEG, PNG ou WebP attendus" },
            { status: 415 }
        );
    }

    const storageKey = await savePhotoFile(g.id, bytes, kind.ext);

    // La vignette est facultative : sans elle, la galerie se rabat sur
    // l'image pleine résolution plutôt que de refuser l'envoi.
    let thumbKey: string | null = null;
    if (thumb instanceof Blob && thumb.size > 0 && thumb.size <= MAX_BYTES) {
        const thumbBytes = Buffer.from(await thumb.arrayBuffer());
        const thumbKind = sniffImage(thumbBytes);
        if (thumbKind) {
            thumbKey = await savePhotoFile(g.id, thumbBytes, thumbKind.ext, "-thumb");
        }
    }

    const photo = await prisma.shipmentPhoto.create({
        data: {
            shipmentId: g.id,
            storageKey,
            thumbKey,
            mimeType: kind.mime,
            byteSize: bytes.byteLength,
            width,
            height,
            caption,
            createdById: g.userId,
        },
        select: { id: true, caption: true, byteSize: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, photo: { ...photo, hasThumb: Boolean(thumbKey) } });
}
