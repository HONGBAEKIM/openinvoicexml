import { describe, it, expect } from "vitest";

import { checkSmallBusinessRequirements } from "../rules/small-business.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import smallBusiness from "../../fixtures/small-business.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("checkSmallBusinessRequirements", () => {
  // E + §19 reason → taxRegistrationId or vatId required
  it("flags a §19 invoice whose seller has neither taxRegistrationId nor vatId", () => {
    const invoice = clone(smallBusiness) as Invoice;

    delete invoice.seller.taxRegistrationId;
    delete invoice.seller.vatId;

    const issues: ValidationIssue[] = [];
    checkSmallBusinessRequirements(
      invoice.seller,
      invoice.vatBreakdowns,
      issues,
    );

    expect(
      issues.some((i) => i.code === "SMALL_BUSINESS_TAX_ID_REQUIRED"),
    ).toBe(true);
  });

  it("accepts a §19 invoice with a vatId instead of a taxRegistrationId", () => {
    const invoice = clone(smallBusiness) as Invoice;

    delete invoice.seller.taxRegistrationId;
    invoice.seller.vatId = "DE123456789";

    const issues: ValidationIssue[] = [];
    checkSmallBusinessRequirements(
      invoice.seller,
      invoice.vatBreakdowns,
      issues,
    );

    expect(
      issues.some((i) => i.code === "SMALL_BUSINESS_TAX_ID_REQUIRED"),
    ).toBe(false);
  });

  it("accepts a §19 invoice with a taxRegistrationId instead of a vatId", () => {
    const invoice = clone(smallBusiness) as Invoice;

    delete invoice.seller.vatId;
    invoice.seller.taxRegistrationId = "47864502378";

    const issues: ValidationIssue[] = [];
    checkSmallBusinessRequirements(
      invoice.seller,
      invoice.vatBreakdowns,
      issues,
    );

    expect(
      issues.some((i) => i.code === "SMALL_BUSINESS_TAX_ID_REQUIRED"),
    ).toBe(false);
  });

  it("doesn't apply the §19 small-business check to a category E invoice whose reason doesn't mention §19", () => {
    const invoice = clone(smallBusiness) as Invoice;
    delete invoice.seller.taxRegistrationId;
    delete invoice.seller.vatId;
    // Category E medical-treatment exemption that does not match
    // the §19 small-business reference pattern.
    invoice.vatBreakdowns[0]!.exemptionReason = "Steuerfrei gem. §4 Nr. 14 UStG (Heilbehandlung).";

    const issues: ValidationIssue[] = [];
    checkSmallBusinessRequirements(invoice.seller, invoice.vatBreakdowns, issues);

    expect(
      issues.some((i) => i.code === "SMALL_BUSINESS_TAX_ID_REQUIRED"),
    ).toBe(false);
  });
});
