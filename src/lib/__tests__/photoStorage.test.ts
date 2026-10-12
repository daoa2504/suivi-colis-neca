// src/lib/__tests__/photoStorage.test.ts
//
// Deux choses à ne pas casser dans le stockage des photos :
//
//  1. la reconnaissance du format par les octets, parce que le nom du
//     fichier et le Content-Type viennent du client ;
//  2. le refus des chemins qui sortent de la racine de stockage.
//
// Le reste du module touche le disque et se vérifie en s'en servant.

import { describe, expect, it } from "vitest";
import { readPhotoFile, sniffImage } from "../photoStorage";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
    Buffer.from([0x00]),
]);

describe("sniffImage", () => {
    it("reconnaît un JPEG", () => {
        expect(sniffImage(jpeg)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    });

    it("reconnaît un PNG", () => {
        expect(sniffImage(png)).toEqual({ mime: "image/png", ext: "png" });
    });

    it("reconnaît un WebP", () => {
        expect(sniffImage(webp)).toEqual({ mime: "image/webp", ext: "webp" });
    });

    it("refuse un fichier qui n'est pas une image", () => {
        // Un script envoyé sous le nom « photo.jpg » ne doit pas passer.
        expect(sniffImage(Buffer.from("<?php system($_GET[0]); ?>", "utf8"))).toBeNull();
    });

    it("refuse un en-tête tronqué", () => {
        expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
        expect(sniffImage(Buffer.alloc(0))).toBeNull();
    });

    it("ne se fie pas à la seule signature RIFF", () => {
        // Un WAV commence aussi par RIFF : c'est « WEBP » en octet 8 qui tranche.
        const wav = Buffer.concat([
            Buffer.from("RIFF", "ascii"),
            Buffer.from([0x24, 0x00, 0x00, 0x00]),
            Buffer.from("WAVE", "ascii"),
            Buffer.from([0x00]),
        ]);
        expect(sniffImage(wav)).toBeNull();
    });
});

describe("résolution des chemins", () => {
    const escapes = [
        "../../../etc/passwd",
        "shipments/../../.env",
        "/etc/passwd",
        "..\\..\\windows\\win.ini",
    ];

    it.each(escapes)("refuse de lire « %s »", async (key) => {
        // Le message importe peu ; ce qui compte est que rien ne soit lu.
        await expect(readPhotoFile(key)).rejects.toThrow();
    });

    it("laisse passer une clé normale (le fichier, lui, n'existe pas)", async () => {
        // Rejet attendu — mais pour « fichier absent », pas pour « hors du
        // stockage » : la garde ne doit pas bloquer les clés légitimes.
        await expect(
            readPhotoFile("shipments/42/abc.jpg")
        ).rejects.toThrow(/ENOENT|no such file/i);
    });
});
