// src/lib/complaintNumber.ts
//
// Numérotation séquentielle des plaintes alimentaires : PLA-YYYY-NNNN
// Format identique aux autres numéros (facture NIMA, lot LOT, client FCL).

import { prisma } from "@/lib/prisma";

export async function nextComplaintNumber(year: number = new Date().getUTCFullYear()): Promise<{ number: string; sequence: number; year: number }> {
    const prefix = `PLA-${year}-`;
    const last = await prisma.foodComplaint.findFirst({
        where: { complaintNumber: { startsWith: prefix } },
        orderBy: { complaintNumber: "desc" },
        select: { complaintNumber: true },
    });
    let seq = 1;
    if (last?.complaintNumber) {
        const parts = last.complaintNumber.split("-");
        const n = parseInt(parts[2] ?? "0", 10);
        if (!Number.isNaN(n)) seq = n + 1;
    }
    return {
        year,
        sequence: seq,
        number: `${prefix}${String(seq).padStart(4, "0")}`,
    };
}
