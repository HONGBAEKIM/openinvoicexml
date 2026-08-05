// Loads the AJV validator class. AJV is the engine that reads a JSON Schema and checks
// whether a data object follows its rules.
import { Ajv } from "ajv";

// Loads the three Json files as plain Javascript objects at import time.
// with { type: "json" } tells Node.js and TypeScript "this is JSON data, not executable code".
// After this, schema, simpleFixture, and multiLineFixture are just plain objects in memory.
import schema from "../../schemas/invoice.schema.json" with { type: "json" };
import simpleFixture from "../../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import multiLineFixture from "../../fixtures/02.domestic-multi-line.invoice.json" with { type: "json" };
// describe() → groups related tests together.
// it() → runs one test.
// expect() → checks if the result is correct.
// afterAll() → runs once after all tests are finished to clean up.
import { describe, it, expect, beforeAll } from "vitest";
import type { ValidateFunction } from "ajv";

// Use require() because ajv-formats is a CommonJS package
import { createRequire } from "module";

// Create a local require() function
const require = createRequire(import.meta.url);

// Load format validators (date, email, uri, uuid, etc.)
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const addFormats: (ajv: InstanceType<typeof Ajv>) => void = require("ajv-formats");

// Shared shape for both fixtures, used so generic mutation tests can run against either one.
type Invoice = typeof simpleFixture;

const fixtures: [string, Invoice][] = [
  ["domestic-simple", simpleFixture],
  ["domestic-multi-line", multiLineFixture],
];

/**
 * What's tested here (schemas/invoice.schema.json, via AJV):
 *
 * | Describe block                    | Fixture(s)                           | Checks                                                                                        |
 * |------------------------------------|----------------------------------------|--------------------------------------------------------------------------------------------------|
 * | valid fixtures                     | domestic-simple, domestic-multi-line   | both fixtures pass schema validation as-is                                                       |
 * | required field enforcement         | both (via describe.each)               | id/issueDate/seller/buyer required; lines/vatBreakdowns can't be empty                            |
 * | type and format enforcement        | both                                   | typeCode, issueDate format, currencyCode case, vatRate range, countryCode length, vatCategoryCode |
 * | additionalProperties enforcement   | both                                   | unknown top-level and line-item fields rejected (additionalProperties: false)                    |
 * | delivery (BG-13/BG-15)             | both                                   | nested deliverTo shape required; old flat delivery fields rejected; countryCode mandatory         |
 * | multi-line specific checks         | domestic-multi-line only               | schema violations on non-first lines (index 1, 2) are caught too, not just line 0                 |
 */
describe("Invoice JSON Schema", () => {
  let validate: ValidateFunction;

  beforeAll(() => {
    // creates the validator. do not stop at the first error, collect all of them
    const ajv = new Ajv({ allErrors: true });
    // registers format checkers (date, email, uri, etc.) into the AJV instance.
    addFormats(ajv);
    // reads the entire invoice.schema.json and compiles it
    // into a reusable validate function.
    // Compiling is slow; running the compiled function is fast.
    // That's why this is done once in beforeAll, and the same validate function is
    // reused by all tests.
    validate = ajv.compile(schema as object);
  });

  describe("valid fixtures", () => {
    it("accepts 01.domestic-simple.invoice.json", () => {
      const valid = validate(simpleFixture);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });

    it("accepts 02.domestic-multi-line.invoice.json", () => {
      const valid = validate(multiLineFixture);
      expect(validate.errors).toBeNull();
      expect(valid).toBe(true);
    });
  });

  describe.each(fixtures)("required field enforcement (%s)", (_label, fixture) => {
    it("rejects an invoice missing 'id'", () => {
      // ex)
      // const _id = Fixture.id

      // const noId = {
      //   issueDate: Fixture.issueDate,
      //   seller: Fixture.seller,
      //   ...all other properties except id
      // };
      const { id: _id, ...noId } = fixture;
      // Validate the invoice without an id.
      expect(validate(noId)).toBe(false);
      // validate.errors = [
      //   {
      //     keyword: "required",
      //     params: {
      //       missingProperty: "id",
      //     },
      //   },
      // ];
      expect(validate.errors?.some((e) => e.params?.missingProperty === "id")).toBe(true);
    });

    it("rejects an invoice missing 'issueDate'", () => {
      const { issueDate: _d, ...noDate } = fixture;
      expect(validate(noDate)).toBe(false);
      expect(validate.errors?.some((e) => e.params?.missingProperty === "issueDate")).toBe(true);
    });

    it("rejects an invoice missing 'seller'", () => {
      const { seller: _s, ...noSeller } = fixture;
      expect(validate(noSeller)).toBe(false);
      expect(validate.errors?.some((e) => e.params?.missingProperty === "seller")).toBe(true);
    });

    it("rejects an invoice missing 'buyer'", () => {
      const { buyer: _b, ...noBuyer } = fixture;
      expect(validate(noBuyer)).toBe(false);
      expect(validate.errors?.some((e) => e.params?.missingProperty === "buyer")).toBe(true);
    });

    it("rejects an invoice with an empty 'lines' array", () => {
      const bad = {
        ...fixture,
        lines: [],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects an invoice with an empty 'vatBreakdowns' array", () => {
      const bad = {
        ...fixture,
        vatBreakdowns: [],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("type and format enforcement (%s)", (_label, fixture) => {
    it("rejects an invalid typeCode", () => {
      const bad = {
        ...fixture,
        typeCode: "999",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a non-date issueDate (DD/MM/YYYY format)", () => {
      const bad = {
        ...fixture,
        issueDate: "09/06/2026",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a lowercase currencyCode", () => {
      const bad = {
        ...fixture,
        currencyCode: "eur",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a vatRate above 100", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, vatRate: 101 }],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a countryCode longer than 2 characters", () => {
      const bad = {
        ...fixture,
        seller: {
          ...fixture.seller,
          address: { ...fixture.seller.address, countryCode: "DEU" },
        },
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects an unknown vatCategoryCode", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, vatCategoryCode: "X" }],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("additionalProperties enforcement (%s)", (_label, fixture) => {
    it("rejects an invoice with an unrecognised top-level field", () => {
      const bad = {
        ...fixture,
        unknownField: "surprise",
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a line item with an unrecognised field", () => {
      const bad = {
        ...fixture,
        lines: [{ ...fixture.lines[0]!, discount: 10 }],
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe.each(fixtures)("delivery (BG-13/BG-15) (%s)", (_label, fixture) => {
    it("accepts a delivery.deliverTo address with a country code", () => {
      const good = {
        ...fixture,
        delivery: {
          actualDeliveryDate: "2026-07-20",
          deliverTo: { city: "Paris", postalCode: "75001", countryCode: "FR" },
        },
      };
      expect(validate(good)).toBe(true);
    });

    it("rejects the old flat delivery fields", () => {
      const bad = {
        ...fixture,
        delivery: { city: "Paris", postalCode: "75001", countryCode: "FR" },
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects a deliverTo address missing countryCode", () => {
      const bad = {
        ...fixture,
        delivery: { deliverTo: { city: "Paris" } },
      };
      expect(validate(bad)).toBe(false);
    });
  });

  describe("multi-line specific checks", () => {
    it("rejects when a non-first line has an unrecognised field", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          { ...multiLineFixture.lines[1]!, discount: 10 },
          multiLineFixture.lines[2]!,
        ],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects when a non-first line has a vatRate above 100", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          { ...multiLineFixture.lines[1]!, vatRate: 101 },
          multiLineFixture.lines[2]!,
        ],
      };
      expect(validate(bad)).toBe(false);
    });

    it("rejects when a non-first line has an unknown vatCategoryCode", () => {
      const bad = {
        ...multiLineFixture,
        lines: [
          multiLineFixture.lines[0]!,
          multiLineFixture.lines[1]!,
          { ...multiLineFixture.lines[2]!, vatCategoryCode: "X" },
        ],
      };
      expect(validate(bad)).toBe(false);
    });
  });
});
