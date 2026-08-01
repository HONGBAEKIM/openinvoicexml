import { describe, it, expect } from "vitest";

import { generateInvoice } from "./generate-invoice.js";
import type { Invoice } from "../core/index.js";

import domesticSimple from "../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../fixtures/02.domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../fixtures/03.reduced-rate.invoice.json" with { type: "json" };
import exempt from "../fixtures/04.exempt.invoice.json" with { type: "json" };
import zeroRated from "../fixtures/05.zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../fixtures/06.reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "../fixtures/07.small-business.invoice.json" with { type: "json" };
import intraEuSupply from "../fixtures/08.intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "../fixtures/09.export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../fixtures/10.reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../fixtures/11.reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import creditNoteFull from "../fixtures/16.credit-note-full.invoice.json" with { type: "json" };
import creditNotePartial from "../fixtures/17.credit-note-partial.invoice.json" with { type: "json" };
import correctiveInvoice from "../fixtures/18.corrective-invoice.invoice.json" with { type: "json" };

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
  ["credit-note-full", creditNoteFull],
  ["credit-note-partial", creditNotePartial],
  ["corrective-invoice", correctiveInvoice],
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
