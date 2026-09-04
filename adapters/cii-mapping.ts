import type { Invoice, Party, VatBreakdown, InvoiceLine, AllowanceCharge } from "../core/index.js";

/**
* Field mapping — converts the internal Invoice data into simple values
* that are ready to be used by the CII XML builder.
*
* XML details such as tag names, escaping, and element order are handled
* in cii.ts.
*
* This file is kept separate from xrechnung-mapping.ts on purpose.
* Both files look very similar now because they use the same Invoice model,
* but CII and XRechnung create different XML structures and may need
* different mapping logic in the future.
*/

export interface PartyFields {
  schemeId: string;
  electronicAddress: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  postalCode: string;
  countryCode: string;
  vatId?: string | undefined;
  taxRegistrationId?: string | undefined;
  legalId?: string | undefined;
  contact?: { name?: string | undefined; telephone: string; email: string } | undefined;
}

export function mapParty(party: Party): PartyFields {
  return {
    schemeId: party.electronicAddressSchemeId ?? "EM",
    electronicAddress: party.electronicAddress,
    name: party.name,
    addressLine1: party.address.line1,
    addressLine2: party.address.line2,
    city: party.address.city,
    postalCode: party.address.postalCode,
    countryCode: party.address.countryCode,
    vatId: party.vatId,
    taxRegistrationId: party.taxRegistrationId,
    legalId: party.legalId,
    contact: party.contact,
  };
}

export interface PaymentMeansFields {
  code: string;
  iban?: string | undefined;
  accountName?: string | undefined;
  bic?: string | undefined;
}

export function mapPaymentMeans(pm: NonNullable<Invoice["paymentMeans"]>): PaymentMeansFields {
  return { code: pm.code, iban: pm.iban, accountName: pm.accountName, bic: pm.bic };
}

export interface VatSubtotalFields {
  categoryCode: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReason?: string | undefined;
  exemptionReasonCode?: string | undefined;
}

export function mapVatSubtotal(bd: VatBreakdown): VatSubtotalFields {
  return {
    categoryCode: bd.categoryCode,
    rate: bd.rate,
    taxableAmount: bd.taxableAmount,
    taxAmount: bd.taxAmount,
    exemptionReason: bd.exemptionReason,
    exemptionReasonCode: bd.exemptionReasonCode,
  };
}

export interface AllowanceChargeFields {
  amount: number;
  isCharge: boolean;
  reason?: string | undefined;
  reasonCode?: string | undefined;
  vatCategoryCode?: string | undefined;
  vatRate?: number | undefined;
}

export function mapAllowanceCharge(ac: AllowanceCharge): AllowanceChargeFields {
  return {
    amount: ac.amount,
    isCharge: ac.isCharge,
    reason: ac.reason,
    reasonCode: ac.reasonCode,
    vatCategoryCode: ac.vatCategoryCode,
    vatRate: ac.vatRate,
  };
}

export interface LineFields {
  id: string;
  name: string;
  description?: string | undefined;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineAmount: number;
  vatCategoryCode: string;
  vatRate: number;
  allowancesCharges: AllowanceChargeFields[];
}

export function mapLine(line: InvoiceLine): LineFields {
  return {
    id: line.id,
    name: line.name,
    description: line.description,
    quantity: line.quantity,
    unitCode: line.unitCode,
    unitPrice: line.unitPrice,
    lineAmount: line.lineAmount,
    vatCategoryCode: line.vatCategoryCode,
    vatRate: line.vatRate,
    allowancesCharges: (line.allowancesCharges ?? []).map(mapAllowanceCharge),
  };
}

export interface DeliverToFields {
  city?: string | undefined;
  postalCode?: string | undefined;
  countryCode?: string | undefined;
}

export interface DeliveryFields {
  actualDeliveryDate?: string | undefined;
  deliverTo?: DeliverToFields | undefined;
}

export function mapDelivery(delivery: NonNullable<Invoice["delivery"]>): DeliveryFields {
  return {
    actualDeliveryDate: delivery.actualDeliveryDate,
    deliverTo: delivery.deliverTo
      ? {
          city: delivery.deliverTo.city,
          postalCode: delivery.deliverTo.postalCode,
          countryCode: delivery.deliverTo.countryCode,
        }
      : undefined,
  };
}

export interface PrecedingInvoiceReferenceFields {
  id: string;
  issueDate: string;
}

export function mapPrecedingInvoiceReference(
  ref: NonNullable<Invoice["precedingInvoiceReference"]>,
): PrecedingInvoiceReferenceFields {
  return { id: ref.id, issueDate: ref.issueDate };
}

export interface DocumentFields {
  id: string;
  typeCode: string;
  issueDate: string;
  dueDate?: string | undefined;
  currencyCode: string;
  businessProcessType: string;
  note?: string | undefined;
  buyerReference?: string | undefined;
  contractReference?: string | undefined;
  purchaseOrderReference?: string | undefined;
  precedingInvoiceReference?: PrecedingInvoiceReferenceFields | undefined;
  seller: PartyFields;
  buyer: PartyFields;
  delivery?: DeliveryFields | undefined;
  paymentMeans?: PaymentMeansFields | undefined;
  taxAmount: number;
  vatSubtotals: VatSubtotalFields[];
  allowancesCharges: AllowanceChargeFields[];
  lineExtensionAmount: number;
  /** BT-107: Sum of document-level allowance amounts — 0 when there are none. */
  allowanceTotalAmount: number;
  /** BT-108: Sum of document-level charge amounts — 0 when there are none. */
  chargeTotalAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  duePayableAmount: number;
  prepaidAmount?: number | undefined;
  lines: LineFields[];
}

/** BT-106: sum of all line net amounts — derived, not a stored field on Invoice. */
function sumLineAmounts(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineAmount, 0);
}

/** BT-107/BT-108: sum of document-level allowance or charge amounts — derived, not stored. */
function sumAllowancesCharges(items: AllowanceCharge[] | undefined, isCharge: boolean): number {
  return (items ?? []).filter((ac) => ac.isCharge === isCharge).reduce((sum, ac) => sum + ac.amount, 0);
}

export function mapInvoice(invoice: Invoice): DocumentFields {
  return {
    id: invoice.id,
    typeCode: invoice.typeCode,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currencyCode: invoice.currencyCode,
    businessProcessType: invoice.businessProcessType,
    note: invoice.note,
    buyerReference: invoice.buyerReference,
    contractReference: invoice.contractReference,
    purchaseOrderReference: invoice.purchaseOrderReference,
    precedingInvoiceReference: invoice.precedingInvoiceReference
      ? mapPrecedingInvoiceReference(invoice.precedingInvoiceReference)
      : undefined,
    seller: mapParty(invoice.seller),
    buyer: mapParty(invoice.buyer),
    delivery: invoice.delivery ? mapDelivery(invoice.delivery) : undefined,
    paymentMeans: invoice.paymentMeans ? mapPaymentMeans(invoice.paymentMeans) : undefined,
    taxAmount: invoice.taxAmount,
    vatSubtotals: invoice.vatBreakdowns.map(mapVatSubtotal),
    allowancesCharges: (invoice.allowancesCharges ?? []).map(mapAllowanceCharge),
    lineExtensionAmount: sumLineAmounts(invoice.lines),
    allowanceTotalAmount: sumAllowancesCharges(invoice.allowancesCharges, false),
    chargeTotalAmount: sumAllowancesCharges(invoice.allowancesCharges, true),
    taxExclusiveAmount: invoice.taxExclusiveAmount,
    taxInclusiveAmount: invoice.taxInclusiveAmount,
    duePayableAmount: invoice.duePayableAmount,
    prepaidAmount: invoice.prepaidAmount,
    lines: invoice.lines.map(mapLine),
  };
}
