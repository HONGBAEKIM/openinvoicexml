import type { Party } from "../../core/types/party.js";
import type { VatBreakdown } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";

/**
 * Checks VAT category 'O' ("Not subject to VAT") requirements.
 *
 * Category 'O' is appropriate only when the transaction itself falls outside the scope
 * of VAT ("nicht steuerbar"). It is not used merely because the VAT rate is 0% or
 * because no VAT is charged.
 *
 * Possible examples include:
 * - genuine compensation for damages where no goods, service, right, tolerance, or
 *   other benefit is provided in return;
 * - a genuine donation or grant that is not consideration for a supply;
 * - the transfer of an entire business that is not subject to VAT under §1(1a) UStG.
 *
 * These descriptions alone do not automatically qualify a transaction for category
 * 'O'. For example, a payment called "compensation" may still be consideration for a
 * taxable service if the recipient provides something in return.
 *
 * Category 'O' must not be confused with:
 * - 'E': a supply that is within the VAT system but exempt from VAT;
 * - 'Z': a taxable supply with a 0% VAT rate;
 * - 'AE': a supply subject to the reverse-charge procedure;
 * - 'K' or 'G': intra-EU supplies or exports that remain governed by VAT rules.
 *
 * Per BR-O-02, an invoice containing any category 'O' line must not contain the
 * seller's VAT identifier (BT-31), the seller tax representative's VAT identifier
 * (BT-63), or the buyer's VAT identifier (BT-48). This function currently checks the
 * seller and buyer VAT identifiers represented by the Party type.
 *
 * Note: §19 UStG (Kleinunternehmerregelung) does NOT use category 'O'. Since
 * 1 January 2025, §19 small-business supplies are represented as VAT-exempt using
 * category 'E'. See `validators/rules/small-business.ts`.
 *
 * @see ../../docs/COMPLIANCE.md for the BR-O-02 source.
 */
export function checkOutsideScopeRequirements(
  seller: Party,
  buyer: Party,
  vatBreakdowns: VatBreakdown[],
  issues: ValidationIssue[],
): void {
  const hasOutsideScope = vatBreakdowns.some((vb) => vb.categoryCode === "O");
  if (!hasOutsideScope) return;

  if (seller.vatId || buyer.vatId) {
    issues.push({
      code: "OUTSIDE_SCOPE_VAT_ID_FORBIDDEN",
      severity: "error",
      message:
        "BR-O-02: an invoice with any VAT category 'O' line must not contain the seller's (BT-31) or buyer's (BT-48) VAT identifier.",
      path: seller.vatId ? "seller.vatId" : "buyer.vatId",
    });
  }
}
