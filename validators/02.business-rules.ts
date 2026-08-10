import type { Invoice } from "../core/types/invoice.js";
import type { ValidationIssue } from "./types.js";
import { isClose, round2 } from "../core/utils/monetary.js";
import { resolvePlaceOfSupply } from "../core/utils/place-of-supply.js";
import {
  EXEMPTION_REASON_REQUIRED_CATEGORIES,
  checkDecimalPrecision,
  checkVatRateForCategory,
} from "./rules/17.vat-rate.js";
import { checkSmallBusinessRequirements } from "./rules/16.small-business.js";
import { checkOutsideScopeRequirements } from "./rules/14.outside-scope.js";
import { checkIntraEuSupplyRequirements } from "./rules/13.intra-eu.js";
import { checkDeliveryAddressRequirements } from "./rules/11.delivery.js";
import { checkExportRequirements } from "./rules/12.export.js";
import { checkReverseChargeSubcaseRequirements } from "./rules/15.reverse-charge.js";
import { checkCreditNoteAndCorrectionRequirements } from "./rules/10.credit-note.js";

export type { ValidationIssue } from "./types.js";

/**
 * Checks an invoice against EN 16931 / XRechnung business rules that go beyond
 * structural JSON Schema validation: VAT category/rate consistency, §13b reverse-charge
 * requirements, exemption reason requirements, and EN 16931 rounding/amount consistency.
 *
 * Returns an empty array when the invoice is fully compliant.
 *
 * @see ../docs/COMPLIANCE.md for the source, pinned version, and implementation status of
 * every rule enforced here and in `validators/rules/*`.
 */
export function validateBusinessRules(invoice: Invoice): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // --- Line-level checks -------------------------------------------------
  invoice.lines.forEach((line, index) => {
    const path = `lines[${index}]`;

    checkVatRateForCategory(line.vatCategoryCode, line.vatRate, `${path}.vatRate`, issues);
    checkDecimalPrecision(line.unitPrice, `${path}.unitPrice`, issues);
    checkDecimalPrecision(line.lineAmount, `${path}.lineAmount`, issues);

    const expectedLineAmount = round2(line.quantity * line.unitPrice);
    if (!isClose(line.lineAmount, expectedLineAmount)) {
      issues.push({
        code: "LINE_AMOUNT_ROUNDING",
        severity: "error",
        message: `${path}.lineAmount: BT-131 line net amount ${line.lineAmount} does not match quantity × unit price (${expectedLineAmount}).`,
        path: `${path}.lineAmount`,
      });
    }
  });

  // --- VAT category requiring buyer VAT ID (§13b UStG reverse charge) ----
  const hasReverseCharge =
    invoice.lines.some((line) => line.vatCategoryCode === "AE") ||
    invoice.vatBreakdowns.some((vb) => vb.categoryCode === "AE");
  if (hasReverseCharge && !invoice.buyer.vatId) {
    issues.push({
      code: "REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED",
      severity: "error",
      message:
        "buyer.vatId: BT-48 buyer VAT identifier is required when VAT category 'AE' (§13b UStG reverse charge) is used.",
      path: "buyer.vatId",
    });
  }

  // --- §13b UStG reverse-charge subcases (VAT category 'AE') --------------
  checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

  // --- §19 UStG small business (VAT category 'E') -------
  checkSmallBusinessRequirements(invoice.seller, invoice.vatBreakdowns, issues);

  // --- Outside the scope of VAT (VAT category 'O') ------------------------
  checkOutsideScopeRequirements(invoice.seller, invoice.buyer, invoice.vatBreakdowns, issues);

  // --- Delivery address (BG-15) --------------------------------------------
  checkDeliveryAddressRequirements(invoice.delivery, issues);

  // --- Intra-EU supply (VAT category 'K') ---------------------------------
  checkIntraEuSupplyRequirements(
    invoice.seller,
    invoice.buyer,
    invoice.vatBreakdowns,
    invoice.delivery,
    issues,
  );

  // --- Export outside EU (VAT category 'G') --------------------------------
  checkExportRequirements(invoice.buyer, invoice.vatBreakdowns, issues);

  // --- Credit notes (381) and corrective invoices (384) --------------------
  checkCreditNoteAndCorrectionRequirements(
    invoice.typeCode,
    invoice.duePayableAmount,
    invoice.precedingInvoiceReference,
    issues,
  );

  // --- Final invoice deducting a down payment (BT-113) must say which invoice paid it --
  // Mirrors the credit-note/corrective-invoice reference-required checks above: a
  // deduction with no pointer to what it deducts is as incomplete as a credit note with
  // no pointer to what it credits.
  if (invoice.prepaidAmount !== undefined && !invoice.precedingInvoiceReference) {
    issues.push({
      code: "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      severity: "error",
      message:
        "precedingInvoiceReference: BT-25/BT-26 reference to the down payment invoice is required when prepaidAmount (BT-113) is set.",
      path: "precedingInvoiceReference",
    });
  }

  // --- VAT breakdown checks -----------------------------------------------
  let totalTaxableAmount = 0;
  let totalTaxAmount = 0;

  invoice.vatBreakdowns.forEach((vb, index) => {
    const path = `vatBreakdowns[${index}]`;

    checkVatRateForCategory(vb.categoryCode, vb.rate, `${path}.rate`, issues);

    checkDecimalPrecision(vb.taxableAmount, `${path}.taxableAmount`, issues);
    checkDecimalPrecision(vb.taxAmount, `${path}.taxAmount`, issues);

    if (
      EXEMPTION_REASON_REQUIRED_CATEGORIES.includes(vb.categoryCode) &&
      !vb.exemptionReason &&
      !vb.exemptionReasonCode
    ) {
      issues.push({
        code: "VAT_EXEMPTION_REASON_REQUIRED",
        severity: "error",
        message: `${path}: BT-120/BT-121 exemption reason (text or code) is required for VAT category '${vb.categoryCode}'.`,
        path,
      });
    }

    // BR-Z-10 (and the same for 'S'): a standard-rated or zero-rated breakdown must
    // not carry an exemption reason at all — exemption reasons only apply to
    // categories where the supply is actually exempt/out-of-scope/reverse-charged.
    if ((vb.categoryCode === "S" || vb.categoryCode === "Z") && (vb.exemptionReason || vb.exemptionReasonCode)) {
      issues.push({
        code: "VAT_EXEMPTION_REASON_NOT_ALLOWED",
        severity: "error",
        message: `${path}: BT-120/BT-121 exemption reason (text or code) must not be present for VAT category '${vb.categoryCode}'.`,
        path,
      });
    }

    const linesForCategory = invoice.lines.filter(
      (line) => line.vatCategoryCode === vb.categoryCode && line.vatRate === vb.rate,
    );

    if (linesForCategory.length === 0) {
      issues.push({
        code: "VAT_BREAKDOWN_RATE_MISMATCH",
        severity: "error",
        message: `${path}: VAT breakdown for category '${vb.categoryCode}' at ${vb.rate}% has no matching invoice lines.`,
        path,
      });
    }

    const expectedTaxableAmount = round2(
      linesForCategory.reduce((sum, line) => sum + line.lineAmount, 0),
    );
    if (!isClose(vb.taxableAmount, expectedTaxableAmount)) {
      issues.push({
        code: "VAT_TAXABLE_AMOUNT_MISMATCH",
        severity: "error",
        message: `${path}.taxableAmount: BT-116 taxable amount ${vb.taxableAmount} does not match the sum of line amounts (${expectedTaxableAmount}) for category '${vb.categoryCode}' at ${vb.rate}%.`,
        path: `${path}.taxableAmount`,
      });
    }

    const expectedTaxAmount = round2(vb.taxableAmount * (vb.rate / 100));
    if (!isClose(vb.taxAmount, expectedTaxAmount)) {
      issues.push({
        code: "VAT_TAX_AMOUNT_ROUNDING",
        severity: "error",
        message: `${path}.taxAmount: BT-117 VAT amount ${vb.taxAmount} does not match taxable amount × rate (${expectedTaxAmount}).`,
        path: `${path}.taxAmount`,
      });
    }

    totalTaxableAmount += vb.taxableAmount;
    totalTaxAmount += vb.taxAmount;
  });

  totalTaxableAmount = round2(totalTaxableAmount);
  totalTaxAmount = round2(totalTaxAmount);

  // --- Document-level totals ----------------------------------------------
  checkDecimalPrecision(invoice.taxExclusiveAmount, "taxExclusiveAmount", issues);
  checkDecimalPrecision(invoice.taxAmount, "taxAmount", issues);
  checkDecimalPrecision(invoice.taxInclusiveAmount, "taxInclusiveAmount", issues);
  checkDecimalPrecision(invoice.duePayableAmount, "duePayableAmount", issues);

  // BT-109 taxExclusiveAmount = sum of all breakdown taxableAmounts.
  if (!isClose(invoice.taxExclusiveAmount, totalTaxableAmount)) {
    issues.push({
      code: "INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxExclusiveAmount: BT-109 amount ${invoice.taxExclusiveAmount} does not match the sum of VAT breakdown taxable amounts (${totalTaxableAmount}).`,
      path: "taxExclusiveAmount",
    });
  }

  // BT-110 taxAmount = sum of all breakdown taxAmounts.
  if (!isClose(invoice.taxAmount, totalTaxAmount)) {
    issues.push({
      code: "INVOICE_TAX_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxAmount: BT-110 total VAT amount ${invoice.taxAmount} does not match the sum of VAT breakdown amounts (${totalTaxAmount}).`,
      path: "taxAmount",
    });
  }

  // BT-112 taxInclusiveAmount = taxExclusiveAmount + taxAmount.
  const expectedTaxInclusiveAmount = round2(invoice.taxExclusiveAmount + invoice.taxAmount);
  if (!isClose(invoice.taxInclusiveAmount, expectedTaxInclusiveAmount)) {
    issues.push({
      code: "INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH",
      severity: "error",
      message: `taxInclusiveAmount: BT-112 amount ${invoice.taxInclusiveAmount} does not match taxExclusiveAmount + taxAmount (${expectedTaxInclusiveAmount}).`,
      path: "taxInclusiveAmount",
    });
  }

  // BT-115 = BT-112 − BT-113 + BT-114 (BT-114 rounding amount is out of scope — nothing
  // today produces a rounding-amount value to plug in there).
  const expectedDuePayableAmount = round2(invoice.taxInclusiveAmount - (invoice.prepaidAmount ?? 0));
  if (!isClose(invoice.duePayableAmount, expectedDuePayableAmount)) {
    issues.push({
      code: "INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH",
      severity: "error",
      message: `duePayableAmount: BT-115 amount ${invoice.duePayableAmount} does not match taxInclusiveAmount minus prepaidAmount (${expectedDuePayableAmount}).`,
      path: "duePayableAmount",
    });
  }

  // --- Place of supply (informational only — never blocks XML generation) ------------------
  // The schema doesn't distinguish goods from services, so this can't be resolved
  // automatically; flag cross-border invoices so the place of supply can be verified by hand.
  if (invoice.seller.address.countryCode !== invoice.buyer.address.countryCode) {
    const placeOfSupplyIfB2BService = resolvePlaceOfSupply(invoice.seller, invoice.buyer, true);
    issues.push({
      code: "PLACE_OF_SUPPLY_CROSS_BORDER",
      severity: "warning",
      message: `Seller (${invoice.seller.address.countryCode}) and buyer (${invoice.buyer.address.countryCode}) are in different countries. Place of supply defaults to the seller's country for goods, but to the buyer's country (${placeOfSupplyIfB2BService}) for B2B services — verify manually which applies.`,
      path: "buyer.address.countryCode",
    });
  }

  return issues;
}
