import type { InvoiceLine } from "./invoice-line.js";
import type { Party } from "./party.js";
import type { VatBreakdown } from "./vat-breakdown.js";

/** Document type codes per EN 16931 / XRechnung. */
export type InvoiceTypeCode =
  | "380" // Commercial invoice
  | "381" // Credit note
  | "384"; // Corrective invoice

/**
 * Internal invoice schema — the single source of truth for all output adapters.
 * Every field maps to one or more XRechnung Business Terms (BT/BG).
 * See DATA-MODEL.md for the full BT mapping table.
 */
export interface Invoice {
  /** BT-1: Invoice number — unique identifier assigned by the seller. */
  id: string;
  /** BT-3: Invoice type code. */
  typeCode: InvoiceTypeCode;
  /** BT-2: Invoice issue date in YYYY-MM-DD format. */
  issueDate: string;
  /** BT-9: Payment due date in YYYY-MM-DD format. */
  dueDate?: string;
  /** BT-5: Document currency code (ISO 4217, e.g. "EUR"). */
  currencyCode: string;
  /** BT-23: Business process type identifier (e.g. Peppol profile ID). */
  businessProcessType: string;

  /** BG-4: Seller (invoicing party). */
  seller: Party;
  /** BG-7: Buyer (invoiced party). */
  buyer: Party;

  /** BG-25: Invoice lines. */
  lines: InvoiceLine[];
  /** BG-23: VAT breakdown by tax category. */
  vatBreakdowns: VatBreakdown[];

  /** BT-109: Invoice total amount without VAT. */
  taxExclusiveAmount: number;
  /** BT-110: Total VAT amount. */
  taxAmount: number;
  /** BT-112: Invoice total amount with VAT. */
  taxInclusiveAmount: number;
  /** BT-115: Amount due for payment. */
  duePayableAmount: number;

  /** BG-16: Payment means. */
  paymentMeans?: {
    /** BT-81: Payment means code (UNCL4461). */
    code: string;
    /** BT-84: Payment account identifier (IBAN). */
    iban?: string;
    /** BT-85: Payment account name. */
    accountName?: string;
    /** BT-86: Payment service provider identifier (BIC). */
    bic?: string;
  };

  /** BT-22: Note / free-text remark on the invoice. */
  note?: string;
  /** BT-10: Buyer reference (Leitweg-ID for German public sector). */
  buyerReference?: string;
  /** BT-12: Contract reference. */
  contractReference?: string;
  /** BT-13: Purchase order reference. */
  purchaseOrderReference?: string;

  /** BT-25 / BT-26: Reference to a preceding invoice (for credit notes / corrections). */
  precedingInvoiceReference?: {
    id: string;
    issueDate: string;
  };

  /**
   * BG-13: Delivery information.
   *
   * For category "K", BR-IC-11 requires BT-72 or BG-14.
   * BG-14 is not currently supported, so this implementation requires BT-72.
   */
  delivery?: {
    /** BT-72: Actual delivery or performance date (YYYY-MM-DD). */
    actualDeliveryDate?: string;

    /** BG-15: Deliver-to address. */
    deliverTo?: {
      /** BT-77: Deliver-to city. */
      city?: string;
      /** BT-78: Deliver-to postal code. */
      postalCode?: string;
      /**
       * BT-80: Deliver-to country code (ISO 3166-1 alpha-2).
       * Required for every BG-15 address by BR-57, and for category "K"
       * by BR-IC-12.
       */
      countryCode?: string;
    };
  };
}
