import { describe, it, expect } from "vitest";
import { PDFDocument, parsePDFAConformanceFromXmp, AFRelationship } from "@cantoo/pdf-lib";

import { toHybridPdf } from "./hybrid-pdf.js";
import { toXRechnung } from "./xrechnung.js";
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

  describe("PDF/A-3b conformance", () => {
    // pdf-lib compresses indirect objects into object streams by default for PDF 1.7+ output,
    // so the OutputIntent dict isn't literal text in `bytes` itself. Reload and re-save with
    // useObjectStreams: false to get a flat, greppable byte stream for these structural checks —
    // the XMP metadata stream itself is always written unfiltered either way.
    async function toFlatText(invoice: Invoice): Promise<string> {
      const bytes = await toHybridPdf(invoice);
      const reloaded = await PDFDocument.load(bytes);
      const flat = await reloaded.save({ useObjectStreams: false });
      return Buffer.from(flat).toString("latin1");
    }

    it("declares the PDF/A-3b OutputIntent (ICC profile)", async () => {
      const text = await toFlatText(domesticSimple as Invoice);
      expect(text).toContain("/OutputIntents");
      expect(text).toContain("GTS_PDFA1");
    });

    it("writes pdfaid:part=3 / pdfaid:conformance=B into the XMP metadata", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const text = Buffer.from(bytes).toString("latin1");
      expect(parsePDFAConformanceFromXmp(text)).toEqual({ part: 3, level: "B" });
    });

    it("introduces no transparency (ExtGState) objects", async () => {
      const text = await toFlatText(domesticSimple as Invoice);
      expect(text).not.toContain("/Type /ExtGState");
    });

    it("bumps the PDF header to version 1.7, as required for PDF/A part 3", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const header = Buffer.from(bytes.slice(0, 8)).toString("ascii");
      expect(header).toBe("%PDF-1.7");
    });
  });

  describe("XRechnung XML attachment", () => {
    it("attaches the XML as xrechnung.xml with text/xml and AFRelationship=Alternative", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const reloaded = await PDFDocument.load(bytes);
      const attachment = reloaded.getAttachments().find((a) => a.name === "xrechnung.xml");
      expect(attachment).toBeDefined();
      expect(attachment?.mimeType).toBe("text/xml");
      expect(attachment?.afRelationship).toBe(AFRelationship.Alternative);
    });

    it("embeds XML byte-identical to toXRechnung()'s direct output", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const reloaded = await PDFDocument.load(bytes);
      const attachment = reloaded.getAttachments().find((a) => a.name === "xrechnung.xml");
      expect(Buffer.from(attachment!.data).toString("utf-8")).toBe(
        toXRechnung(domesticSimple as Invoice),
      );
    });
  });

  // Structural smoke test only, across all fixtures: doesn't throw, starts with %PDF, reloads,
  // and carries the xrechnung.xml attachment. This does not assert anything about page count,
  // layout, or rendered content per fixture — some fixtures (long descriptions, many lines,
  // unusual allowances) may not render well yet under this first-pass layout. Visual/content
  // correctness is a manual check.
  describe.each(allFixtures)("all fixtures (%s)", (_label, fixture) => {
    it("generates a reloadable PDF without throwing", async () => {
      const bytes = await toHybridPdf(fixture as Invoice);
      expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
      const reloaded = await PDFDocument.load(bytes);
      expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(reloaded.getAttachments().some((a) => a.name === "xrechnung.xml")).toBe(true);
    });
  });
});
