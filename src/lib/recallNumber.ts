// src/lib/recallNumber.ts
// Numérotation séquentielle des rappels : RAP-YYYY-NNNN

import { prisma } from "@/lib/prisma";

export async function nextRecallNumber(year: number = new Date().getUTCFullYear()): Promise<string> {
    const prefix = `RAP-${year}-`;
    const last = await prisma.foodRecall.findFirst({
        where: { recallNumber: { startsWith: prefix } },
        orderBy: { recallNumber: "desc" },
        select: { recallNumber: true },
    });
    let seq = 1;
    if (last?.recallNumber) {
        const parts = last.recallNumber.split("-");
        const n = parseInt(parts[2] ?? "0", 10);
        if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
}
