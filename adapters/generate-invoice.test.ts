import { describe, it, expect } from "vitest";

import { generateInvoice } from "./generate-invoice.js";
import type { Invoice } from "../core/index.js";

import { allFixtures, reducedRate } from "../fixtures/index.js";

/** Deep-clones a fixture so mutations in one test don't leak into others. */
function clone<T>(fixture: T): T {
  return JSON.parse(JSON.stringify(fixture)) as T;
}

describe("generateInvoice", () => {
  describe.each(allFixtures)("valid fixtures (%s)", (_label, fixture) => {
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
