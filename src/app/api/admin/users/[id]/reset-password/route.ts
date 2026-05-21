// src/app/api/admin/users/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import crypto from "crypto";

export const runtime = "nodejs";

function generatePassword(length = 14): string {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%&*";
    const all = lower + upper + digits + symbols;
    const buf = crypto.randomBytes(length);
    let pwd = "";
    // garantit au moins 1 char de chaque catégorie
    pwd += lower[buf[0] % lower.length];
    pwd += upper[buf[1] % upper.length];
    pwd += digits[buf[2] % digits.length];
    pwd += symbols[buf[3] % symbols.length];
    for (let i = 4; i < length; i++) pwd += all[buf[i] % all.length];
    // shuffle
    return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

// POST /api/admin/users/[id]/reset-password — ADMIN only
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        return NextResponse.json({ ok: false, error: "Utilisateur introuvable" }, { status: 404 });
    }

    const newPassword = generatePassword(14);
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hash } });

    return NextResponse.json({
        ok: true,
        username: user.username,
        newPassword, // ⚠️ Affiché une seule fois côté UI, jamais stocké en clair
    });
}
