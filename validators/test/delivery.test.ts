import { describe, it, expect } from "vitest";

import { checkDeliveryAddressRequirements } from "../rules/delivery.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import intraEuSupply from "../../fixtures/intra-eu-supply.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("checkDeliveryAddressRequirements", () => {
  it("requires countryCode whenever deliverTo is supplied, regardless of VAT category (BR-57)", () => {
    const issues: ValidationIssue[] = [];
    checkDeliveryAddressRequirements({ deliverTo: { city: "Berlin" } }, issues);

    expect(issues.some((i) => i.code === "DELIVERY_COUNTRY_REQUIRED")).toBe(true);
  });

  it("does not require a delivery address when none is supplied", () => {
    const issues: ValidationIssue[] = [];
    checkDeliveryAddressRequirements(undefined, issues);

    expect(issues.some((i) => i.code === "DELIVERY_COUNTRY_REQUIRED")).toBe(false);
  });

  it("does not require city — only BT-80 country code is enforced by BR-57", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.delivery!.deliverTo!.city;

    const issues: ValidationIssue[] = [];
    checkDeliveryAddressRequirements(invoice.delivery, issues);

    expect(issues).not.toContainEqual(
      expect.objectContaining({ path: "delivery.deliverTo.city" })
    );
  });

  it("does not require postalCode — only BT-80 country code is enforced by BR-57", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.delivery!.deliverTo!.postalCode;

    const issues: ValidationIssue[] = [];
    checkDeliveryAddressRequirements(invoice.delivery, issues);

    expect(issues).not.toContainEqual(
      expect.objectContaining({ path: "delivery.deliverTo.postalCode" }),
    );
  });

  it("flags a deliver-to address missing a country code (BR-57)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.delivery!.deliverTo!.countryCode;

    const issues: ValidationIssue[] = [];
    checkDeliveryAddressRequirements(invoice.delivery, issues);

    expect(issues.some((i) => i.code === "DELIVERY_COUNTRY_REQUIRED")).toBe(true);
  });
});
