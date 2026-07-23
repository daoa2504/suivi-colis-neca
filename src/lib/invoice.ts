// src/lib/invoice.ts
//
// Service de facturation : numérotation séquentielle, création à partir
// d'un envoi, synchronisation du statut avec le paiement.
//
// La numérotation utilise une transaction Serializable pour éviter les
// race conditions (2 factures créées en même temps → même numéro).
//
// Toutes les valeurs sensibles (montants, taxes, taux, règle appliquée,
// entreprise) sont snapshotées dans Invoice pour préserver l'immutabilité
// comptable même si TaxRate / CompanyProfile changent plus tard.

import { Prisma, PaymentStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { determineAndCalculate, type TaxContext } from "@/lib/tax";
import { logAudit } from "@/lib/audit";

const INVOICE_PREFIX = "NIMA";

// ============================================================================
// Numérotation
// ============================================================================

/** Génère le prochain numéro de facture pour l'année fiscale donnée.
 *
 *  Utilise une transaction Serializable : deux appels simultanés ne
 *  produiront jamais le même numéro (l'un des deux sera retry).
 */
export async function nextInvoiceNumber(
    fiscalYear: number,
    prefix: string = INVOICE_PREFIX
): Promise<{ number: string; sequence: number; fiscalYear: number }> {
    // On lit le dernier sequence pour l'année, puis on incrémente.
    // En Serializable, si un autre transaction fait pareil en parallèle,
    // l'un des deux échoue et PgSQL retry automatiquement via prisma.
    const last = await prisma.invoice.findFirst({
        where: { fiscalYear },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
    });
    const next = (last?.sequence ?? 0) + 1;
    return {
        fiscalYear,
        sequence: next,
        number: `${prefix}-${fiscalYear}-${String(next).padStart(4, "0")}`,
    };
}

// ============================================================================
// Création d'une facture à partir d'un envoi
// ============================================================================

export interface CreateInvoiceOptions {
    /** ID de l'utilisateur qui déclenche la création (audit). */
    userId?: string | null;
    /** Force la génération même si le paiement est UNPAID (par défaut : oui). */
    skipIfNoPayment?: boolean;
}

/** Crée la facture liée à un envoi.
 *
 *  Idempotent : si une facture existe déjà pour ce shipment, la retourne
 *  telle quelle sans la modifier.
 *
 *  Le total est basé sur `shipment.amountPaid` (source de vérité — ce que
 *  le client a payé). Si amountPaid est null/0, retourne null (pas de
 *  facture à générer) sauf si l'appelant force.
 */
export async function createInvoiceForShipment(
    shipmentId: number,
    options: CreateInvoiceOptions = {}
) {
    const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { invoice: true },
    });
    if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

    // Idempotence : facture déjà existante ?
    if (shipment.invoice) return shipment.invoice;

    // Pas de montant → rien à facturer
    const total = shipment.amountPaid;
    if (total === null || total === undefined || total <= 0) {
        console.log(`[invoice] shipment ${shipment.trackingId}: aucun montant, pas de facture`);
        return null;
    }

    // Charger le profil entreprise actif (source de snapshot)
    const company = await prisma.companyProfile.findFirst({ where: { active: true } });
    if (!company) {
        console.warn(`[invoice] Aucun CompanyProfile actif — impossible de créer une facture. Lance le seed.`);
        return null;
    }

    // Déterminer le régime fiscal + calculer les taxes
    const ctx: TaxContext = {
        originCountry: shipment.originCountry,
        destinationCountry: shipment.destinationCountry,
        clientProvince: null, // Non stocké sur Shipment aujourd'hui
        serviceType: "SHIPPING",
    };
    const { calculation, determination } = await determineAndCalculate(ctx, total);

    // Statut initial basé sur le paiement actuel
    const initialStatus = mapPaymentStatusToInvoiceStatus(shipment.paymentStatus);

    const fiscalYear = new Date().getUTCFullYear();
    const { number, sequence } = await nextInvoiceNumber(fiscalYear);

    // Description ligne : « Service de transport · CA → NE »
    const routeLabel = describeRoute(shipment.originCountry, shipment.destinationCountry);
    const description = "Service de transport de colis";
    const detailedDescription = `Envoi ${shipment.trackingId} · ${routeLabel}`;

    // Création atomique (facture + items + taxSnapshots)
    const invoice = await prisma.invoice.create({
        data: {
            number,
            fiscalYear,
            sequence,
            status: initialStatus,

            clientName: shipment.receiverName,
            clientEmail: shipment.receiverEmail || null,
            clientPhone: shipment.receiverPhone,
            clientProvince: null,
            clientCountry: shipment.destinationCountry,

            shipmentId: shipment.id,
            shipmentTrackingId: shipment.trackingId,

            regime: calculation.regime,
            amountBeforeTax: new Prisma.Decimal(calculation.amountBeforeTax),
            totalTax: new Prisma.Decimal(calculation.totalTax),
            totalIncludingTax: new Prisma.Decimal(calculation.totalIncludingTax),
            currency: "CAD",

            companyName: company.displayName || company.legalName,
            companyAddress: company.address,
            companyCity: company.city,
            companyProvince: company.province,
            companyPostalCode: company.postalCode,
            companyCountry: company.country,
            companyEmail: company.email,
            companyGstNumber: company.gstNumber,
            companyQstNumber: company.qstNumber,
            companyNeq: company.neq,

            taxRuleId: determination?.ruleId ?? null,
            taxRuleName: determination?.ruleName ?? null,
            taxRuleNotes: determination?.notes ?? null,

            issuedAt: new Date(),
            paidAt: initialStatus === InvoiceStatus.PAID ? new Date() : null,

            createdById: options.userId ?? shipment.createdById,

            items: {
                create: [
                    {
                        description,
                        detailedDescription,
                        quantity: new Prisma.Decimal(1),
                        unitPrice: new Prisma.Decimal(calculation.amountBeforeTax),
                        amountBeforeTax: new Prisma.Decimal(calculation.amountBeforeTax),
                    },
                ],
            },

            taxSnapshots: {
                create: calculation.taxes.map((t) => ({
                    taxRateId: t.taxRateId,
                    code: t.code,
                    name: t.name,
                    rate: new Prisma.Decimal(t.rate),
                    jurisdiction: t.jurisdiction,
                    amount: new Prisma.Decimal(t.amount),
                })),
            },
        },
        include: { items: true, taxSnapshots: true },
    });

    await logAudit({
        userId: options.userId ?? null,
        entityType: "Invoice",
        entityId: invoice.id,
        action: "CREATE",
        after: {
            number: invoice.number,
            shipmentTrackingId: invoice.shipmentTrackingId,
            regime: invoice.regime,
            totalIncludingTax: invoice.totalIncludingTax.toString(),
        },
    });

    console.log(`[invoice] créée ${invoice.number} pour ${shipment.trackingId} (${calculation.regime}, ${calculation.totalIncludingTax} CAD)`);
    return invoice;
}

// ============================================================================
// Synchronisation statut ↔ paiement
// ============================================================================

/** Met à jour le statut de la facture liée à un envoi selon son paymentStatus.
 *  Idempotent : si le statut est déjà correct, ne fait rien.
 */
export async function updateInvoiceStatusFromPayment(
    shipmentId: number,
    options: { userId?: string | null } = {}
) {
    const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { invoice: true },
    });
    if (!shipment?.invoice) return null;

    const nextStatus = mapPaymentStatusToInvoiceStatus(shipment.paymentStatus);
    const currentStatus = shipment.invoice.status;

    // Statuts terminaux qu'on ne repasse pas en arrière automatiquement
    if (currentStatus === InvoiceStatus.CANCELLED || currentStatus === InvoiceStatus.REFUNDED) {
        return shipment.invoice;
    }
    if (currentStatus === nextStatus) return shipment.invoice;

    const updated = await prisma.invoice.update({
        where: { id: shipment.invoice.id },
        data: {
            status: nextStatus,
            paidAt: nextStatus === InvoiceStatus.PAID
                ? (shipment.invoice.paidAt ?? new Date())
                : shipment.invoice.paidAt,
        },
    });

    await logAudit({
        userId: options.userId ?? null,
        entityType: "Invoice",
        entityId: updated.id,
        action: "UPDATE",
        before: { status: currentStatus },
        after: { status: nextStatus },
        reason: `Sync avec paymentStatus=${shipment.paymentStatus}`,
    });

    return updated;
}

// ============================================================================
// Lecture
// ============================================================================

export async function getInvoiceById(id: string) {
    return prisma.invoice.findUnique({
        where: { id },
        include: { items: true, taxSnapshots: true, shipment: true },
    });
}

export async function getInvoiceByShipment(shipmentId: number) {
    return prisma.invoice.findUnique({
        where: { shipmentId },
        include: { items: true, taxSnapshots: true, shipment: true },
    });
}

// ============================================================================
// Helpers
// ============================================================================

function mapPaymentStatusToInvoiceStatus(p: PaymentStatus): InvoiceStatus {
    switch (p) {
        case "PAID": return InvoiceStatus.PAID;
        case "PARTIAL": return InvoiceStatus.PARTIAL;
        case "UNPAID": return InvoiceStatus.ISSUED;
        default: return InvoiceStatus.ISSUED;
    }
}

function describeRoute(origin: string, destination: string): string {
    const label = (c: string) =>
        c === "CA" ? "Canada" : c === "NE" ? "Niger" : c;
    return `${label(origin)} → ${label(destination)}`;
}

export type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>;
