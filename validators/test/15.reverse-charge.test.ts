import { describe, it, expect } from "vitest";

import { checkReverseChargeSubcaseRequirements } from "../rules/15.reverse-charge.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import domesticSimple from "../../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import reverseCharge from "../../fixtures/06.reverse-charge.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../../fixtures/10.reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../../fixtures/11.reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import reverseChargeSecurityTransfer from "../../fixtures/12.reverse-charge-security-transfer.invoice.json" with { type: "json" };
import reverseChargeCleaning from "../../fixtures/13.reverse-charge-cleaning.invoice.json" with { type: "json" };
import reverseChargeMobileDevices from "../../fixtures/14.reverse-charge-mobile-devices.invoice.json" with { type: "json" };
import reverseChargeGasAndElectricity from "../../fixtures/15.reverse-charge-gas-and-electricity.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/**
 * What's tested here (§13b UStG reverse-charge subcases, VAT category 'AE'):
 *
 * | Subcase / test case                                          | Expected issue                                  |
 * |------------------------------------------------------------------|------------------------------------------------------|
 * | construction, reason doesn't mention construction                | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | scrap-metal, reason doesn't mention scrap metal                  | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | security-transfer, reason doesn't mention security transfer      | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | cleaning, reason doesn't mention cleaning                        | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | mobile-devices, reason doesn't mention mobile devices            | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | gas-and-electricity, reason doesn't mention gas/electricity      | REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID       |
 * | Generic AE fixture, no reverseChargeReason set                   | no issue — subcase checks don't apply                 |
 * | reverseChargeReason set on a non-AE category breakdown           | REVERSE_CHARGE_REASON_REQUIRES_AE_CATEGORY            |
 */
describe("checkReverseChargeSubcaseRequirements", () => {
  it("flags a reverse-charge-construction invoice whose reason doesn't reference construction", () => {
    const invoice = clone(reverseChargeConstruction) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("flags a reverse-charge-scrap-metal invoice whose reason doesn't reference scrap metal", () => {
    const invoice = clone(reverseChargeScrapMetal) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("flags a reverse-charge-security-transfer invoice whose reason doesn't reference security transfer", () => {
    const invoice = clone(reverseChargeSecurityTransfer) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("flags a reverse-charge-cleaning invoice whose reason doesn't reference cleaning", () => {
    const invoice = clone(reverseChargeCleaning) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("flags a reverse-charge-mobile-devices invoice whose reason doesn't reference mobile devices", () => {
    const invoice = clone(reverseChargeMobileDevices) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("flags a reverse-charge-gas-and-electricity invoice whose reason doesn't reference gas/electricity", () => {
    const invoice = clone(reverseChargeGasAndElectricity) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason =
      "Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(true);
  });

  it("doesn't apply subcase checks to the original reverse-charge (AE) fixture (no reverseChargeReason)", () => {
    const invoice = clone(reverseCharge) as Invoice;

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "REVERSE_CHARGE_SUBCASE_EXEMPTION_REASON_INVALID"),
    ).toBe(false);
  });

  it("flags reverseChargeReason set on a breakdown whose category isn't 'AE'", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.vatBreakdowns[0]!.reverseChargeReason = "construction";

    const issues: ValidationIssue[] = [];
    checkReverseChargeSubcaseRequirements(invoice.vatBreakdowns, issues);

    expect(issues.some((i) => i.code === "REVERSE_CHARGE_REASON_REQUIRES_AE_CATEGORY")).toBe(true);
  });
});
