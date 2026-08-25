import { describe, it, expect } from "vitest";
import { formatDateDE, formatAmountDE } from "./format-de.js";

describe("formatDateDE", () => {
  it("converts YYYY-MM-DD to DD.MM.YYYY", () => {
    expect(formatDateDE("2026-06-09")).toBe("09.06.2026");
  });

  it("does not shift the day across a year boundary", () => {
    expect(formatDateDE("2026-01-01")).toBe("01.01.2026");
    expect(formatDateDE("2026-12-31")).toBe("31.12.2026");
  });
});

// German currency formatting uses a no-break space before the currency symbol.
// It looks like a normal space, but keeps the amount and € together.
// symbol with U+00A0 (NO-BREAK SPACE)
// const NBSP = "\u00A0";
const NBSP = " ";

describe("formatAmountDE", () => {
  it("formats a EUR amount with German decimal/thousands separators", () => {
    expect(formatAmountDE(1190, "EUR")).toBe(`1.190,00${NBSP}€`);
  });

  it("formats a zero amount", () => {
    expect(formatAmountDE(0, "EUR")).toBe(`0,00${NBSP}€`);
  });

  it("formats a negative amount", () => {
    expect(formatAmountDE(-190, "EUR")).toBe(`-190,00${NBSP}€`);
  });

  it("rounds to two decimal places", () => {
    expect(formatAmountDE(1000.005, "EUR")).toBe(`1.000,01${NBSP}€`);
  });
});
