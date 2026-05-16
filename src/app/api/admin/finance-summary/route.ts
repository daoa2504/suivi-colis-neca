// src/app/api/admin/finance-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { convert, type Currency } from "@/lib/forex";

export const runtime = "nodejs";

/**
 * GET /api/admin/finance-summary?currency=CAD
 * Renvoie :
 * - monthly: 12 derniers mois { month, income, expense, balance }
 * - byConvoy: par convoi { convoyId, label, date, income, expense, balance }
 * - byCategory: dépenses par catégorie { category, total }
 * - totals: { income, expense, balance } sur l'ensemble
 * Tous les montants sont convertis dans la devise demandée.
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetCurrency = (searchParams.get("currency") || "CAD").toUpperCase() as Currency;
    if (!["CAD", "XOF"].includes(targetCurrency)) {
        return NextResponse.json({ ok: false, error: "Devise non supportée" }, { status: 400 });
    }

    // Pré-calcule les taux pour ne pas appeler N fois la même conversion
    const otherCurrency: Currency = targetCurrency === "CAD" ? "XOF" : "CAD";
    const conversionRate = await convert(1, otherCurrency, targetCurrency); // 1 other = X target

    function normalize(amount: number, currency: string): number {
        if (currency === targetCurrency) return amount;
        return amount * conversionRate;
    }

    const [payments, expenses, convoys] = await Promise.all([
        prisma.payment.findMany({
            include: { shipment: { select: { convoyId: true } } },
        }),
        prisma.expense.findMany(),
        prisma.convoy.findMany({
            orderBy: { date: "desc" },
            take: 24,
            select: { id: true, date: true, direction: true },
        }),
    ]);

    // === Totaux globaux ===
    const totalIncome = payments.reduce((s, p) => s + normalize(p.amount, p.currency), 0);
    const totalExpense = expenses.reduce((s, e) => s + normalize(e.amount, e.currency), 0);

    // === Mensuel (12 derniers mois) ===
    const now = new Date();
    const months: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("fr-CA", { month: "short", year: "numeric", timeZone: "UTC" });
        months.push({ key, label, income: 0, expense: 0 });
    }
    const monthIndex: Record<string, number> = {};
    months.forEach((m, i) => (monthIndex[m.key] = i));

    for (const p of payments) {
        const d = new Date(p.paidAt);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const i = monthIndex[key];
        if (i !== undefined) months[i].income += normalize(p.amount, p.currency);
    }
    for (const e of expenses) {
        const d = new Date(e.date);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        const i = monthIndex[key];
        if (i !== undefined) months[i].expense += normalize(e.amount, e.currency);
    }

    // === Par convoi ===
    const convoyMap = new Map<
        string,
        { convoyId: string; label: string; date: string; income: number; expense: number }
    >();
    for (const c of convoys) {
        const dateStr = new Date(c.date).toISOString().slice(0, 10);
        const dirStr = c.direction === "CA_TO_NE" ? "CA → NE" : "NE → CA";
        convoyMap.set(c.id, {
            convoyId: c.id,
            label: `${dateStr} (${dirStr})`,
            date: dateStr,
            income: 0,
            expense: 0,
        });
    }
    for (const p of payments) {
        const cid = p.shipment.convoyId;
        if (cid && convoyMap.has(cid)) {
            convoyMap.get(cid)!.income += normalize(p.amount, p.currency);
        }
    }
    for (const e of expenses) {
        if (e.convoyId && convoyMap.has(e.convoyId)) {
            convoyMap.get(e.convoyId)!.expense += normalize(e.amount, e.currency);
        }
    }

    // === Par catégorie de dépense ===
    const byCategoryMap: Record<string, number> = {};
    for (const e of expenses) {
        byCategoryMap[e.category] = (byCategoryMap[e.category] || 0) + normalize(e.amount, e.currency);
    }
    const byCategory = Object.entries(byCategoryMap).map(([category, total]) => ({
        category,
        total,
    }));

    return NextResponse.json({
        ok: true,
        currency: targetCurrency,
        totals: {
            income: totalIncome,
            expense: totalExpense,
            balance: totalIncome - totalExpense,
        },
        monthly: months.map((m) => ({
            label: m.label,
            income: Number(m.income.toFixed(2)),
            expense: Number(m.expense.toFixed(2)),
            balance: Number((m.income - m.expense).toFixed(2)),
        })),
        byConvoy: Array.from(convoyMap.values())
            .map((c) => ({
                ...c,
                income: Number(c.income.toFixed(2)),
                expense: Number(c.expense.toFixed(2)),
                balance: Number((c.income - c.expense).toFixed(2)),
            }))
            .sort((a, b) => (a.date < b.date ? 1 : -1)),
        byCategory: byCategory.map((c) => ({
            ...c,
            total: Number(c.total.toFixed(2)),
        })),
    });
}
