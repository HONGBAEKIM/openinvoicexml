import { describe, it, expect } from "vitest";

import { validateBusinessRules } from "../business-rules.js";
import type { Invoice } from "../../core/types/invoice.js";

import domesticSimple from "../../fixtures/domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../../fixtures/domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../../fixtures/reduced-rate.invoice.json" with { type: "json" };
import exempt from "../../fixtures/exempt.invoice.json" with { type: "json" };
import zeroRated from "../../fixtures/zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../../fixtures/reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "../../fixtures/small-business.invoice.json" with { type: "json" };
import intraEuSupply from "../../fixtures/intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "../../fixtures/export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../../fixtures/reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../../fixtures/reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import reverseChargeSecurityTransfer from "../../fixtures/reverse-charge-security-transfer.invoice.json" with { type: "json" };
import reverseChargeCleaning from "../../fixtures/reverse-charge-cleaning.invoice.json" with { type: "json" };
import reverseChargeMobileDevices from "../../fixtures/reverse-charge-mobile-devices.invoice.json" with { type: "json" };
import reverseChargeGasAndElectricity from "../../fixtures/reverse-charge-gas-and-electricity.invoice.json" with { type: "json" };

const fixtures: [string, unknown][] = [
  ["domestic-simple (19% S)", domesticSimple],
  ["domestic-multi-line (19% S)", domesticMultiLine],
  ["reduced-rate (7% S)", reducedRate],
  ["exempt (E)", exempt],
  ["zero-rated (Z)", zeroRated],
  ["reverse-charge (AE)", reverseCharge],
  ["small-business (E)", smallBusiness],
  ["intra-eu-supply (K)", intraEuSupply],
  ["export (G)", exportInvoice],
  ["reverse-charge-construction (AE)", reverseChargeConstruction],
  ["reverse-charge-scrap-metal (AE)", reverseChargeScrapMetal],
  ["reverse-charge-security-transfer (AE)", reverseChargeSecurityTransfer],
  ["reverse-charge-cleaning (AE)", reverseChargeCleaning],
  ["reverse-charge-mobile-devices (AE)", reverseChargeMobileDevices],
  ["reverse-charge-gas-and-electricity (AE)", reverseChargeGasAndElectricity],
];

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/**
 * What's tested here (full business-rule validation pipeline):
 *
 * Valid fixtures
 *
 * | Fixture                              | VAT category | Expected result |
 * |--------------------------------------|--------------|-----------------|
 * | domestic-simple                     | S (19%)      | no errors       |
 * | domestic-multi-line                 | S (19%)      | no errors       |
 * | reduced-rate                        | S (7%)       | no errors       |
 * | exempt                              | E            | no errors       |
 * | zero-rated                          | Z            | no errors       |
 * | reverse-charge                      | AE           | no errors       |
 * | small-business                      | E            | no errors       |
 * | intra-eu-supply                     | K            | no errors       |
 * | export                              | G            | no errors       |
 * | reverse-charge-construction         | AE           | no errors       |
 * | reverse-charge-scrap-metal          | AE           | no errors       |
 * | reverse-charge-security-transfer    | AE           | no errors       |
 * | reverse-charge-cleaning             | AE           | no errors       |
 * | reverse-charge-mobile-devices       | AE           | no errors       |
 * | reverse-charge-gas-and-electricity  | AE           | no errors       |
 *
 * VAT rate and category rules
 *
 * | Test case                                      | Expected issue                         |
 * |------------------------------------------------|----------------------------------------|
 * | Category S line has a 0% VAT rate              | VAT_RATE_INVALID_FOR_CATEGORY          |
 * | Reduced-rate category S line has a 0% rate     | VAT_RATE_INVALID_FOR_CATEGORY          |
 * | Category S line uses a rate other than 19%/7%  | VAT_RATE_INVALID_FOR_CATEGORY          |
 * | Category Z line has a positive VAT rate        | VAT_RATE_INVALID_FOR_CATEGORY          |
 * | VAT breakdown rate doesn't match a line rate   | VAT_BREAKDOWN_RATE_MISMATCH            |
 *
 * Monetary amount rules
 *
 * | Test case                                                   | Expected issue                         |
 * |-------------------------------------------------------------|----------------------------------------|
 * | Line amount differs from quantity × unit price              | LINE_AMOUNT_ROUNDING                   |
 * | VAT taxable amount differs from matching line totals        | VAT_TAXABLE_AMOUNT_MISMATCH            |
 * | VAT amount differs from taxable amount × VAT rate           | VAT_TAX_AMOUNT_ROUNDING                |
 * | Invoice tax amount differs from summed VAT amounts          | INVOICE_TAX_AMOUNT_MISMATCH            |
 * | Monetary amount has more than two decimal places            | MONETARY_AMOUNT_DECIMAL_PRECISION      |
 * | Second line in a multi-line invoice has a wrong amount      | LINE_AMOUNT_ROUNDING                   |
 * | Multi-line taxable amount doesn't match summed line amounts | VAT_TAXABLE_AMOUNT_MISMATCH            |
 * | Reduced-rate 7% VAT amount is calculated incorrectly        | VAT_TAX_AMOUNT_ROUNDING                |
 * | Zero-rated VAT breakdown has a non-zero tax amount          | VAT_TAX_AMOUNT_ROUNDING                |
 *
 * VAT exemption reason rules
 *
 * | Test case                                             | Expected issue                         |
 * |-------------------------------------------------------|----------------------------------------|
 * | Category E has no exemption reason or reason code     | VAT_EXEMPTION_REASON_REQUIRED          |
 * | Category S incorrectly has an exemption reason        | VAT_EXEMPTION_REASON_NOT_ALLOWED       |
 * | Category Z incorrectly has an exemption reason        | VAT_EXEMPTION_REASON_NOT_ALLOWED       |
 *
 * Place-of-supply rules
 *
 * | Seller | Buyer | Expected result                                      |
 * |--------|-------|------------------------------------------------------|
 * | DE     | FR    | PLACE_OF_SUPPLY_CROSS_BORDER warning, but no error   |
 * | DE     | DE    | no PLACE_OF_SUPPLY_CROSS_BORDER warning              |
 *
 * Reverse-charge rules
 *
 * | Category | Test case                  | Expected issue                           |
 * |----------|----------------------------|------------------------------------------|
 * | AE       | Buyer VAT ID is missing    | REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED     |
 *
 * Cross-rule interaction
 *
 * | Test case                                         | Expected result                                      |
 * |---------------------------------------------------|------------------------------------------------------|
 * | Intra-EU deliver-to address lacks countryCode     | DELIVERY_COUNTRY_REQUIRED is reported once via BR-57 |
 * | Same missing countryCode                          | INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED is absent  |
 *
 * Category-specific rules for small-business invoices, outside-scope invoices,
 * intra-EU supplies, delivery addresses, exports, and reverse-charge subcases
 * are tested separately in validators/rules/*.test.ts.
 *
 * This file primarily verifies shared rules and confirms that the individual
 * rule modules work correctly together through validateBusinessRules().
 */

describe("validateBusinessRules", () => {
  describe.each(fixtures)("valid fixtures (%s)", (_label, fixture) => {
    // check valid invoices have no error-severity issues (warnings, e.g. a cross-border
    // place-of-supply notice, are informational and don't indicate a rule violation)
    it("has no error-severity issues", () => {
      const issues = validateBusinessRules(fixture as Invoice);
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });
  });

  describe("VAT rate & category rules", () => {
    it("flags a category 'S' line with a non-positive VAT rate", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.lines[0]!.vatRate = 0;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("flags a category 'S' line at 7% with a zero VAT rate", () => {
      const invoice = clone(reducedRate) as Invoice;
      // fail if number >0
      invoice.lines[0]!.vatRate = 0;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("flags a category 'S' line at a rate outside 19%/7%", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // only 19 or 7 are valid; 15 must fail
      invoice.lines[0]!.vatRate = 15;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("flags a category 'Z' line with a positive VAT rate", () => {
      const invoice = clone(zeroRated) as Invoice;
      // fail with 0
      invoice.lines[0]!.vatRate = 1;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("flags a VAT breakdown with no matching vat rating", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 19
      invoice.vatBreakdowns[0]!.rate = 25;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_BREAKDOWN_RATE_MISMATCH")).toBe(true);
    });
  });

  describe("monetary amount rules", () => {
    it("flags a line amount that doesn't match quantity x unit price", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 1000
      invoice.lines[0]!.lineAmount = 999;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
    });

    it("flags a VAT breakdown taxable amount that doesn't match the summed line amounts", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 1000
      invoice.vatBreakdowns[0]!.taxableAmount = 2000;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
    });

    it("flags a VAT breakdown tax amount that doesn't match taxable amount x rate", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 190
      invoice.vatBreakdowns[0]!.taxAmount = 100;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });

    it("flags an invoice tax amount that doesn't match the summed VAT breakdown amounts", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 190
      invoice.taxAmount = 100;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "INVOICE_TAX_AMOUNT_MISMATCH")).toBe(true);
    });

    it("flags a monetary amount with more than 2 decimal places", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with xxxx.xx, xxxx.x, xxxx, xxx, xx, x
      invoice.lines[0]!.lineAmount = 1000.001;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "MONETARY_AMOUNT_DECIMAL_PRECISION")).toBe(true);
    });

    it("flags the correct line when line 2 amount doesn't match quantity x unit price", () => {
      const invoice = clone(domesticMultiLine) as Invoice;
      // will be fail with 190
      invoice.lines[1]!.lineAmount = 19;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
    });

    it("flags VAT_TAXABLE_AMOUNT_MISMATCH across a multi-line invoice", () => {
      const invoice = clone(domesticMultiLine) as Invoice;
      // fail with 1239
      invoice.vatBreakdowns[0]!.taxableAmount = 123;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
    });

    it("flags VAT_TAX_AMOUNT_ROUNDING on a 7% reduced-rate breakdown", () => {
      const invoice = clone(reducedRate) as Invoice;
      //fail 17.5
      invoice.vatBreakdowns[0]!.taxAmount = 17.4;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });

    it("flags VAT_TAX_AMOUNT_ROUNDING when a zero-rated breakdown has non-zero taxAmount", () => {
      const invoice = clone(zeroRated) as Invoice;
      // fail with 0
      invoice.vatBreakdowns[0]!.taxAmount = 1;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });
  });

  describe("VAT exemption reason rules", () => {
    it("flags an exempt (E) VAT breakdown missing an exemption reason", () => {
      const invoice = clone(exempt) as Invoice;
      delete invoice.vatBreakdowns[0]!.exemptionReason;
      delete invoice.vatBreakdowns[0]!.exemptionReasonCode;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_REQUIRED")).toBe(true);
    });

    it("flags a standard-rated (S) breakdown that carries an exemption reason (BR-Z-10)", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.vatBreakdowns[0]!.exemptionReasonCode = "VATEX-EU-79-C";

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_NOT_ALLOWED")).toBe(true);
    });

    it("flags a zero-rated (Z) breakdown that carries an exemption reason (BR-Z-10)", () => {
      const invoice = clone(zeroRated) as Invoice;
      invoice.vatBreakdowns[0]!.exemptionReason = "Nullsatz.";

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_NOT_ALLOWED")).toBe(true);
    });
  });

  describe("place of supply", () => {
    it("warns (but doesn't error) when seller and buyer are in different countries", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.buyer.address.countryCode = "FR";

      const issues = validateBusinessRules(invoice);
      const placeOfSupplyIssue = issues.find((i) => i.code === "PLACE_OF_SUPPLY_CROSS_BORDER");

      expect(placeOfSupplyIssue?.severity).toBe("warning");
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });

    it("doesn't warn about place of supply when seller and buyer share a country", () => {
      const issues = validateBusinessRules(clone(domesticSimple) as Invoice);

      expect(issues.some((i) => i.code === "PLACE_OF_SUPPLY_CROSS_BORDER")).toBe(false);
    });
  });

  describe("reverse-charge buyer VAT ID (inline check, VAT category 'AE')", () => {
    it("flags a reverse-charge (AE) invoice missing the buyer's VAT ID", () => {
      const invoice = clone(reverseCharge) as Invoice;
      delete invoice.buyer.vatId;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED")).toBe(true);
    });
  });

  // Per-rule-module unit tests for VAT-category-specific requirements (small business,
  // outside scope, intra-EU supply, delivery address, export, reverse-charge subcases)
  // live alongside their implementations in validators/rules/*.test.ts. The test below
  // is kept here because it verifies how two separate rule modules (delivery.ts and
  // intra-eu.ts) interact within the full pipeline, not a single module in isolation.
  describe("cross-rule interactions", () => {
    it("reports a missing deliver-to country code once, via the general BR-57 check, not BR-IC-12", () => {
      const invoice = clone(intraEuSupply) as Invoice;
      delete invoice.delivery!.deliverTo!.countryCode;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "DELIVERY_COUNTRY_REQUIRED")).toBe(true);
      expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED")).toBe(false);
    });
  });
});
