import type { Invoice, Party, VatBreakdown, InvoiceLine } from "../core/index.js";

/**
 * Field mapping — resolves the internal Invoice model (and its nested types) into plain,
 * already-defaulted/derived data structures. No XML concerns (escaping, tag names, element
 * order) live here; see xrechnung.ts for the serialization step that consumes these structures.
 */

// Interface = description of the result
// Function = creates the result

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

// Output type
export interface PrecedingInvoiceReferenceFields {
  id: string;
  issueDate: string;
}

export function mapPrecedingInvoiceReference(
  // Input type
  ref: NonNullable<Invoice["precedingInvoiceReference"]>,
  // Output tyee
): PrecedingInvoiceReferenceFields {
  // Actual returned output
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
  lineExtensionAmount: number;
  taxExclusiveAmount: number;
  taxInclusiveAmount: number;
  duePayableAmount: number;
  prepaidAmount?: number | undefined;
  lines: LineFields[];
}

/** BT-106: sum of all line net amounts — derived, not a stored field on Invoice. */
// sum all the lineAmount
// using reduce() many items -> one value
function sumLineAmounts(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.lineAmount, 0);
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
    lineExtensionAmount: sumLineAmounts(invoice.lines),
    taxExclusiveAmount: invoice.taxExclusiveAmount,
    taxInclusiveAmount: invoice.taxInclusiveAmount,
    duePayableAmount: invoice.duePayableAmount,
    prepaidAmount: invoice.prepaidAmount,
    lines: invoice.lines.map(mapLine),
  };
}
