import type { Invoice } from "../core/index.js";
import { validateBusinessRules, type ValidationIssue } from "../validators/02.business-rules.js";
import { toXRechnung } from "./xrechnung.js";

export interface GenerateInvoiceResult {
  /** The generated XRechnung XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Validates an invoice against EN 16931 business rules, then generates XRechnung XML only
 * if no error-severity issues were found. `toXRechnung` remains available separately for
 * callers who validate on their own.
 */
// generateInvoice() does Validate and convert to XML
export function generateInvoice(invoice: Invoice): GenerateInvoiceResult {
  const issues = validateBusinessRules(invoice);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toXRechnung(invoice), issues };
}
