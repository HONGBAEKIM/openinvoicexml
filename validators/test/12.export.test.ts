import { describe, it, expect } from "vitest";

import { checkExportRequirements } from "../rules/12.export.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import exportInvoice from "../../fixtures/09.export.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

function check(invoice: Invoice): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkExportRequirements(invoice.buyer, invoice.vatBreakdowns, issues);
  return issues;
}

/**
 * What's tested here (VAT category 'G' — export outside the EU, §4 Nr. 1 Buchst. a UStG):
 *
 * | Seller | Buyer | Category G? | Reason                                               |
 * |--------|-------|--------------|-------------------------------------------------------|
 * | DE     | CH    | Yes          | valid export to a country outside the EU (base fixture)|
 * | DE     | US    | Yes          | valid export to a country outside the EU               |
 * | DE     | GB    | Yes          | valid export to a country outside the EU               |
 * | DE     | FR    | No           | buyer is inside the EU                                 |
 * | DE     | NL    | No           | buyer is inside the EU                                 |
 * | DE     | DE    | No           | domestic sale, not an export                           |
 * | DE     | CH    | No           | exemption reason doesn't reference the export exemption|
 *
 * Category G is used for goods exported from the EU to a non-EU country. The buyer must
 * therefore be outside the EU, and the VAT exemption reason must specifically reference the
 * export exemption (e.g. §4 Nr. 1 Buchst. a UStG or exemption reason code 'VATEX-EU-G').
 */
describe("checkExportRequirements", () => {
  it("accepts a compliant export (G) invoice (DE seller -> CH buyer)", () => {
    const invoice = clone(exportInvoice) as Invoice;

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("accepts a compliant export (G) invoice (DE seller -> US buyer)", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.buyer.address.countryCode = "US";

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("accepts a compliant export (G) invoice (DE seller -> GB buyer)", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.buyer.address.countryCode = "GB";

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("flags an export (G) invoice where the buyer is inside the EU (FR)", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.buyer.address.countryCode = "FR";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "EXPORT_BUYER_COUNTRY_MUST_BE_NON_EU")).toBe(true);
  });

  it("flags an export (G) invoice where the buyer is inside the EU (NL)", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.buyer.address.countryCode = "NL";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "EXPORT_BUYER_COUNTRY_MUST_BE_NON_EU")).toBe(true);
  });

  it("flags an export (G) invoice where seller and buyer share a country (domestic sale)", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.buyer.address.countryCode = "DE";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "EXPORT_BUYER_COUNTRY_MUST_BE_NON_EU")).toBe(true);
  });

  it("flags an export (G) invoice whose exemption reason doesn't reference the export exemption", () => {
    const invoice = clone(exportInvoice) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason = "Steuerfrei.";
    delete invoice.vatBreakdowns[0]!.exemptionReasonCode;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "EXPORT_EXEMPTION_REASON_INVALID")).toBe(true);
  });
});
