import { describe, it, expect } from "vitest";

import { checkOutsideScopeRequirements } from "../rules/outside-scope.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import domesticSimple from "../../fixtures/domestic-simple.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("checkOutsideScopeRequirements", () => {
  // This transaction is outside the VAT system, so VAT identification must not be used for this invoice.
  it("flags an outside-scope (O) invoice where the seller's VAT ID is present (BR-O-02)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    invoice.vatBreakdowns[0]!.categoryCode = "O";

    const issues: ValidationIssue[] = [];
    checkOutsideScopeRequirements(invoice.seller, invoice.buyer, invoice.vatBreakdowns, issues);

    expect(issues.some((i) => i.code === "OUTSIDE_SCOPE_VAT_ID_FORBIDDEN")).toBe(true);
  });

  it("flags an outside-scope (O) invoice where the buyer's VAT ID is present (BR-O-02)", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.seller.vatId;
    invoice.vatBreakdowns[0]!.categoryCode = "O";

    const issues: ValidationIssue[] = [];
    checkOutsideScopeRequirements(invoice.seller, invoice.buyer, invoice.vatBreakdowns, issues);

    expect(issues.some((i) => i.code === "OUTSIDE_SCOPE_VAT_ID_FORBIDDEN")).toBe(true);
  });

  // now without seller.vatId, buyer.vatId = no error
  it("accepts an outside-scope (O) invoice where neither party has a VAT ID", () => {
    const invoice = clone(domesticSimple) as Invoice;
    delete invoice.seller.vatId;
    delete invoice.buyer.vatId;
    invoice.vatBreakdowns[0]!.categoryCode = "O";

    const issues: ValidationIssue[] = [];
    checkOutsideScopeRequirements(invoice.seller, invoice.buyer, invoice.vatBreakdowns, issues);

    expect(issues.some((i) => i.code === "OUTSIDE_SCOPE_VAT_ID_FORBIDDEN")).toBe(false);
  });
});
