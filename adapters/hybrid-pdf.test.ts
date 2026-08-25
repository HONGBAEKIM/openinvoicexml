import { describe, it, expect } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";

import { toHybridPdf } from "./hybrid-pdf.js";
import type { Invoice } from "../core/index.js";

import { allFixtures, domesticSimple } from "../fixtures/index.js";

describe("toHybridPdf", () => {
  it("produces bytes starting with the %PDF header", async () => {
    const bytes = await toHybridPdf(domesticSimple as Invoice);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("produces bytes that PDFDocument.load() can reload", async () => {
    const bytes = await toHybridPdf(domesticSimple as Invoice);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  // Structural smoke test only, across all fixtures: doesn't throw, starts with %PDF, reloads.
  // This does not assert anything about page count, layout, or rendered content per fixture —
  // some fixtures (long descriptions, many lines, unusual allowances) may not render well yet
  // under this first-pass layout. Visual/content correctness is a manual check.
  describe.each(allFixtures)("all fixtures (%s)", (_label, fixture) => {
    it("generates a reloadable PDF without throwing", async () => {
      const bytes = await toHybridPdf(fixture as Invoice);
      expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
      const reloaded = await PDFDocument.load(bytes);
      expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
    });
  });
});
