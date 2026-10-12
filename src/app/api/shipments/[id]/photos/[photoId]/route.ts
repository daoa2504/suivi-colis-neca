// src/app/api/shipments/[id]/photos/[photoId]/route.ts
//
// Une photo : octets, légende, suppression.
//
// Les octets passent par cette route plutôt que par /public : ce sont les
// colis de clients, parfois ouverts. Un fichier servi statiquement est
// lisible de quiconque devine son URL ; ici, il faut une session.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deletePhotoFile, readPhotoFile } from "@/lib/photoStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "AGENT_NE", "AGENT_CA"];

async function load(idStr: string, photoId: string) {
    const shipmentId = Number(idStr);
    if (!Number.isInteger(shipmentId)) {
        return { error: NextResponse.json({ ok: false, error: "Identifiant invalide" }, { status: 400 }) };
    }

    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session.user?.role ?? "")) {
        return { error: NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 }) };
    }

    const photo = await prisma.shipmentPhoto.findFirst({
        where: { id: photoId, shipmentId },
    });
    if (!photo) {
        return { error: NextResponse.json({ ok: false, error: "Photo introuvable" }, { status: 404 }) };
    }

    return { photo, session };
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string; photoId: string }> }
) {
    const { id, photoId } = await params;
    const r = await load(id, photoId);
    if ("error" in r) return r.error;

    const wantsThumb = new URL(req.url).searchParams.get("size") === "thumb";
    const key = wantsThumb && r.photo.thumbKey ? r.photo.thumbKey : r.photo.storageKey;

    let bytes: Buffer;
    try {
        bytes = await readPhotoFile(key);
    } catch (e: any) {
        // Ligne en base sans fichier : volume non monté, ou fichier perdu.
        // Le dire franchement plutôt que de servir une image vide.
        console.error(`[photos] fichier manquant pour ${photoId} (${key})`, e?.code ?? e);
        return NextResponse.json(
            { ok: false, error: "Fichier de la photo introuvable sur le stockage" },
            { status: 404 }
        );
    }

    return new NextResponse(new Uint8Array(bytes), {
        headers: {
            "Content-Type": r.photo.mimeType,
            "Content-Length": String(bytes.byteLength),
            // Le contenu d'une photo ne change jamais : le cache du
            // navigateur peut la garder. `private` empêche tout cache
            // partagé en chemin de la conserver.
            "Cache-Control": "private, max-age=31536000, immutable",
            "Content-Disposition": `inline; filename="${r.photo.id}"`,
        },
    });
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string; photoId: string }> }
) {
    const { id, photoId } = await params;
    const r = await load(id, photoId);
    if ("error" in r) return r.error;

    const body = await req.json().catch(() => ({} as any));
    const raw = typeof body.caption === "string" ? body.caption.trim() : "";
    const caption = raw ? raw.slice(0, 200) : null;

    await prisma.shipmentPhoto.update({ where: { id: photoId }, data: { caption } });
    return NextResponse.json({ ok: true, caption });
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string; photoId: string }> }
) {
    const { id, photoId } = await params;
    const r = await load(id, photoId);
    if ("error" in r) return r.error;

    // Un agent peut retirer une photo qu'il vient de prendre de travers ;
    // retirer celle d'un collègue relève de l'administrateur.
    const isAdmin = r.session.user?.role === "ADMIN";
    const isAuthor = r.photo.createdById && r.photo.createdById === r.session.user?.id;
    if (!isAdmin && !isAuthor) {
        return NextResponse.json(
            { ok: false, error: "Seul l'auteur de la photo ou un administrateur peut la supprimer" },
            { status: 403 }
        );
    }

    // Base d'abord : une ligne supprimée sans son fichier ne laisse qu'un
    // octet perdu, l'inverse laisse une vignette cassée dans la galerie.
    await prisma.shipmentPhoto.delete({ where: { id: photoId } });
    await deletePhotoFile(r.photo.storageKey);
    if (r.photo.thumbKey) await deletePhotoFile(r.photo.thumbKey);

    return NextResponse.json({ ok: true });
}
