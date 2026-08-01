import type { VatCategoryCode } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";
import { isClose, round2 } from "../../core/utils/monetary.js";

/**
 * Checks BT-118/BT-119 (VAT rate) and BT-120/BT-121 (exemption reason presence) rules.
 *
 * @see ../../docs/COMPLIANCE.md for the EN 16931 source of these BT-* rules.
 */

/** Categories that must carry a zero VAT rate (no VAT charged on the invoice). */
export const ZERO_RATE_CATEGORIES: VatCategoryCode[] = ["Z", "E", "AE", "K", "G", "O"];

/** Rates permitted for category 'S' (German standard/reduced VAT rates). */
export const STANDARD_VAT_RATES: number[] = [19, 7];

/** Categories for which BT-120/BT-121 (exemption reason) is mandatory per EN 16931. */
export const EXEMPTION_REASON_REQUIRED_CATEGORIES: VatCategoryCode[] = ["E", "AE", "K", "G", "O"];

export function checkDecimalPrecision(
  value: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isClose(value, round2(value), 1e-9)) {
    issues.push({
      code: "MONETARY_AMOUNT_DECIMAL_PRECISION",
      severity: "error",
      message: `${path}: monetary amount ${value} must be expressed with at most 2 decimal places.`,
      path,
    });
  }
}

export function checkVatRateForCategory(
  categoryCode: VatCategoryCode,
  rate: number,
  path: string,
  issues: ValidationIssue[],
): void {
  if (categoryCode === "S") {
    if (!STANDARD_VAT_RATES.includes(rate)) {
      issues.push({
        code: "VAT_RATE_INVALID_FOR_CATEGORY",
        severity: "error",
        message: `${path}: BT-118/BT-119 category 'S' requires a VAT rate of 19% or 7%, found ${rate}%.`,
        path,
      });
    }
  } else if (ZERO_RATE_CATEGORIES.includes(categoryCode)) {
    if (rate !== 0) {
      issues.push({
        code: "VAT_RATE_INVALID_FOR_CATEGORY",
        severity: "error",
        message: `${path}: BT-118/BT-119 category '${categoryCode}' requires a VAT rate of 0%, found ${rate}%.`,
        path,
      });
    }
  }
}
