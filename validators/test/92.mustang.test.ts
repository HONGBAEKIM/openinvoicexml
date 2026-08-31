import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
// Gets the operating system's temporary directory.
import { tmpdir } from "node:os";
// Join files paths
import { join } from "node:path";
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
// beforeAll() → runs once before any test, so shared setup only happens once.
// afterAll() → runs once after all tests are finished to clean up.
import { describe, it, expect, afterAll } from "vitest";

import { runMustang, extractWithMustang } from "../92.mustang.js";
import { toXRechnung } from "../../adapters/xrechnung.js";
import { toHybridPdf } from "../../adapters/hybrid-pdf.js";
import type { Invoice } from "../../core/index.js";

import { allFixtures } from "../../fixtures/index.js";

const JAVA_BIN = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";
const JAR_PATH = "tools/mustang/mustang-cli.jar";

function mustangAvailable(): boolean {
  if (!existsSync(JAR_PATH)) 
    return false;
  try {
    execFileSync(JAVA_BIN, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const available = mustangAvailable();
const workDir = mkdtempSync(join(tmpdir(), "mustang-test-"));

afterAll(() => {
  // recursive: true: Delete everything inside
  // force: true: Do not throw an error if it is already gone
  rmSync(workDir, { recursive: true, force: true });
});

/**
 * What's tested here (real Mustang Project CLI — an independent, third-party e-invoicing tool):
 *
 * - One test per current fixture: generates a hybrid PDF, confirms Mustang's own `--action
 *   extract` recovers XML byte-identical to `toXRechnung()`'s direct output, then confirms
 *   Mustang's own `--action validate` on that *extracted* XML reports zero error-severity
 *   findings — the main claim this validator exists for (see docs/COMPLIANCE.md for why the
 *   extracted XML, not the PDF directly, is what gets validated).
 * - One negative control ("rejects an invoice missing mandatory fields"): confirms the harness
 *   actually catches errors rather than rubber-stamping anything handed to it.
 * - One capability check ("accepts a PDF directly"): confirms Mustang can validate a hybrid PDF
 *   via `--source` too, without relying on that as the main round-trip claim above — see
 *   docs/COMPLIANCE.md for why PDF validation stays a tested capability, not the gating check.
 *
 * Skipped entirely (not failed) when Java or the Mustang jar aren't available locally.
 */
describe.skipIf(!available)("runMustang / extractWithMustang", () => {
  describe.each(allFixtures)("%s", (label, fixture) => {
    it("extracts byte-identical XML and passes Mustang's own validation with zero errors", async () => {
      const invoice = fixture as Invoice;
      const expected = toXRechnung(invoice);
      const slug = label.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "");
      const pdfPath = join(workDir, `${slug}.pdf`);
      writeFileSync(pdfPath, await toHybridPdf(invoice));

      const extracted = extractWithMustang(pdfPath, { jarPath: JAR_PATH });
      expect(extracted).toBe(expected);

      const xmlPath = join(workDir, `${slug}.xml`);
      writeFileSync(xmlPath, extracted);

      const results = runMustang([xmlPath], {
        jarPath: JAR_PATH
      });
      // Check that the results array contains exactly 1 item.
      expect(results).toHaveLength(1);
      expect(results[0]!.valid).toBe(true);
      expect(results[0]!.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);

      // Mustang spawns a JVM synchronously per call (twice per fixture here); let Node's
      // event loop breathe between fixtures, same reasoning as validators/test/90.kosit.test.ts.
      await new Promise((resolve) => setImmediate(resolve));
    }, 30000);
  });

  it("rejects an invoice missing mandatory fields", () => {
    const broken = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
</ubl:Invoice>`;
    const xmlPath = join(workDir, "broken.xml");
    writeFileSync(xmlPath, broken);

    const results = runMustang([xmlPath], { jarPath: JAR_PATH });

    // Check that the results array contains exactly 1 item.
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.issues.some((issue) => issue.severity === "error")).toBe(true);
  }, 20000);

  it("accepts a hybrid PDF directly via --source (capability check, not the main round-trip claim)", async () => {
    const invoice = allFixtures[0]![1] as Invoice;
    const pdfPath = join(workDir, "direct-pdf-check.pdf");
    writeFileSync(pdfPath, await toHybridPdf(invoice));

    const [result] = runMustang([pdfPath], { jarPath: JAR_PATH });

    // This PDF isn't Factur-X/ZUGFeRD-branded (it embeds UBL, not CII — see LIMITATIONS.md), so
    // Mustang's PDF/Factur-X interpretation of it is expected to report findings; this test only
    // proves the CLI accepts a PDF as --source and produces a parseable report, not that direct
    // PDF validation is clean.
    expect(result!.file).toBe(pdfPath);
    expect(typeof result!.valid).toBe("boolean");
  }, 20000);
});
