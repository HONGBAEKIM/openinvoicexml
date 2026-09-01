import type { Invoice } from "../core/index.js";
import { validateBusinessRules, type ValidationIssue } from "../validators/02.business-rules.js";
import { toXRechnung } from "./xrechnung.js";
import { toHybridPdf, type HybridPdfOptions } from "./hybrid-pdf.js";

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
 * generateInvoice() does Validate and convert to XML
 */
export function generateInvoice(invoice: Invoice): GenerateInvoiceResult {
  const issues = validateBusinessRules(invoice);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { xml: hasErrors ? null : toXRechnung(invoice), issues };
}

export interface GenerateHybridPdfResult {
  /** The generated hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}

/**
 * Same gate as generateInvoice(), but for the hybrid PDF adapter — separate function rather
 * than a shared one because toHybridPdf() is async (pdf-lib's doc.save() returns a Promise)
 * while toXRechnung() and generateInvoice() are synchronous; not worth changing that existing
 * sync contract just to unify the two.
 */
export async function generateHybridPdf(
  invoice: Invoice,
  options: HybridPdfOptions = {},
): Promise<GenerateHybridPdfResult> {
  const issues = validateBusinessRules(invoice);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  return { pdf: hasErrors ? null : await toHybridPdf(invoice, options), issues };
}
