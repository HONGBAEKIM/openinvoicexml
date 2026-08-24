import type { Invoice } from "../../core/types/invoice.js";
import type { AllowanceCharge } from "../../core/types/allowance-charge.js";
import type { ValidationIssue } from "../types.js";
import { STANDARD_VAT_RATES } from "./17.vat-rate.js";

/**
 * Checks BG-20/BG-21 (document-level) and BG-27/BG-28 (line-level) allowance/charge
 * requirements that go beyond what `LINE_AMOUNT_ROUNDING`/`VAT_TAXABLE_AMOUNT_MISMATCH`
 * (in `../02.business-rules.ts`) already verify about the resulting amounts: that a reason
 * is given, and — document-level only — that the VAT category/rate is present and consistent.
 *
 * @see ../../docs/DATA-MODEL.md's "Allowances and charges" section for the BT mapping.
 */

function checkReasonRequired(ac: AllowanceCharge, path: string): ValidationIssue | undefined {
  if (ac.reason || ac.reasonCode) return undefined;
  return {
    code: "ALLOWANCE_CHARGE_REASON_REQUIRED",
    severity: "error",
    message: `${path}: a reason (text) or reason code is required for every allowance/charge, whether given at document or line level.`,
    path,
  };
}

/**
 * BR-32/BR-37: a document-level allowance/charge must declare its VAT category. BR-S-06/07,
 * BR-Z-06/07, BR-E-06/07, BR-AE-06/07, BR-G-06/07, BR-O-06/07: the VAT rate must then follow
 * that category — present and matching for every category except 'O', where it must be
 * absent entirely (mirrors `checkVatRateForCategory` in 17.vat-rate.ts, but that function
 * assumes a always-present rate and treats 'O' as rate-must-be-0, which doesn't hold here —
 * a document-level allowance/charge's `vatRate` is genuinely optional).
 */
function checkDocumentVatCategory(ac: AllowanceCharge, path: string): ValidationIssue | undefined {
  if (ac.vatCategoryCode === undefined) {
    return {
      code: "DOCUMENT_ALLOWANCE_CHARGE_VAT_CATEGORY_REQUIRED",
      severity: "error",
      message: `${path}: BT-95/BT-102 VAT category is required on a document-level allowance/charge.`,
      path,
    };
  }

  if (ac.vatCategoryCode === "O") {
    if (ac.vatRate !== undefined) {
      return {
        code: "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_NOT_ALLOWED",
        severity: "error",
        message: `${path}: BT-96/BT-103 VAT rate must not be present when the VAT category is 'O' (not subject to VAT).`,
        path,
      };
    }
    return undefined;
  }

  if (ac.vatRate === undefined) {
    return {
      code: "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_REQUIRED",
      severity: "error",
      message: `${path}: BT-96/BT-103 VAT rate is required for VAT category '${ac.vatCategoryCode}'.`,
      path,
    };
  }

  if (ac.vatCategoryCode === "S") {
    if (!STANDARD_VAT_RATES.includes(ac.vatRate)) {
      return {
        code: "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY",
        severity: "error",
        message: `${path}: BT-96/BT-103 category 'S' requires a VAT rate of 19% or 7%, found ${ac.vatRate}%.`,
        path,
      };
    }
  } else if (ac.vatRate !== 0) {
    return {
      code: "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY",
      severity: "error",
      message: `${path}: BT-96/BT-103 category '${ac.vatCategoryCode}' requires a VAT rate of 0%, found ${ac.vatRate}%.`,
      path,
    };
  }

  return undefined;
}

// invoice
// ├── document-level allowancesCharges
// │   └── check reason + VAT category
// │
// └── lines
//     └── line-level allowancesCharges
//         └── check reason only

export function checkAllowanceChargeRequirements(
  invoice: Invoice,
  issues: ValidationIssue[],
): void {
  (invoice.allowancesCharges ?? []).forEach((ac, index) => {
    const path = `allowancesCharges[${index}]`;
    const reasonIssue = checkReasonRequired(ac, path);
    if (reasonIssue) issues.push(reasonIssue);
    const categoryIssue = checkDocumentVatCategory(ac, path);
    if (categoryIssue) issues.push(categoryIssue);
  });

  invoice.lines.forEach((line, lineIndex) => {
    (line.allowancesCharges ?? []).forEach((ac, acIndex) => {
      const path = `lines[${lineIndex}].allowancesCharges[${acIndex}]`;
      const reasonIssue = checkReasonRequired(ac, path);
      if (reasonIssue) issues.push(reasonIssue);
    });
  });
}
