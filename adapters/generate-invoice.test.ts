import { describe, it, expect } from "vitest";

import { generateInvoice } from "./generate-invoice.js";
import type { Invoice } from "../core/index.js";

import domesticSimple from "../fixtures/domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../fixtures/domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../fixtures/reduced-rate.invoice.json" with { type: "json" };
import exempt from "../fixtures/exempt.invoice.json" with { type: "json" };
import zeroRated from "../fixtures/zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../fixtures/reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "../fixtures/small-business.invoice.json" with { type: "json" };
import intraEuSupply from "../fixtures/intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "../fixtures/export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../fixtures/reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../fixtures/reverse-charge-scrap-metal.invoice.json" with { type: "json" };

const fixtures: [string, unknown][] = [
  ["domestic-simple", domesticSimple],
  ["domestic-multi-line", domesticMultiLine],
  ["reduced-rate", reducedRate],
  ["exempt", exempt],
  ["zero-rated", zeroRated],
  ["reverse-charge", reverseCharge],
  ["small-business", smallBusiness],
  ["intra-eu-supply", intraEuSupply],
  ["export", exportInvoice],
  ["reverse-charge-construction", reverseChargeConstruction],
  ["reverse-charge-scrap-metal", reverseChargeScrapMetal],
];

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("generateInvoice", () => {
  describe.each(fixtures)("valid fixtures (%s)", (_label, fixture) => {
    it("generates XML with no error-severity issues", () => {
      const result = generateInvoice(fixture as Invoice);

      expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(result.xml).not.toBeNull();
      expect(result.xml!.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
  });

  it("withholds XML and reports issues for an invoice with a business-rule error", () => {
    const invoice = clone(reducedRate) as Invoice;
    // 15% is not a valid category 'S' rate (only 19% or 7% are allowed)
    invoice.lines[0]!.vatRate = 15;

    const result = generateInvoice(invoice);

    expect(result.xml).toBeNull();
    expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
  });
});
