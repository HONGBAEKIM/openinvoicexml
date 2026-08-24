import { describe, it, expect } from "vitest";

import { checkAllowanceChargeRequirements } from "../rules/18.allowance-charge.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import domesticSimple from "../../fixtures/01.domestic-simple.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/**
 * What's tested here (BG-20/BG-21 document-level and BG-27/BG-28 line-level allowance/charge
 * requirements beyond the amount formulas already covered in 02.business-rules.test.ts):
 *
 * | Test case                                                          | Expected result                                    |
 * |-----------------------------------------------------------------------|---------------------------------------------------|
 * | Document allowance missing reason and reasonCode                   | ALLOWANCE_CHARGE_REASON_REQUIRED                   |
 * | Document allowance with only reason                                 | no ALLOWANCE_CHARGE_REASON_REQUIRED                |
 * | Document allowance with only reasonCode                             | no ALLOWANCE_CHARGE_REASON_REQUIRED                |
 * | Line allowance missing reason and reasonCode                        | ALLOWANCE_CHARGE_REASON_REQUIRED                   |
 * | Document allowance missing vatCategoryCode                          | DOCUMENT_ALLOWANCE_CHARGE_VAT_CATEGORY_REQUIRED    |
 * | Document allowance, category 'O', vatRate present                   | DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_NOT_ALLOWED     |
 * | Document allowance, category 'O', vatRate absent                    | no VAT-rate issue                                  |
 * | Document allowance, category 'S', vatRate missing                   | DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_REQUIRED        |
 * | Document allowance, category 'S', vatRate 0                         | DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY |
 * | Document allowance, category 'S', vatRate 19                        | no VAT-rate issue                                  |
 * | Document allowance, category 'Z', vatRate 5 (nonzero)                | DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY |
 * | Document allowance, category 'Z', vatRate 0                         | no VAT-rate issue                                  |
 */
describe("checkAllowanceChargeRequirements", () => {
  it("flags a document allowance with neither reason nor reasonCode", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [{ amount: 50, isCharge: false, vatCategoryCode: "S", vatRate: 19 }];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "ALLOWANCE_CHARGE_REASON_REQUIRED")).toBe(true);
  });

  it("accepts a document allowance with only reason", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "S", vatRate: 19 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "ALLOWANCE_CHARGE_REASON_REQUIRED")).toBe(false);
  });

  it("accepts a document allowance with only reasonCode", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reasonCode: "95", vatCategoryCode: "S", vatRate: 19 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "ALLOWANCE_CHARGE_REASON_REQUIRED")).toBe(false);
  });

  it("flags a line allowance with neither reason nor reasonCode", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.lines[0]!.allowancesCharges = [{ amount: 50, isCharge: false }];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "ALLOWANCE_CHARGE_REASON_REQUIRED")).toBe(true);
  });

  it("flags a document allowance missing its VAT category", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [{ amount: 50, isCharge: false, reason: "Rabatt" }];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_CATEGORY_REQUIRED")).toBe(
      true,
    );
  });

  // if there is vatCategoryCode with "O" then we do not need vatRate
  // we can check next test
  it("flags category 'O' with a VAT rate present (BR-O-06)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "O", vatRate: 0 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_NOT_ALLOWED")).toBe(
      true,
    );
  });

  it("accepts category 'O' with no VAT rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "O" },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(
      issues.some((i) => i.code.startsWith("DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE")),
    ).toBe(false);
  });

  it("flags category 'S' with a missing VAT rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "S" },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_REQUIRED")).toBe(
      true,
    );
  });

  it("flags category 'S' with a 0% VAT rate (BR-S-06)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "S", vatRate: 0 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(
      issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY"),
    ).toBe(true);
  });

  it("accepts category 'S' with a 19% VAT rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "S", vatRate: 19 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(
      issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY"),
    ).toBe(false);
  });

  it("flags category 'Z' with a nonzero VAT rate (BR-Z-06)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "Z", vatRate: 5 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(
      issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY"),
    ).toBe(true);
  });

  // Well then the catagory is 'Z' we need .... vatRate 0;;
  it("accepts category 'Z' with a 0% VAT rate", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.allowancesCharges = [
      { amount: 50, isCharge: false, reason: "Rabatt", vatCategoryCode: "Z", vatRate: 0 },
    ];

    const issues: ValidationIssue[] = [];
    checkAllowanceChargeRequirements(invoice, issues);

    expect(
      issues.some((i) => i.code === "DOCUMENT_ALLOWANCE_CHARGE_VAT_RATE_INVALID_FOR_CATEGORY"),
    ).toBe(false);
  });
});
