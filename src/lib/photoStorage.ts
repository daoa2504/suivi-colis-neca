// src/lib/photoStorage.ts
//
// Stockage des photos de colis sur disque. Côté serveur uniquement.
//
// En production, UPLOADS_DIR pointe sur le volume Railway monté : un disque
// qui survit aux redéploiements, contrairement au système de fichiers du
// conteneur, remis à neuf à chaque build. En développement, on retombe sur
// un dossier local ignoré par git.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const STORAGE_ROOT =
    process.env.UPLOADS_DIR?.trim() || path.join(process.cwd(), ".uploads");

/** Formats acceptés, reconnus par leurs octets d'en-tête et non par le nom
 *  du fichier ni par le Content-Type, tous deux fournis par le client. */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
    {
        mime: "image/jpeg",
        ext: "jpg",
        test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
        mime: "image/png",
        ext: "png",
        test: (b) =>
            b.length > 8 &&
            b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
            b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
    },
    {
        mime: "image/webp",
        ext: "webp",
        test: (b) =>
            b.length > 12 &&
            b.toString("ascii", 0, 4) === "RIFF" &&
            b.toString("ascii", 8, 12) === "WEBP",
    },
];

/** Identifie une image d'après ses octets. `null` si ce n'en est pas une. */
export function sniffImage(bytes: Buffer): { mime: string; ext: string } | null {
    const hit = SIGNATURES.find((s) => s.test(bytes));
    return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

/** Limites. Le navigateur compresse avant l'envoi : au-delà, c'est soit un
 *  fichier qui a échappé à la compression, soit un envoi forgé. */
export const MAX_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTOS_PER_SHIPMENT = 12;

/**
 * Transforme une clé en chemin absolu, en refusant tout ce qui sortirait de
 * la racine. Les clés viennent de la base, mais une seule ligne corrompue
 * suffirait à faire lire /etc/passwd : la vérification coûte trois lignes.
 */
function resolveKey(key: string): string {
    const full = path.resolve(STORAGE_ROOT, key);
    const root = path.resolve(STORAGE_ROOT);
    if (full !== root && !full.startsWith(root + path.sep)) {
        throw new Error("Chemin de photo hors du stockage");
    }
    return full;
}

/** Écrit une image et renvoie sa clé. Un envoi par colis et par dossier :
 *  supprimer un colis revient à supprimer son dossier. */
export async function savePhotoFile(
    shipmentId: number,
    bytes: Buffer,
    ext: string,
    suffix = ""
): Promise<string> {
    const key = path.posix.join(
        "shipments",
        String(shipmentId),
        `${randomUUID()}${suffix}.${ext}`
    );
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    return key;
}

export async function readPhotoFile(key: string): Promise<Buffer> {
    return readFile(resolveKey(key));
}

/** Supprime sans se plaindre si le fichier a déjà disparu : la ligne en base
 *  est la référence, le fichier n'en est que le reflet. */
export async function deletePhotoFile(key: string): Promise<void> {
    try {
        await unlink(resolveKey(key));
    } catch (e: any) {
        if (e?.code !== "ENOENT") throw e;
    }
}
