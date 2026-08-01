import type { Party } from "../../core/types/party.js";
import type { VatBreakdown } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";
import { isEuCountry } from "../../core/utils/eu-countries.js";

/** §4 Nr. 1 Buchst. a UStG (export delivery) reference expected in category 'G' exemption reasons. 
 * 
 * EXPORT_REFERENCE_PATTERN.test("§ 4 Nr. 1 Buchst. a UStG");
 * // true
 * 
 * EXPORT_REFERENCE_PATTERN.test("Steuerfreie Ausfuhrlieferung");
 * // true
 * 
 * EXPORT_REFERENCE_PATTERN.test("Ausfuhr");
 * // true
 * 
 * EXPORT_REFERENCE_PATTERN.test("Steuerfrei.");
 * // false
 * 
 * EXPORT_REFERENCE_PATTERN.test("§ 6a UStG");
 * // false
 * 
*/
const EXPORT_REFERENCE_PATTERN = /(§\s?4\s?(nr\.?|absatz|abs\.?)?\s?1\s?(buchst\.?\s?a)?\s?UStG)|ausfuhr/i;

/**
 * Checks export-outside-EU (VAT category 'G') requirements: the buyer must be outside
 * the EU (unlike 'K', a buyer VAT ID is not required — non-EU buyers don't hold one),
 * and the exemption reason must reference the export delivery exemption specifically.
 *
 * @see ../../docs/COMPLIANCE.md for the VATEX-EU-G / §4 Nr. 1 Buchst. a UStG source.
 */
export function checkExportRequirements(
  buyer: Party,
  vatBreakdowns: VatBreakdown[],
  issues: ValidationIssue[],
): void {
  const exportBreakdowns = vatBreakdowns
    .map((vb, index) => ({ vb, index }))
    .filter(({ vb }) => vb.categoryCode === "G");

  if (exportBreakdowns.length === 0) return;

  if (isEuCountry(buyer.address.countryCode)) {
    issues.push({
      code: "EXPORT_BUYER_COUNTRY_MUST_BE_NON_EU",
      severity: "error",
      message: `buyer.address.countryCode: VAT category 'G' (export outside EU) requires the buyer to be outside the EU, found '${buyer.address.countryCode}' which is an EU member state.`,
      path: "buyer.address.countryCode",
    });
  }

  exportBreakdowns.forEach(({ vb, index }) => {
    const hasSomeReason = Boolean(vb.exemptionReason) || Boolean(vb.exemptionReasonCode);
    const referencesExport =
      EXPORT_REFERENCE_PATTERN.test(vb.exemptionReason ?? "") || vb.exemptionReasonCode === "VATEX-EU-G";

    if (hasSomeReason && !referencesExport) {
      issues.push({
        code: "EXPORT_EXEMPTION_REASON_INVALID",
        severity: "error",
        message: `vatBreakdowns[${index}]: BT-120/BT-121 exemption reason for VAT category 'G' must reference the export delivery exemption (e.g. exemption reason code 'VATEX-EU-G').`,
        path: `vatBreakdowns[${index}]`,
      });
    }
  });
}
