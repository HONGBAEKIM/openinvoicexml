import type { ReverseChargeSubcase, VatBreakdown } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";

/**
 * §13b UStG subcase keyword expected in the free-text exemption reason. VATEX has no
 * per-subcase code, so this is a free-text check, not a code check (unlike the
 * category-level 'VATEX-EU-AE' code, which stays the same across all subcases).
 *
 * This only checks that the wording matches the declared subcase — it does not verify
 * subcase-specific legal preconditions (e.g. `mobile-devices` / `industrial-metals`
 * additionally require the recipient to be a reseller of such goods, commonly discussed
 * alongside a €5,000 net invoice-value threshold). A matching keyword is necessary but
 * not sufficient proof that reverse charge actually applies.
 */
const SUBCASE_REFERENCE_PATTERNS: Record<ReverseChargeSubcase, RegExp> = {
  "eu-cross-border-service": /gemeinschaftsgebiet/i,
  "foreign-supplier": /ausl(ä|ae)ndische[nr]?\s?unternehmer/i,
  "security-transfer": /sicherungs(übereignung|übereignete[nr]?)/i,
  "real-estate": /grunderwerbsteuer/i,
  construction: /bauleistung/i,
  "gas-and-electricity": /(erdgasnetz|gasnetz|elektrizit(ä|ae)t)/i,
  "emission-certificates": /emissionszertifikat/i,
  "scrap-and-waste": /(schrott|altmetall|abfallstoff)/i,
  cleaning: /geb(ä|ae)udereinigung/i,
  "qualifying-gold": /gold/i,
  "mobile-devices": /(mobilfunk|tablet|spielekonsole|integrierte[nr]?\s?schaltkreis)/i,
  "industrial-metals": /(silber|platin|kupfer|aluminium|zink|anlage\s?4)/i,
  telecommunications: /telekommunikation/i,
};

/**
 * Checks §13b UStG reverse-charge subcase requirements: `reverseChargeReason` is only
 * valid when the breakdown's `categoryCode` is 'AE'; when it is, the free-text exemption
 * reason must reference that specific subcase, not just generic reverse-charge wording.
 * The subcase-agnostic buyer-VAT-ID requirement for 'AE' lives in 02.business-rules.ts and
 * is unaffected by this — it applies regardless of whether a subcase is declared.
 *
 * @see ../../docs/COMPLIANCE.md for the §13b UStG source and this rule's "Partial" status.
 */
export function checkReverseChargeSubcaseRequirements(
  vatBreakdowns: VatBreakdown[],
  issues: ValidationIssue[],
): void {
  vatBreakdowns.forEach((vb, index) => {
    if (!vb.reverseChargeReason) return;

    if (vb.categoryCode !== "AE") {
      issues.push({
        code: "REVERSE_CHARGE_REASON_REQUIRES_AE_CATEGORY",
        severity: "error",
        message: `vatBreakdowns[${index}]: reverseChargeReason is only applicable when categoryCode is 'AE', found '${vb.categoryCode}'.`,
        path: `vatBreakdowns[${index}].reverseChargeReason`,
      });
      return;
    }

    const pattern = SUBCASE_REFERENCE_PATTERNS[vb.reverseChargeReason];
    if (!pattern.test(vb.exemptionReason ?? "")) {
      issues.push({
        code: "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID",
        severity: "error",
        message: `vatBreakdowns[${index}]: BT-120 exemption reason must reference the '${vb.reverseChargeReason}' §13b UStG subcase specifically, not just generic reverse-charge wording.`,
        path: `vatBreakdowns[${index}].exemptionReason`,
      });
    }
  });
}
