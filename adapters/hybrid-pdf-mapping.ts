import type { Invoice, Party, VatBreakdown, InvoiceLine, AllowanceCharge } from "../core/index.js";
import type { InvoiceTypeCode } from "../core/types/invoice.js";

/**
 * Field mapping — resolves the internal Invoice model (and its nested types) into plain,
 * already-resolved data structures for the hybrid PDF adapter. No layout/formatting concerns
 * (German date/amount formatting, page positions, fonts) live here; see hybrid-pdf.ts for the
 * layout step that consumes these structures.
 *
 * Deliberately independent of xrechnung-mapping.ts, even though the shapes are structurally
 * similar (same Invoice fields, different output shape) — each output adapter resolves its own
 * fields rather than sharing a "generic mapping" module, so the two stay free to diverge and
 * neither depends on the other (see docs/ARCHITECTURE.md).
 */

export interface PdfPartyFields {
  name: string;
  addressLine1: string;
  addressLine2?: string | undefined;
  city: string;
  postalCode: string;
  countryCode: string;
  vatId?: string | undefined;
  taxRegistrationId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
}

export function mapPartyToPdfFields(party: Party): PdfPartyFields {
  return {
    name: party.name,
    addressLine1: party.address.line1,
    addressLine2: party.address.line2,
    city: party.address.city,
    postalCode: party.address.postalCode,
    countryCode: party.address.countryCode,
    vatId: party.vatId,
    taxRegistrationId: party.taxRegistrationId,
    contactEmail: party.contact?.email,
    contactPhone: party.contact?.telephone,
  };
}

export interface PdfLineFields {
  name: string;
  description?: string | undefined;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  lineAmount: number;
  vatCategoryCode: VatBreakdown["categoryCode"];
  vatRate: number;
}

export function mapLineToPdfFields(line: InvoiceLine): PdfLineFields {
  return {
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

export interface PdfVatSubtotalFields {
  categoryCode: VatBreakdown["categoryCode"];
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export function mapVatSubtotalToPdfFields(bd: VatBreakdown): PdfVatSubtotalFields {
  return {
    categoryCode: bd.categoryCode,
    rate: bd.rate,
    taxableAmount: bd.taxableAmount,
    taxAmount: bd.taxAmount,
  };
}

export interface PdfAllowanceChargeFields {
  amount: number;
  isCharge: boolean;
  reason?: string | undefined;
}

export function mapAllowanceChargeToPdfFields(ac: AllowanceCharge): PdfAllowanceChargeFields {
  return { amount: ac.amount, isCharge: ac.isCharge, reason: ac.reason };
}

export interface PdfPaymentMeansFields {
  iban?: string | undefined;
  bic?: string | undefined;
  accountName?: string | undefined;
}

export function mapPaymentMeansToPdfFields(
  pm: NonNullable<Invoice["paymentMeans"]>,
): PdfPaymentMeansFields {
  return { iban: pm.iban, bic: pm.bic, accountName: pm.accountName };
}

export interface PdfDocumentFields {
  invoiceId: string;
  typeCode: InvoiceTypeCode;
  issueDate: string;
  dueDate?: string | undefined;
  currencyCode: string;
  note?: string | undefined;
  seller: PdfPartyFields;
  buyer: PdfPartyFields;
  lines: PdfLineFields[];
  vatSubtotals: PdfVatSubtotalFields[];
  allowancesCharges: PdfAllowanceChargeFields[];
  taxExclusiveAmount: number;
  taxAmount: number;
  taxInclusiveAmount: number;
  duePayableAmount: number;
  prepaidAmount?: number | undefined;
  paymentMeans?: PdfPaymentMeansFields | undefined;
}

export function mapInvoiceToPdfFields(invoice: Invoice): PdfDocumentFields {
  return {
    invoiceId: invoice.id,
    typeCode: invoice.typeCode,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currencyCode: invoice.currencyCode,
    note: invoice.note,
    seller: mapPartyToPdfFields(invoice.seller),
    buyer: mapPartyToPdfFields(invoice.buyer),
    lines: invoice.lines.map(mapLineToPdfFields),
    vatSubtotals: invoice.vatBreakdowns.map(mapVatSubtotalToPdfFields),
    allowancesCharges: (invoice.allowancesCharges ?? []).map(mapAllowanceChargeToPdfFields),
    taxExclusiveAmount: invoice.taxExclusiveAmount,
    taxAmount: invoice.taxAmount,
    taxInclusiveAmount: invoice.taxInclusiveAmount,
    duePayableAmount: invoice.duePayableAmount,
    prepaidAmount: invoice.prepaidAmount,
    paymentMeans: invoice.paymentMeans
      ? mapPaymentMeansToPdfFields(invoice.paymentMeans)
      : undefined,
  };
}
