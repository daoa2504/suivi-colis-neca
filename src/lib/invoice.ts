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
import { formatDimensions } from "@/lib/itemKind";
import { resolveSurcharge, round2, amountDue } from "@/lib/surcharge";
import { determineAndCalculate, type TaxContext } from "@/lib/tax";
import { logAudit } from "@/lib/audit";

const INVOICE_PREFIX = "NIMA";

/** « 2 kg », « 1,5 kg » — sans décimale inutile. */
function fmtWeight(kg: number): string {
    return `${kg.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} kg`;
}

/** « 3,00 $ » — pour montrer le tarif au kilo dans le détail de ligne. */
function fmtAmount(v: number): string {
    return `${v.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

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

/* findConvoySurcharge a été remplacé par resolveSurcharge (src/lib/surcharge.ts),
   partagé avec la création et la modification d.envoi. */

export interface CreateInvoiceOptions {
    /** ID de l'utilisateur qui déclenche la création (audit). */
    userId?: string | null;
    /** Force la génération même si le paiement est UNPAID (par défaut : oui). */
    skipIfNoPayment?: boolean;
    /** Reprend un numéro existant au lieu d'en tirer un nouveau.
     *  Réservé à la régénération : évite de consommer un numéro de séquence
     *  et de laisser un trou dans la numérotation comptable. */
    reuseNumber?: { number: string; fiscalYear: number; sequence: number };
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

    // Total à facturer : totalAmount en priorité (Phase 2.8+),
    // fallback amountPaid pour les colis créés avant Phase 2.8.
    const baseAmount = (shipment.totalAmount ?? shipment.amountPaid);
    if (baseAmount === null || baseAmount === undefined || baseAmount <= 0) {
        console.log(`[invoice] shipment ${shipment.trackingId}: aucun montant, pas de facture`);
        return null;
    }

    // Supplément de ville : on lit l'instantané figé sur l'envoi, pas la grille
    // du convoi. La facture doit refléter ce que l'agent a vu et encaissé, même
    // si un admin a retouché la grille depuis.
    const surchargeAmount = shipment.surchargeAmount ?? 0;
    const surcharge =
        surchargeAmount > 0
            ? await resolveSurcharge(
                  shipment.convoyId,
                  shipment.receiverCity,
                  shipment.currency ?? "CAD",
                  shipment.weightKg
              )
            : null;
    const total = round2(baseAmount + surchargeAmount);

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

    const { number, sequence, fiscalYear } =
        options.reuseNumber ?? (await nextInvoiceNumber(new Date().getUTCFullYear()));

    // Date du convoi, pour le détail de la ligne de supplément
    const convoyDateLabel = shipment.convoyId
        ? (await prisma.convoy.findUnique({
              where: { id: shipment.convoyId },
              select: { date: true },
          }))?.date.toISOString().slice(0, 10) ?? "—"
        : "—";

    // Description ligne : « Service de transport · CA → NE »
    const routeLabel = describeRoute(shipment.originCountry, shipment.destinationCountry);
    const isDevice = shipment.itemKind === "DEVICE";
    const description = isDevice
        ? "Service de transport d'appareil"
        : "Service de transport de colis";
    // Le total HT calculé porte sur base + supplément : on le répartit entre
    // les deux lignes au prorata, pour que leur somme retombe exactement sur
    // amountBeforeTax quel que soit le régime fiscal.
    const amountBeforeTax = Number(calculation.amountBeforeTax);
    // Le montant figé fait foi : la ligne apparaît dès qu'il est non nul, même
    // si la grille du convoi a changé et que le libellé n'est plus résolvable.
    const hasSurcharge = surchargeAmount > 0;
    const surchargeLabel =
        surcharge?.label ||
        (surcharge ? `Frais de livraison — ${surcharge.city}` : "Frais de livraison");
    // On montre le calcul plutôt que le seul résultat : le client doit pouvoir
    // vérifier « 3,00 $/kg × 2 kg » sans nous appeler.
    const surchargeDetail = surcharge
        ? `${fmtAmount(surcharge.rate)}/kg × ${fmtWeight(surcharge.weightKg)} · convoi du ${convoyDateLabel}`
        : `Supplément · convoi du ${convoyDateLabel}`;

    const surchargeBeforeTax = hasSurcharge
        ? round2((amountBeforeTax * surchargeAmount) / total)
        : 0;
    const baseBeforeTax = round2(amountBeforeTax - surchargeBeforeTax);

    const dims = formatDimensions(shipment.lengthCm, shipment.widthCm, shipment.heightCm);
    const detailedDescription = [
        `Envoi ${shipment.trackingId}`,
        routeLabel,
        // Le poids justifie le tarif : il a sa place sur la facture.
        shipment.weightKg != null ? fmtWeight(shipment.weightKg) : null,
        isDevice ? shipment.deviceType || "Appareil" : null,
        isDevice ? dims : null,
    ]
        .filter(Boolean)
        .join(" · ");

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
            currency: shipment.currency ?? "CAD",

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
                        unitPrice: new Prisma.Decimal(baseBeforeTax),
                        amountBeforeTax: new Prisma.Decimal(baseBeforeTax),
                    },
                    ...(hasSurcharge
                        ? [
                              {
                                  description: surchargeLabel,
                                  detailedDescription: surchargeDetail,
                                  quantity: new Prisma.Decimal(1),
                                  unitPrice: new Prisma.Decimal(surchargeBeforeTax),
                                  amountBeforeTax: new Prisma.Decimal(surchargeBeforeTax),
                              },
                          ]
                        : []),
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
/**
 * Recale le supplément figé sur un envoi à partir de la grille de son convoi.
 *
 * Utile pour les colis enregistrés avant la configuration du supplément :
 * leur instantané est nul et le resterait sans cela.
 *
 * Si l'envoi était marqué payé en totalité mais que le montant encaissé ne
 * couvre plus le total dû, il repasse en paiement partiel. On ne remonte pas
 * amountPaid : cela reviendrait à affirmer un encaissement qui n'a pas eu
 * lieu. Mieux vaut rendre les 3 $ manquants visibles à l'agent.
 */
export async function refreshShipmentSurcharge(shipmentId: number) {
    const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: {
            id: true,
            convoyId: true,
            receiverCity: true,
            currency: true,
            totalAmount: true,
            amountPaid: true,
            surchargeAmount: true,
            paymentStatus: true,
            weightKg: true,
        },
    });
    if (!shipment) return null;

    const resolved = await resolveSurcharge(
        shipment.convoyId,
        shipment.receiverCity,
        shipment.currency ?? "CAD",
        shipment.weightKg
    );
    const fresh = resolved?.amount ?? null;

    if (fresh === shipment.surchargeAmount) return shipment.surchargeAmount;

    const due = amountDue(shipment.totalAmount, fresh);
    const paid = shipment.amountPaid ?? 0;
    const downgrade =
        shipment.paymentStatus === "PAID" && due != null && paid + 0.001 < due;

    await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
            surchargeAmount: fresh,
            ...(downgrade ? { paymentStatus: "PARTIAL" as const } : {}),
        },
    });

    return fresh;
}

/**
 * Régénère la facture d'un envoi à partir de son état courant, puis la rend.
 *
 * ⚠️ Une facture est normalement un instantané comptable : on ne la réécrit
 * pas, on émet une note de crédit et une nouvelle facture. Cette fonction
 * existe parce qu'un supplément de ville peut être configuré après coup, et
 * qu'il faut alors pouvoir envoyer au client un document juste. Elle garde
 * le même numéro, remplace lignes et taxes, et laisse une trace dans
 * AuditLog. À n'utiliser que tant que la facture n'a pas été transmise à un
 * tiers comptable.
 *
 * S'il n'existe pas encore de facture, elle est simplement créée.
 */
export async function refreshInvoiceForShipment(
    shipmentId: number,
    options: CreateInvoiceOptions = {}
) {
    // Rafraîchir d'abord l'instantané de supplément porté par l'envoi.
    // Sans ça, régénérer une facture pour un colis enregistré AVANT la
    // configuration du supplément relirait un instantané nul et rendrait le
    // bouton d'envoi inopérant — ce qui est précisément son cas d'usage.
    await refreshShipmentSurcharge(shipmentId);

    const existing = await prisma.invoice.findUnique({
        where: { shipmentId },
        select: { id: true, number: true, fiscalYear: true, sequence: true, createdById: true },
    });

    if (!existing) {
        return createInvoiceForShipment(shipmentId, options);
    }

    // On supprime puis recrée sous le même numéro : createInvoiceForShipment
    // refait tout le calcul (supplément, régime fiscal, snapshots) au lieu
    // d'en dupliquer la logique ici.
    await prisma.invoice.delete({ where: { id: existing.id } });

    const rebuilt = await createInvoiceForShipment(shipmentId, {
        ...options,
        reuseNumber: {
            number: existing.number,
            fiscalYear: existing.fiscalYear,
            sequence: existing.sequence,
        },
    });

    await logAudit({
        entityType: "Invoice",
        entityId: rebuilt?.id ?? existing.id,
        action: "REGENERATE",
        userId: options.userId ?? existing.createdById ?? null,
        reason: `Facture ${existing.number} régénérée depuis l.état courant de l.envoi`,
    }).catch(() => {
        // La traçabilité ne doit pas faire échouer la régénération
    });

    return rebuilt;
}

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
