import { describe, it, expect } from "vitest";

import { checkIntraEuSupplyRequirements } from "../rules/intra-eu.js";
import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

import intraEuSupply from "../../fixtures/intra-eu-supply.invoice.json" with { type: "json" };

function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

function check(invoice: Invoice): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  checkIntraEuSupplyRequirements(
    invoice.seller,
    invoice.buyer,
    invoice.vatBreakdowns,
    invoice.delivery,
    issues,
  );
  return issues;
}

/**
 * What's tested here (VAT category 'K' — intra-EU supply, §6a UStG):
 *
 * | Seller | Buyer            | Delivered to    | Category K? | Reason                                     |
 * |--------|------------------|-----------------|-------------|---------------------------------------------|
 * | DE     | FR               | FR              | Yes         | valid intra-EU goods supply                  |
 * | DE     | NL               | NL              | Yes         | valid intra-EU goods supply                  |
 * | FR     | DE               | DE              | Yes         | valid intra-EU goods supply                  |
 * | IT     | ES               | ES              | Yes         | valid intra-EU goods supply                  |
 * | DE     | US               | US              | No          | buyer is outside the EU                      |
 * | DE     | FR (no VAT ID)   | FR              | No          | buyer VAT ID is missing                      |
 * | DE     | DE               | DE              | No          | domestic sale, not cross-border              |
 * | DE     | CH               | CH              | No          | buyer is outside the EU                      |
 * | DE     | FR               | FR (no date)    | No          | missing delivery date (BR-IC-11)             |
 * | DE     | FR               | (missing)       | No          | missing deliver-to address (BR-IC-12)        |
 * | DE     | FR               | FR (bad reason) | No          | exemption reason doesn't mention §6a UStG    |
 * | DE     | FR               | DE (= seller)   | No          | goods never left the seller's own country    |
 * | DE     | FR (bad VAT ID)  | FR              | No          | buyer VAT ID has the wrong format            |
 * | DE (bad VAT ID) | FR        | FR              | No          | seller VAT ID has the wrong format           |
 *
 * (The "deliverTo present but missing only countryCode -> BR-57, not BR-IC-12" case is covered by
 * the "cross-rule interactions" test in business-rules.test.ts instead, via the full pipeline —
 * not duplicated here.)
 */
describe("checkIntraEuSupplyRequirements", () => {
  it("accepts a compliant intra-EU supply (K) invoice (DE seller -> FR buyer, delivered to FR)", () => {
    const invoice = clone(intraEuSupply) as Invoice;

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("accepts a compliant intra-EU supply (K) invoice (DE seller -> NL buyer, delivered to NL)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.buyer.address.countryCode = "NL";
    invoice.buyer.vatId = "NL123456789B01";
    invoice.delivery!.deliverTo!.countryCode = "NL";

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("accepts a compliant intra-EU supply (K) invoice (FR seller -> DE buyer, delivered to DE)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.seller.address.countryCode = "FR";
    invoice.seller.vatId = "FR12345678901";
    invoice.buyer.address.countryCode = "DE";
    invoice.buyer.vatId = "DE987654321";
    invoice.delivery!.deliverTo!.countryCode = "DE";

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  // This project's core focus is domestic German B2B invoicing (DE seller + DE buyer, per the
  // 2028 mandate in ROADMAP.md) — this IT->ES pair has no German party at all, so it's here only
  // to prove the country-pair logic itself is generic, not DE-hardcoded. 
  it("accepts a compliant intra-EU supply (K) invoice (IT seller -> ES buyer, delivered to ES)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.seller.address.countryCode = "IT";
    invoice.seller.vatId = "IT12345678901";
    invoice.buyer.address.countryCode = "ES";
    invoice.buyer.vatId = "ESA1234567B";
    invoice.delivery!.deliverTo!.countryCode = "ES";

    const issues = check(invoice);

    expect(issues).toEqual([]);
  });

  it("flags an intra-EU supply (K) invoice where the buyer is outside the EU (US)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.buyer.address.countryCode = "US";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_BUYER_COUNTRY_NOT_EU")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice missing the buyer's VAT ID", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.buyer.vatId;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_BUYER_VAT_ID_REQUIRED")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice where seller and buyer share a country", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.buyer.address.countryCode = "DE";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_COUNTRY_MISMATCH")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice where the buyer is outside the EU", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.buyer.address.countryCode = "CH";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_BUYER_COUNTRY_NOT_EU")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice missing the delivery date (BR-IC-11)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.delivery!.actualDeliveryDate;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_DELIVERY_DATE_REQUIRED")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice missing the deliver-to address entirely (BR-IC-12)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    delete invoice.delivery!.deliverTo;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice whose exemption reason doesn't reference §6a UStG", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.vatBreakdowns[0]!.exemptionReason = "Steuerfrei.";
    delete invoice.vatBreakdowns[0]!.exemptionReasonCode;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_EXEMPTION_REASON_INVALID")).toBe(true);
  });

  it("flags an intra-EU supply (K) invoice delivered back to the seller's own country (goods never left)", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.delivery!.deliverTo!.countryCode = invoice.seller.address.countryCode;

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_MATCHES_SELLER")).toBe(
      true,
    );
  });

  it("flags an intra-EU supply (K) invoice whose buyer VAT ID doesn't match the expected format", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.buyer.vatId = "FR-not-a-valid-vat-id";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_BUYER_VAT_ID_INVALID_FORMAT")).toBe(
      true,
    );
  });

  it("flags an intra-EU supply (K) invoice whose seller VAT ID doesn't match the expected format", () => {
    const invoice = clone(intraEuSupply) as Invoice;
    invoice.seller.vatId = "DE-not-a-valid-vat-id";

    const issues = check(invoice);

    expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_SELLER_VAT_ID_INVALID_FORMAT")).toBe(
      true,
    );
  });
});
