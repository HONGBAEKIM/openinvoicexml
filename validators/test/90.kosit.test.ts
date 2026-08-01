import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
// Gets the operating system's temporary directory.
import { tmpdir } from "node:os";
// Join files paths
import { join } from "node:path";
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
// afterAll() → runs once after all tests are finished to clean up.
import { describe, it, expect, afterAll } from "vitest";

import { runKosit } from "../90.kosit.js";
import { toXRechnung } from "../../adapters/xrechnung.js";
import type { Invoice } from "../../core/index.js";

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
  ["reverse-charge-security-transfer", reverseChargeSecurityTransfer],
  ["reverse-charge-cleaning", reverseChargeCleaning],
  ["reverse-charge-mobile-devices", reverseChargeMobileDevices],
  ["reverse-charge-gas-and-electricity", reverseChargeGasAndElectricity],
];

const JAVA_BIN = existsSync("tools/jre/bin/java") ? "tools/jre/bin/java" : "java";
const JAR_PATH = "tools/kosit/validator.jar";
const SCENARIOS_PATH = "tools/kosit/config/scenarios.xml";

function kositAvailable(): boolean {
  if (!existsSync(JAR_PATH) || !existsSync(SCENARIOS_PATH)) return false;
  try {
    // This executes
    // java -version
    //or tools/jre/bin/java -version
    execFileSync(JAVA_BIN, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const available = kositAvailable();
// mkdtempSync() appends exactly 6 random characters
const workDir = mkdtempSync(join(tmpdir(), "kosit-test-"));

afterAll(() => {
  // recursive: true: Delete everything inside
  // force: true: Do not throw an error if it is already gone
  rmSync(workDir, { recursive: true, force: true });
});

// if Java isn't installed, tests are skipped instead of failing.
describe.skipIf(!available)("runKosit", () => {
  describe.each(fixtures)("%s", (label, fixture) => {
    // KoSIT spawns a JVM synchronously per call; startup + schema loading
    // alone takes ~9-10s, well past vitest's default 5s testTimeout.
    it("passes KoSIT validation with zero errors", async () => {
      // toXRechnung(invoice: Invoice)
      // This function only accepts data shaped like Invoice.

      // so we added as unknown and say Typescript, stop checking
      // as unknown as Invoice: this JSON really matches Invoice"
      const xml = toXRechnung(fixture as Invoice);
      const xmlPath = join(workDir, `${label}.xml`);
      // Writes the XML to disk because KoSIT validates files, not strings.
      writeFileSync(xmlPath, xml);

      const results = runKosit([xmlPath], { jarPath: JAR_PATH, scenariosPath: SCENARIOS_PATH });

      // There is one validation result.
      // Returning one KositResult per file
      expect(results).toHaveLength(1);
      // The validation passed.
      // It only tells TypeScript not to worry that results[0] might be undefined
      // Check that the first validation result is valid
      expect(results[0]!.valid).toBe(true);
      // There are no error messages in the validation results.
      // Get the issus
      // keep only issues where the severity is "error"
      // Check that the filtered array has 0 items. (There are no errors)
      expect(results[0]!.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
      // Fixture 1 starts
      // ↓
      // Java runs (10s)
      // ↓
      // new Promise((resolve) => ...)
      // ↓
      // setImmediate(resolve) schedules resolve for the next event loop
      // ↓
      // await waits
      // ↓
      // Quickly let Node.js check its messages
      // Before you start the next big job, let me quickly check if there's anything waiting
      // ↓
      // resolve() runs
      // ↓
      // Fixture 1 finishes
      // ↓
      // Fixture 2 starts
      // ↓
      // Java runs (10s)
      await new Promise((resolve) => setImmediate(resolve));
    }, 20000);
  });

  // it intentionally creates bad XML
  it("rejects an invoice missing mandatory fields", async () => {
    const broken = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice
  xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
</ubl:Invoice>`;
    const xmlPath = join(workDir, "broken.xml");
    writeFileSync(xmlPath, broken);

    const results = runKosit([xmlPath], { jarPath: JAR_PATH, scenariosPath: SCENARIOS_PATH });

    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.issues.some((issue) => issue.severity === "error")).toBe(true);
    await new Promise((resolve) => setImmediate(resolve));
  }, 20000);
});
