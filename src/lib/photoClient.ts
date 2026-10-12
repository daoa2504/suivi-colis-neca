// src/lib/photoClient.ts
//
// Préparation des photos dans le navigateur, avant tout envoi.
//
// Une photo de téléphone pèse 3 à 6 Mo. Un agent qui en prend trois par
// colis, sur données mobiles, attendrait une minute par colis. Redimensionner
// ici ramène chaque photo à quelques centaines de kilo-octets : l'envoi est
// immédiat, le volume se remplit dix fois moins vite, et le serveur n'a
// aucune bibliothèque de traitement d'image à installer.
//
// Aucun import Node : ce module tourne côté client.

/** Côté le plus long de l'image conservée. Assez pour lire une étiquette,
 *  sans conserver du 4000 px dont personne ne fera rien. */
const FULL_MAX_EDGE = 1600;
/** Vignette de la galerie. */
const THUMB_MAX_EDGE = 320;

const FULL_QUALITY = 0.78;
const THUMB_QUALITY = 0.7;

export type PreparedPhoto = {
    /** Clé locale, pour les listes React avant tout aller-retour serveur. */
    localId: string;
    full: Blob;
    thumb: Blob | null;
    width: number;
    height: number;
    /** Aperçu immédiat, sans attendre l'envoi. À révoquer après usage. */
    previewUrl: string;
    originalName: string;
    originalBytes: number;
    caption: string;
};

function scaled(width: number, height: number, maxEdge: number) {
    const longest = Math.max(width, height);
    if (longest <= maxEdge) return { w: width, h: height };
    const ratio = maxEdge / longest;
    return { w: Math.round(width * ratio), h: Math.round(height * ratio) };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
    // `imageOrientation` applique la rotation EXIF : sans ça, les photos
    // prises en portrait arrivent couchées.
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch {
            // Navigateur sans cette option, ou format qu'il ne décode pas :
            // on tente la voie <img> ci-dessous avant d'abandonner.
        }
    }

    const url = URL.createObjectURL(file);
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Image illisible"));
            img.src = url;
        });
    } finally {
        // L'image est décodée : l'URL ne sert plus. La révoquer plus tôt
        // annulerait le chargement.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))),
            "image/jpeg",
            quality
        );
    });
}

async function render(
    source: ImageBitmap | HTMLImageElement,
    srcW: number,
    srcH: number,
    maxEdge: number,
    quality: number
): Promise<Blob> {
    const { w, h } = scaled(srcW, srcH, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    // Fond blanc : un PNG transparent aplati en JPEG donnerait du noir.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
    return toBlob(canvas, quality);
}

/**
 * Redimensionne, compresse et fabrique la vignette. Lève une erreur en
 * français si le fichier n'est pas une image que le navigateur sait décoder
 * — un HEIC d'iPhone sur un navigateur de bureau, typiquement.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
    const source = await decode(file).catch(() => {
        throw new Error(
            `« ${file.name} » n'a pas pu être lue. Formats sûrs : JPEG, PNG, WebP.`
        );
    });

    const srcW = "width" in source ? source.width : 0;
    const srcH = "height" in source ? source.height : 0;
    if (!srcW || !srcH) throw new Error(`« ${file.name} » est vide ou illisible.`);

    const full = await render(source, srcW, srcH, FULL_MAX_EDGE, FULL_QUALITY);
    let thumb: Blob | null = null;
    try {
        thumb = await render(source, srcW, srcH, THUMB_MAX_EDGE, THUMB_QUALITY);
    } catch {
        // La galerie se rabattra sur l'image complète.
    }

    if (typeof (source as ImageBitmap).close === "function") {
        (source as ImageBitmap).close();
    }

    const { w, h } = scaled(srcW, srcH, FULL_MAX_EDGE);

    return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        full,
        thumb,
        width: w,
        height: h,
        previewUrl: URL.createObjectURL(thumb ?? full),
        originalName: file.name,
        originalBytes: file.size,
        caption: "",
    };
}

/** Envoie une photo déjà préparée. Renvoie l'erreur du serveur telle quelle,
 *  elle est rédigée pour être affichée. */
export async function uploadPreparedPhoto(
    shipmentId: number,
    photo: PreparedPhoto
): Promise<{ ok: true } | { ok: false; error: string }> {
    const body = new FormData();
    body.append("photo", photo.full, "photo.jpg");
    if (photo.thumb) body.append("thumb", photo.thumb, "thumb.jpg");
    body.append("width", String(photo.width));
    body.append("height", String(photo.height));
    if (photo.caption.trim()) body.append("caption", photo.caption.trim());

    const res = await fetch(`/api/shipments/${shipmentId}/photos`, {
        method: "POST",
        body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
        return { ok: false, error: json?.error || `Envoi refusé (${res.status})` };
    }
    return { ok: true };
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} ko`;
    return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

/**
 * Envoie une série de photos pour un colis qui vient d'être créé.
 *
 * N'échoue jamais en bloc : le colis est déjà enregistré à ce stade, et une
 * photo perdue ne doit pas faire croire à l'agent que sa saisie a échoué.
 * Les aperçus sont révoqués au passage.
 */
export async function uploadPreparedPhotos(
    shipmentId: number,
    photos: PreparedPhoto[]
): Promise<{ sent: number; failed: string[] }> {
    let sent = 0;
    const failed: string[] = [];

    for (const photo of photos) {
        try {
            const res = await uploadPreparedPhoto(shipmentId, photo);
            if (res.ok) sent++;
            else failed.push(res.error);
        } catch (e: any) {
            failed.push(e?.message || "Envoi interrompu");
        } finally {
            URL.revokeObjectURL(photo.previewUrl);
        }
    }

    return { sent, failed };
}

/** Phrase à ajouter au message de succès quand des photos accompagnaient la
 *  saisie. Vide s'il n'y en avait aucune. */
export function photoOutcomeMessage(
    total: number,
    result: { sent: number; failed: string[] }
): string {
    if (total === 0) return "";
    if (result.failed.length === 0) {
        return ` ${result.sent} photo${result.sent > 1 ? "s" : ""} enregistrée${result.sent > 1 ? "s" : ""}.`;
    }
    return (
        ` ⚠️ ${result.failed.length} photo(s) sur ${total} n'ont pas pu être envoyées` +
        ` — ajoutez-les depuis la fiche du colis. (${result.failed[0]})`
    );
}
