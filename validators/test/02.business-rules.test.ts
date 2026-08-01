import { describe, it, expect } from "vitest";

import { validateBusinessRules } from "../02.business-rules.js";
import type { Invoice } from "../../core/types/invoice.js";

import domesticSimple from "../../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../../fixtures/02.domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../../fixtures/03.reduced-rate.invoice.json" with { type: "json" };
import exempt from "../../fixtures/04.exempt.invoice.json" with { type: "json" };
import zeroRated from "../../fixtures/05.zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../../fixtures/06.reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "../../fixtures/07.small-business.invoice.json" with { type: "json" };
import intraEuSupply from "../../fixtures/08.intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "../../fixtures/09.export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../../fixtures/10.reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../../fixtures/11.reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import reverseChargeSecurityTransfer from "../../fixtures/12.reverse-charge-security-transfer.invoice.json" with { type: "json" };
import reverseChargeCleaning from "../../fixtures/13.reverse-charge-cleaning.invoice.json" with { type: "json" };
import reverseChargeMobileDevices from "../../fixtures/14.reverse-charge-mobile-devices.invoice.json" with { type: "json" };
import reverseChargeGasAndElectricity from "../../fixtures/15.reverse-charge-gas-and-electricity.invoice.json" with { type: "json" };
import creditNoteFull from "../../fixtures/16.credit-note-full.invoice.json" with { type: "json" };
import creditNotePartial from "../../fixtures/17.credit-note-partial.invoice.json" with { type: "json" };

// Fixture labels are numbered (1-17) to match the "Valid fixtures" table in the doc
// comment below — the number shows up in the test runner's output for each fixture.
const fixtures: [string, unknown][] = [
  ["1. domestic-simple (19% S)", domesticSimple],
  ["2. domestic-multi-line (19% S)", domesticMultiLine],
  ["3. reduced-rate (7% S)", reducedRate],
  ["4. exempt (E)", exempt],
  ["5. zero-rated (Z)", zeroRated],
  ["6. reverse-charge (AE)", reverseCharge],
  ["7. small-business (E)", smallBusiness],
  ["8. intra-eu-supply (K)", intraEuSupply],
  ["9. export (G)", exportInvoice],
  ["10. reverse-charge-construction (AE)", reverseChargeConstruction],
  ["11. reverse-charge-scrap-metal (AE)", reverseChargeScrapMetal],
  ["12. reverse-charge-security-transfer (AE)", reverseChargeSecurityTransfer],
  ["13. reverse-charge-cleaning (AE)", reverseChargeCleaning],
  ["14. reverse-charge-mobile-devices (AE)", reverseChargeMobileDevices],
  ["15. reverse-charge-gas-and-electricity (AE)", reverseChargeGasAndElectricity],
  ["16. credit-note-full (381)", creditNoteFull],
  ["17. credit-note-partial (381)", creditNotePartial],
];

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

/**
 * What's tested here (full business-rule validation pipeline):
 *
 * Every test below is numbered 1-40, in the same top-to-bottom order they appear in the
 * file, so a row here can be matched to its `it(...)` by searching for "N." in either
 * place — useful if you didn't write this file and the describe/it nesting alone isn't
 * enough to navigate by.
 *
 * Valid fixtures
 *
 * | #  | Fixture                              | VAT category | Expected result |
 * |----|---------------------------------------|--------------|------------------|
 * | 1  | domestic-simple                      | S (19%)      | no errors        |
 * | 2  | domestic-multi-line                  | S (19%)      | no errors        |
 * | 3  | reduced-rate                         | S (7%)       | no errors        |
 * | 4  | exempt                               | E            | no errors        |
 * | 5  | zero-rated                           | Z            | no errors        |
 * | 6  | reverse-charge                       | AE           | no errors        |
 * | 7  | small-business                       | E            | no errors        |
 * | 8  | intra-eu-supply                      | K            | no errors        |
 * | 9  | export                               | G            | no errors        |
 * | 10 | reverse-charge-construction          | AE           | no errors        |
 * | 11 | reverse-charge-scrap-metal           | AE           | no errors        |
 * | 12 | reverse-charge-security-transfer     | AE           | no errors        |
 * | 13 | reverse-charge-cleaning              | AE           | no errors        |
 * | 14 | reverse-charge-mobile-devices        | AE           | no errors        |
 * | 15 | reverse-charge-gas-and-electricity   | AE           | no errors        |
 * | 16 | credit-note-full                     | S (19%)      | no errors        |
 * | 17 | credit-note-partial                  | S (19%)      | no errors        |
 *
 * VAT rate and category rules
 *
 * | #  | Test case                                      | Expected issue                |
 * |----|-------------------------------------------------|-------------------------------|
 * | 18 | Category S line has a 0% VAT rate              | VAT_RATE_INVALID_FOR_CATEGORY |
 * | 19 | Reduced-rate category S line has a 0% rate     | VAT_RATE_INVALID_FOR_CATEGORY |
 * | 20 | Category S line uses a rate other than 19%/7%  | VAT_RATE_INVALID_FOR_CATEGORY |
 * | 21 | Category Z line has a positive VAT rate        | VAT_RATE_INVALID_FOR_CATEGORY |
 * | 22 | VAT breakdown rate doesn't match a line rate   | VAT_BREAKDOWN_RATE_MISMATCH   |
 *
 * Monetary amount rules
 *
 * | #  | Test case                                                   | Expected issue               |
 * |----|----------------------------------------------------------------|---------------------------|
 * | 23 | Line amount differs from quantity × unit price              | LINE_AMOUNT_ROUNDING          |
 * | 24 | VAT taxable amount differs from matching line totals        | VAT_TAXABLE_AMOUNT_MISMATCH   |
 * | 25 | VAT amount differs from taxable amount × VAT rate           | VAT_TAX_AMOUNT_ROUNDING       |
 * | 26 | Invoice tax amount differs from summed VAT amounts          | INVOICE_TAX_AMOUNT_MISMATCH   |
 * | 27 | Monetary amount has more than two decimal places            | MONETARY_AMOUNT_DECIMAL_PRECISION |
 * | 28 | Second line in a multi-line invoice has a wrong amount      | LINE_AMOUNT_ROUNDING          |
 * | 29 | Multi-line taxable amount doesn't match summed line amounts | VAT_TAXABLE_AMOUNT_MISMATCH   |
 * | 30 | Reduced-rate 7% VAT amount is calculated incorrectly        | VAT_TAX_AMOUNT_ROUNDING       |
 * | 31 | Zero-rated VAT breakdown has a non-zero tax amount          | VAT_TAX_AMOUNT_ROUNDING       |
 *
 * VAT exemption reason rules
 *
 * | #  | Test case                                             | Expected issue              |
 * |----|----------------------------------------------------------|--------------------------|
 * | 32 | Category E has no exemption reason or reason code     | VAT_EXEMPTION_REASON_REQUIRED   |
 * | 33 | Category S incorrectly has an exemption reason        | VAT_EXEMPTION_REASON_NOT_ALLOWED |
 * | 34 | Category Z incorrectly has an exemption reason        | VAT_EXEMPTION_REASON_NOT_ALLOWED |
 *
 * Place-of-supply rules
 *
 * | #  | Seller | Buyer | Expected result                                     |
 * |----|--------|-------|-------------------------------------------------------|
 * | 35 | DE     | FR    | PLACE_OF_SUPPLY_CROSS_BORDER warning, but no error   |
 * | 36 | DE     | DE    | no PLACE_OF_SUPPLY_CROSS_BORDER warning              |
 *
 * Reverse-charge rules
 *
 * | #  | Category | Test case                  | Expected issue                       |
 * |----|----------|-----------------------------|---------------------------------------|
 * | 37 | AE       | Buyer VAT ID is missing    | REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED |
 *
 * Credit note / corrective invoice rules
 *
 * | #  | Fixture              | Mutation                          | Expected issue                      |
 * |----|-----------------------|-------------------------------------|----------------------------------|
 * | 38 | credit-note-full     | duePayableAmount set positive      | CREDIT_NOTE_POSITIVE_AMOUNT          |
 * | 39 | credit-note-partial  | precedingInvoiceReference removed  | PRECEDING_INVOICE_REFERENCE_REQUIRED |
 *
 * Cross-rule interaction
 *
 * | #  | Test case                                                      | Expected result                                                                     |
 * |----|-------------------------------------------------------------------|-----------------------------------------------------------------------------|
 * | 40 | Intra-EU invoice, deliver-to address present but lacks countryCode | DELIVERY_COUNTRY_REQUIRED reported once via general BR-57; INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED absent (no duplicate) |
 *
 * Exhaustive edge-case coverage for small-business invoices, outside-scope invoices,
 * intra-EU supplies, delivery addresses, exports, reverse-charge subcases, and credit
 * notes / corrective invoices lives alongside their implementations in
 * validators/rules/*.test.ts. Tests 37-40 above are kept here too (rather than only in
 * their respective rule-module test files) to confirm each rule is actually wired into
 * validateBusinessRules() and, for 37 and 40, that it interacts correctly with the other
 * rule modules running in the same pipeline.
 *
 * This file primarily verifies shared rules and confirms that the individual
 * rule modules work correctly together through validateBusinessRules().
 */

describe("validateBusinessRules", () => {
  // Tests 1-17 (see the numbered "Valid fixtures" table above) are generated here, one
  // per fixture in the `fixtures` array above — not as 17 separate it() blocks. The
  // number for each comes from that fixture's label (e.g. "5. zero-rated (Z)"), which
  // vitest substitutes into "%s" below to produce each test's name.
  describe.each(fixtures)("valid fixtures (%s)", (_label, fixture) => {
    // check valid invoices have no error-severity issues (warnings, e.g. a cross-border
    // place-of-supply notice, are informational and don't indicate a rule violation)
    it("has no error-severity issues", () => {
      const issues = validateBusinessRules(fixture as Invoice);
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });
  });

  describe("VAT rate & category rules", () => {
    it("18. flags a category 'S' line with a non-positive VAT rate", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.lines[0]!.vatRate = 0;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("19. flags a category 'S' line at 7% with a zero VAT rate", () => {
      const invoice = clone(reducedRate) as Invoice;
      // fail if number >0
      invoice.lines[0]!.vatRate = 0;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("20. flags a category 'S' line at a rate outside 19%/7%", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // only 19 or 7 are valid; 15 must fail
      invoice.lines[0]!.vatRate = 15;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("21. flags a category 'Z' line with a positive VAT rate", () => {
      const invoice = clone(zeroRated) as Invoice;
      // fail with 0
      invoice.lines[0]!.vatRate = 1;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_RATE_INVALID_FOR_CATEGORY")).toBe(true);
    });

    it("22. flags a VAT breakdown with no matching vat rating", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 19
      invoice.vatBreakdowns[0]!.rate = 25;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_BREAKDOWN_RATE_MISMATCH")).toBe(true);
    });
  });

  describe("monetary amount rules", () => {
    it("23. flags a line amount that doesn't match quantity x unit price", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 1000
      invoice.lines[0]!.lineAmount = 999;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
    });

    it("24. flags a VAT breakdown taxable amount that doesn't match the summed line amounts", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 1000
      invoice.vatBreakdowns[0]!.taxableAmount = 2000;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
    });

    it("25. flags a VAT breakdown tax amount that doesn't match taxable amount x rate", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 190
      invoice.vatBreakdowns[0]!.taxAmount = 100;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });

    it("26. flags an invoice tax amount that doesn't match the summed VAT breakdown amounts", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with 190
      invoice.taxAmount = 100;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "INVOICE_TAX_AMOUNT_MISMATCH")).toBe(true);
    });

    it("27. flags a monetary amount with more than 2 decimal places", () => {
      const invoice = clone(domesticSimple) as Invoice;
      // will be fail with xxxx.xx, xxxx.x, xxxx, xxx, xx, x
      invoice.lines[0]!.lineAmount = 1000.001;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "MONETARY_AMOUNT_DECIMAL_PRECISION")).toBe(true);
    });

    it("28. flags the correct line when line 2 amount doesn't match quantity x unit price", () => {
      const invoice = clone(domesticMultiLine) as Invoice;
      // will be fail with 190
      invoice.lines[1]!.lineAmount = 19;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "LINE_AMOUNT_ROUNDING")).toBe(true);
    });

    it("29. flags VAT_TAXABLE_AMOUNT_MISMATCH across a multi-line invoice", () => {
      const invoice = clone(domesticMultiLine) as Invoice;
      // fail with 1239
      invoice.vatBreakdowns[0]!.taxableAmount = 123;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAXABLE_AMOUNT_MISMATCH")).toBe(true);
    });

    it("30. flags VAT_TAX_AMOUNT_ROUNDING on a 7% reduced-rate breakdown", () => {
      const invoice = clone(reducedRate) as Invoice;
      //fail 17.5
      invoice.vatBreakdowns[0]!.taxAmount = 17.4;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });

    it("31. flags VAT_TAX_AMOUNT_ROUNDING when a zero-rated breakdown has non-zero taxAmount", () => {
      const invoice = clone(zeroRated) as Invoice;
      // fail with 0
      invoice.vatBreakdowns[0]!.taxAmount = 1;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_TAX_AMOUNT_ROUNDING")).toBe(true);
    });
  });

  describe("VAT exemption reason rules", () => {
    it("32. flags an exempt (E) VAT breakdown missing an exemption reason", () => {
      const invoice = clone(exempt) as Invoice;
      delete invoice.vatBreakdowns[0]!.exemptionReason;
      delete invoice.vatBreakdowns[0]!.exemptionReasonCode;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_REQUIRED")).toBe(true);
    });

    it("33. flags a standard-rated (S) breakdown that carries an exemption reason (BR-Z-10)", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.vatBreakdowns[0]!.exemptionReasonCode = "VATEX-EU-79-C";

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_NOT_ALLOWED")).toBe(true);
    });

    it("34. flags a zero-rated (Z) breakdown that carries an exemption reason (BR-Z-10)", () => {
      const invoice = clone(zeroRated) as Invoice;
      invoice.vatBreakdowns[0]!.exemptionReason = "Nullsatz.";

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "VAT_EXEMPTION_REASON_NOT_ALLOWED")).toBe(true);
    });
  });

  describe("place of supply", () => {
    it("35. warns (but doesn't error) when seller and buyer are in different countries", () => {
      const invoice = clone(domesticSimple) as Invoice;
      invoice.buyer.address.countryCode = "FR";

      const issues = validateBusinessRules(invoice);
      const placeOfSupplyIssue = issues.find((i) => i.code === "PLACE_OF_SUPPLY_CROSS_BORDER");

      expect(placeOfSupplyIssue?.severity).toBe("warning");
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    });

    it("36. doesn't warn about place of supply when seller and buyer share a country", () => {
      const issues = validateBusinessRules(clone(domesticSimple) as Invoice);

      expect(issues.some((i) => i.code === "PLACE_OF_SUPPLY_CROSS_BORDER")).toBe(false);
    });
  });

  describe("reverse-charge buyer VAT ID (inline check, VAT category 'AE')", () => {
    it("37. flags a reverse-charge (AE) invoice missing the buyer's VAT ID", () => {
      const invoice = clone(reverseCharge) as Invoice;
      delete invoice.buyer.vatId;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED")).toBe(true);
    });
  });

  describe("credit notes (381) and corrective invoices (384)", () => {
    it("38. flags credit-note-full when duePayableAmount is made positive", () => {
      const invoice = clone(creditNoteFull) as Invoice;
      invoice.duePayableAmount = 1190;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "CREDIT_NOTE_POSITIVE_AMOUNT")).toBe(true);
    });

    it("39. flags credit-note-partial when precedingInvoiceReference is removed", () => {
      const invoice = clone(creditNotePartial) as Invoice;
      delete invoice.precedingInvoiceReference;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "PRECEDING_INVOICE_REFERENCE_REQUIRED")).toBe(true);
    });
  });

  // Per-rule-module unit tests for VAT-category-specific requirements (small business,
  // outside scope, intra-EU supply, delivery address, export, reverse-charge subcases)
  // live alongside their implementations in validators/rules/*.test.ts. The test below
  // is kept here because it verifies how two separate rule modules (delivery.ts and
  // intra-eu.ts) interact within the full pipeline, not a single module in isolation.
  describe("cross-rule interactions", () => {
    it("40. reports a missing deliver-to country code once, via the general BR-57 check, not BR-IC-12", () => {
      const invoice = clone(intraEuSupply) as Invoice;
      delete invoice.delivery!.deliverTo!.countryCode;

      const issues = validateBusinessRules(invoice);

      expect(issues.some((i) => i.code === "DELIVERY_COUNTRY_REQUIRED")).toBe(true);
      expect(issues.some((i) => i.code === "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED")).toBe(false);
    });
  });
});
