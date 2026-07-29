import type { Party } from "../../core/types/party.js";
import type { VatBreakdown } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";

/** §19 UStG (Kleinunternehmerregelung) reference expected in a small-business exemption reason. */
const SMALL_BUSINESS_REFERENCE_PATTERN = /§\s?19\s?UStG/i;

/**
 * Checks §19 UStG (Kleinunternehmerregelung) requirements. Since 1 January 2025, §19
 * small-business supplies are tax-EXEMPT (VAT category 'E'), not outside the scope of
 * VAT — category 'O' is reserved for genuinely non-taxable transactions unrelated to
 * §19 (see `validators/rules/outside-scope.ts` for its BR-O-02 check).
 *
 * Because category 'E' is shared with every other VAT exemption ground (e.g. §4 UStG
 * medical/rental exemptions), this only applies the extra §19 check when a breakdown's
 * free-text exemption reason already references §19 UStG specifically — it is not
 * triggered by category 'E' alone, to avoid misclassifying unrelated exemptions as
 * small-business ones. An invoice using category 'E' for a non-§19 reason (or a §19
 * invoice whose reason text doesn't mention §19 at all) is not affected by this check;
 * it still needs to satisfy only the generic "some exemption reason is present"
 * requirement that applies to all of E/AE/K/G/O.
 *
 * @see ../../docs/COMPLIANCE.md for the §19 UStG source and this rule's "Partial" status.
 */

export function checkSmallBusinessRequirements(
  seller: Party,
  vatBreakdowns: VatBreakdown[],
  issues: ValidationIssue[],
): void {
  const smallBusinessBreakdowns = vatBreakdowns
    .map((vb, index) => ({ vb, index }))
    .filter(
      ({ vb }) =>
        vb.categoryCode === "E" && SMALL_BUSINESS_REFERENCE_PATTERN.test(vb.exemptionReason ?? ""),
    );

  if (smallBusinessBreakdowns.length === 0) return;

  if (!seller.taxRegistrationId && !seller.vatId) {
    issues.push({
      code: "SMALL_BUSINESS_TAX_ID_REQUIRED",
      severity: "error",
      message:
        "seller.taxRegistrationId: BT-32 seller tax registration number (or BT-31 VAT ID) is required for a §19 UStG small-business exemption.",
      path: "seller.taxRegistrationId",
    });
  }
}
