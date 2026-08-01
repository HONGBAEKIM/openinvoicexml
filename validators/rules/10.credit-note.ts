import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

/**
 * Checks document-type-specific requirements for credit notes (`typeCode` `381`) and
 * corrective invoices (`typeCode` `384`).
 *
 * @see ../../docs/COMPLIANCE.md for this rule's status.
 */
export function checkCreditNoteAndCorrectionRequirements(
  typeCode: Invoice["typeCode"],
  duePayableAmount: number,
  precedingInvoiceReference: Invoice["precedingInvoiceReference"],
  issues: ValidationIssue[],
): void {
  if (typeCode === "381" && duePayableAmount > 0) {
    issues.push({
      code: "CREDIT_NOTE_POSITIVE_AMOUNT",
      severity: "error",
      message: `duePayableAmount: BT-115 amount ${duePayableAmount} must be zero or negative for a credit note (typeCode '381').`,
      path: "duePayableAmount",
    });
  }

  // A corrective invoice (384) that doesn't say what it corrects is as meaningless as a
  // credit note that doesn't say what it credits — enforced for both, not just 381.
  if ((typeCode === "381" || typeCode === "384") && !precedingInvoiceReference) {
    issues.push({
      code: "PRECEDING_INVOICE_REFERENCE_REQUIRED",
      severity: "error",
      message: `precedingInvoiceReference: BT-25/BT-26 reference to the preceding invoice is required for typeCode '${typeCode}'.`,
      path: "precedingInvoiceReference",
    });
  }
}
