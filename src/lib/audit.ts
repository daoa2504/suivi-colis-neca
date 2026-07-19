// src/lib/audit.ts
//
// Journal d'audit générique. Appelable depuis n'importe quelle route
// (Server Action, API Route, tRPC, script) pour tracer les opérations
// sensibles : création/modification/annulation/remboursement de factures,
// changement de taux de taxes, modification de profil entreprise, etc.
//
// Usage typique dans une route :
//   await logAudit({
//     userId: session.user?.id,
//     entityType: "Invoice",
//     entityId: invoice.id,
//     action: "CANCEL",
//     before: { status: "ISSUED" },
//     after: { status: "CANCELLED" },
//     reason: "Erreur de saisie — client jamais servi",
//   });

import { prisma } from "@/lib/prisma";

export type AuditAction =
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "CANCEL"
    | "REFUND"
    | "SEND"
    | "RESEND"
    | "LOGIN"
    | "LOGOUT"
    | "EXPORT"
    | "SETTINGS_CHANGE"
    | string; // laissé ouvert pour extensions

export interface AuditInput {
    userId?: string | null;
    entityType: string;
    entityId: string;
    action: AuditAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
    ipAddress?: string | null;
}

/** Écrit une entrée dans le journal d'audit.
 *
 *  Ne lance pas d'exception : l'audit ne doit JAMAIS faire échouer une
 *  opération métier. Les erreurs sont loggées console.warn.
 */
export async function logAudit(input: AuditInput): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: input.userId ?? null,
                entityType: input.entityType,
                entityId: input.entityId,
                action: input.action,
                before: (input.before ?? null) as any,
                after: (input.after ?? null) as any,
                reason: input.reason ?? null,
                ipAddress: input.ipAddress ?? null,
            },
        });
    } catch (e) {
        // Ne remonte pas l'erreur : audit best-effort
        console.warn("[audit] failed to log entry", {
            entityType: input.entityType,
            entityId: input.entityId,
            action: input.action,
            error: e instanceof Error ? e.message : String(e),
        });
    }
}

/** Récupère l'historique d'audit d'une entité, ordre chronologique inverse. */
export async function getAuditHistory(
    entityType: string,
    entityId: string,
    take = 50
) {
    return prisma.auditLog.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: "desc" },
        take,
    });
}

/** Récupère l'activité récente d'un utilisateur (pour vue admin). */
export async function getUserAuditActivity(userId: string, take = 50) {
    return prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
    });
}
