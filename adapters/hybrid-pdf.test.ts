import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, afterAll } from "vitest";
import { PDFDocument, parsePDFAConformanceFromXmp, AFRelationship } from "@cantoo/pdf-lib";

import { toHybridPdf, toFacturXPdf, extractEmbeddedXml } from "./hybrid-pdf.js";
import { toXRechnung } from "./xrechnung.js";
import { toCii } from "./cii.js";
import type { Invoice } from "../core/index.js";

import { allFixtures, domesticSimple } from "../fixtures/index.js";

// toFacturXPdf()
// Creates the PDF and embeds factur-x.xml.

// PDFDocument.load(bytes)
// Opens the finished PDF again so we can inspect it.

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
    // latin1  = 0–255, so it can represent every possible byte value
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

  describe("profile option", () => {
    // profile currently has no effect on generated output — both values produce the same
    // working hybrid PDF. Not asserting byte-identical output (too strict a bar for a
    // generated PDF; unrelated pdf-lib changes could alter serialization without changing
    // anything this test cares about) — just that both values still produce a valid,
    // reloadable PDF/A-3 with the XRechnung attachment, same as the no-options call above.
    it.each(["XRECHNUNG", "EN16931"] as const)(
      "produces a valid hybrid PDF with profile %s",
      async (profile) => {
        const bytes = await toHybridPdf(domesticSimple as Invoice, { profile });
        expect(bytes).toBeInstanceOf(Uint8Array);
        const reloaded = await PDFDocument.load(bytes);
        expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
        expect(reloaded.getAttachments().some((a) => a.name === "xrechnung.xml")).toBe(true);
      },
    );
  });

  describe("extractEmbeddedXml", () => {
    const dir = mkdtempSync(join(tmpdir(), "hybrid-pdf-extract-test-"));

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("extracts XML byte-identical to toXRechnung()'s direct output", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const pdfPath = join(dir, "domestic-simple.pdf");
      writeFileSync(pdfPath, bytes);

      const extracted = await extractEmbeddedXml(pdfPath);

      expect(extracted).toBe(toXRechnung(domesticSimple as Invoice));
    });

    it("throws a clear error when the PDF has no xrechnung.xml attachment", async () => {
      const plainDoc = await PDFDocument.create();
      plainDoc.addPage();
      const bytes = await plainDoc.save();
      const pdfPath = join(dir, "plain.pdf");
      writeFileSync(pdfPath, bytes);

      await expect(extractEmbeddedXml(pdfPath)).rejects.toThrow(
        `No xrechnung.xml attachment found in ${pdfPath}`,
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

describe("toFacturXPdf", () => {
  it("produces bytes starting with the %PDF header", async () => {
    const bytes = await toFacturXPdf(domesticSimple as Invoice);
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("produces bytes that PDFDocument.load() can reload", async () => {
    const bytes = await toFacturXPdf(domesticSimple as Invoice);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  describe("PDF/A-3b conformance", () => {
    // embedFacturX() already converts the PDF to PDF/A-3.
    // Check here that the conversion really happened, like in the toHybridPdf() tests.
    // PDF/A-3B
    // 3B = visual preservation
    it("writes pdfaid:part=3 / pdfaid:conformance=B into the XMP metadata", async () => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice);
      const text = Buffer.from(bytes).toString("latin1");
      expect(parsePDFAConformanceFromXmp(text)).toEqual({ part: 3, level: "B" });
    });

    it("bumps the PDF header to version 1.7, as required for PDF/A part 3", async () => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice);
      const header = Buffer.from(bytes.slice(0, 8)).toString("ascii");
      expect(header).toBe("%PDF-1.7");
    });
  });

  describe("Factur-X XMP metadata (fx:)", () => {
    // "EN16931" (this project's EInvoiceProfile) is not literally "EN 16931"
    // (@cantoo/pdf-lib's FacturXConformanceLevel) — confirmed against the real embedFacturX()
    // source before implementing; this is the regression test for that mapping.
    it.each([
      ["EN16931", "EN 16931"],
      ["XRECHNUNG", "XRECHNUNG"],
    ] as const)("writes fx:ConformanceLevel=%s as %s in XMP", async (profile, expected) => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice, { profile });
      const text = Buffer.from(bytes).toString("latin1");
      expect(text).toContain(`<fx:ConformanceLevel>${expected}</fx:ConformanceLevel>`);
    });

    it("writes fx:DocumentFileName matching the attached file name", async () => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice);
      const text = Buffer.from(bytes).toString("latin1");
      expect(text).toContain("<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>");
    });
  });

  describe("Factur-X CII XML attachment", () => {
    it("attaches the XML as factur-x.xml with text/xml and AFRelationship=Alternative", async () => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice);
      const reloaded = await PDFDocument.load(bytes);
      const attachment = reloaded.getAttachments().find((a) => a.name === "factur-x.xml");
      // factur-x.xml really exists inside the PDF.
      expect(attachment).toBeDefined();
      // The PDF knows this attachment is an XML file.
      expect(attachment?.mimeType).toBe("text/xml");
      // Did we mark factur-x.xml as the machine-readable alternative to the visible PDF invoice?
      expect(attachment?.afRelationship).toBe(AFRelationship.Alternative);
    });

    it("embeds XML byte-identical to toCii()'s direct output, per profile", async () => {
      // Is the correct XML really embedded in the PDF?
      // XML directly from toCii() == XML extracted from the PDF
      for (const profile of ["EN16931", "XRECHNUNG"] as const) {
        const bytes = await toFacturXPdf(domesticSimple as Invoice, { profile });
        const reloaded = await PDFDocument.load(bytes);
        const attachment = reloaded.getAttachments().find((a) => a.name === "factur-x.xml");
        expect(Buffer.from(attachment!.data).toString("utf-8")).toBe(
          toCii(domesticSimple as Invoice, { profile }),
        );
      }
    });
  });

  // Can our extractEmbeddedXml() function correctly get that XML back out?
  describe("extractEmbeddedXml(path, \"factur-x.xml\")", () => {
    const dir = mkdtempSync(join(tmpdir(), "facturx-pdf-extract-test-"));

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("extracts XML byte-identical to toCii()'s direct output", async () => {
      const bytes = await toFacturXPdf(domesticSimple as Invoice);
      const pdfPath = join(dir, "domestic-simple.pdf");
      writeFileSync(pdfPath, bytes);

      const extracted = await extractEmbeddedXml(pdfPath, "factur-x.xml");

      expect(extracted).toBe(toCii(domesticSimple as Invoice));
    });

    it("still defaults to xrechnung.xml, so an existing toHybridPdf() caller is unaffected", async () => {
      const bytes = await toHybridPdf(domesticSimple as Invoice);
      const pdfPath = join(dir, "domestic-simple-hybrid.pdf");
      writeFileSync(pdfPath, bytes);

      const extracted = await extractEmbeddedXml(pdfPath);

      expect(extracted).toBe(toXRechnung(domesticSimple as Invoice));
    });
  });

  // Same structural smoke test as toHybridPdf()'s own, across all fixtures and both profiles.
  // For every test invoice and both profiles, can we successfully create a real PDF with at least one page and the Factur-X XML attachment?
  describe.each(allFixtures)("all fixtures (%s)", (_label, fixture) => {
    it.each(["EN16931", "XRECHNUNG"] as const)(
      "generates a reloadable PDF with the factur-x.xml attachment, profile %s",
      async (profile) => {
        const bytes = await toFacturXPdf(fixture as Invoice, { profile });
        expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
        const reloaded = await PDFDocument.load(bytes);
        expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
        expect(reloaded.getAttachments().some((a) => a.name === "factur-x.xml")).toBe(true);
      },
    );
  });
});
