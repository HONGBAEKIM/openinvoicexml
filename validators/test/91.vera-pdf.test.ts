import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
// Gets the operating system's temporary directory.
import { tmpdir } from "node:os";
// Join files paths
import { join, resolve } from "node:path";
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
// beforeAll() → runs once before any test, so shared setup only happens once.
// afterAll() → runs once after all tests are finished to clean up.
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { runVeraPdf } from "../91.vera-pdf.js";
import { toHybridPdf } from "../../adapters/hybrid-pdf.js";
import type { Invoice } from "../../core/index.js";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";

import { allFixtures } from "../../fixtures/index.js";

const CLI_PATH = "tools/verapdf/verapdf";
const PORTABLE_JRE_HOME = resolve("tools/jre");

function veraPdfAvailable(): boolean {
  if (!existsSync(CLI_PATH)) return false;
  try {
    const env = { ...process.env };
    if (existsSync(`${PORTABLE_JRE_HOME}/bin/java`)) 
      env.JAVA_HOME = PORTABLE_JRE_HOME;
    // This executes tools/verapdf/verapdf --version
    execFileSync(CLI_PATH, ["--version"], { stdio: "ignore", env });
    return true;
  } catch {
    return false;
  }
}

const available = veraPdfAvailable();
const workDir = mkdtempSync(join(tmpdir(), "verapdf-test-"));

afterAll(() => {
  // recursive: true: Delete everything inside
  // force: true: Do not throw an error if it is already gone
  rmSync(workDir, { recursive: true, force: true });
});


/**
 * Tests that our generated hybrid PDFs really pass veraPDF PDF/A-3b validation.
 *
 * - Generates a PDF for every invoice fixture.
 * - Runs the real veraPDF CLI against all generated PDFs.
 * - Checks that every fixture is valid and has zero errors.
 * - Also creates one normal non-PDF/A PDF and checks that veraPDF rejects it.
 *   This proves the validator is actually catching invalid PDFs.
 *
 * If veraPDF or Java is not installed, these tests are skipped.
 *
 * All fixture PDFs are validated together in one veraPDF run to avoid
 * starting Java separately for every fixture.
 */
describe.skipIf(!available)("runVeraPdf", () => {
  let results: Map<string, ReturnType<typeof runVeraPdf>[number]>;

  // Simple example:
  //
  // allFixtures:
  // [
  //   ["1. domestic-simple (19% S)", fixtureA],
  //   ["2. credit-note (19% S)", fixtureB],
  // ]
  //
  // after generating PDFs:
  //
  // paths = [
  //   "/tmp/.../domestic-simple.pdf",
  //   "/tmp/.../credit-note.pdf",
  // ]
  //
  // byPath = Map {
  //   "1. domestic-simple (19% S)" => "/tmp/.../domestic-simple.pdf",
  //   "2. credit-note (19% S)"     => "/tmp/.../credit-note.pdf",
  // }
  //
  // runVeraPdf(paths) returns:
  //
  // batch = [
  //   { file: "/tmp/.../domestic-simple.pdf", valid: true, issues: [] },
  //   { file: "/tmp/.../credit-note.pdf", valid: true, issues: [] },
  // ]
  //
  // byFile = Map {
  //   "/tmp/.../domestic-simple.pdf" => { ...result },
  //   "/tmp/.../credit-note.pdf"     => { ...result },
  // }
  //
  // final results = Map {
  //   "1. domestic-simple (19% S)" => { ...veraPDF result },
  //   "2. credit-note (19% S)"     => { ...veraPDF result },
  // }
  //
  // So the flow is:
  // fixture label -> generated PDF path -> veraPDF result

  beforeAll(async () => {
    const paths: string[] = [];
    const byPath = new Map<string, string>();
    for (const [label, fixture] of allFixtures) {
      // example) 1. domestic-simple (19% S) -> domestic-simple
      const slug = label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "");
      const pdfPath = join(workDir, `${slug}.pdf`);
      const pdf = await toHybridPdf(fixture as Invoice);
      writeFileSync(pdfPath, pdf);
      // Save path
      paths.push(pdfPath);
      // fixture label -> actual PDF filename
      byPath.set(label, pdfPath);
    }

    // Validate all fixture PDFs in one veraPDF run.
    //
    // Instead of:
    // start Java
    // validate fixture 1
    // stop Java
    // start Java
    // validate fixture 2
    // stop Java
    //
    // We do:
    // start Java
    // validate fixture 1
    // validate fixture 2
    // validate fixture 3
    // stop Java
    const batch = runVeraPdf(paths);
    const byFile = new Map(batch.map((result) => [resolve(result.file), result]));
    results = new Map(
      [...byPath.entries()].map(([label, pdfPath]) => [label, byFile.get(resolve(pdfPath))!]),
    );
  }, 120000);

  describe.each(allFixtures)("%s", (label) => {
    it("passes veraPDF PDF/A-3b validation with zero errors", () => {
      const result = results.get(label);
      if (!result) 
        { throw new Error(`No veraPDF result found for fixture: ${label}`); }
      expect(result.valid).toBe(true);
      expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    });
  });

  it("rejects a plain, non-PDF/A PDF", async () => {
    // plain.pdf
    // ├── valid PDF?            yes
    // ├── can open normally?    yes
    // └── PDF/A-3b compliant?   no

    // Deliberately plain: no embedded font, no XMP metadata, no output intent 
    // every one of the PDF/A-3b requirements Task 3 needs to guard against.
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Hello", { x: 50, y: 100, size: 24, font });
    const bytes = await doc.save();
    const pdfPath = join(workDir, "plain.pdf");
    writeFileSync(pdfPath, bytes);

    const [result] = runVeraPdf([pdfPath]);

    expect(result!.valid).toBe(false);
    expect(result!.issues.some((issue) => issue.severity === "error")).toBe(true);
  }, 20000);
});
