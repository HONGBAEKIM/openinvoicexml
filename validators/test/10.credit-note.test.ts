import { describe, it, expect } from "vitest";

import { checkCreditNoteAndCorrectionRequirements } from "../rules/10.credit-note.js";
import type { ValidationIssue } from "../types.js";

const reference = { id: "RE-2026-0042", issueDate: "2026-06-09" };

/**
 * What's tested here (credit notes `381` and corrective invoices `384`):
 *
 * | typeCode | duePayableAmount | precedingInvoiceReference | Expected result                    |
 * |----------|-------------------|----------------------------|-------------------------------------|
 * | 381      | positive          | present                    | CREDIT_NOTE_POSITIVE_AMOUNT         |
 * | 381      | zero              | present                    | no issue                            |
 * | 381      | negative          | present                    | no issue                            |
 * | 381      | negative          | absent                     | PRECEDING_INVOICE_REFERENCE_REQUIRED|
 * | 384      | positive          | absent                     | PRECEDING_INVOICE_REFERENCE_REQUIRED (not CREDIT_NOTE_POSITIVE_AMOUNT) |
 * | 384      | positive          | present                    | no issue                            |
 * | 380      | positive          | absent                     | no issue — checks don't apply       |
 */
describe("checkCreditNoteAndCorrectionRequirements", () => {
  it("flags a credit note with a positive duePayableAmount", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("381", 1190, reference, issues);
    expect(issues.some((i) => i.code === "CREDIT_NOTE_POSITIVE_AMOUNT")).toBe(true);
  });

  it("accepts a credit note with a zero duePayableAmount", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("381", 0, reference, issues);
    expect(issues.some((i) => i.code === "CREDIT_NOTE_POSITIVE_AMOUNT")).toBe(false);
  });

  it("accepts a credit note with a negative duePayableAmount", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("381", -1190, reference, issues);
    expect(issues.some((i) => i.code === "CREDIT_NOTE_POSITIVE_AMOUNT")).toBe(false);
  });

  it("flags a credit note with no precedingInvoiceReference", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("381", -1190, undefined, issues);
    expect(issues.some((i) => i.code === "PRECEDING_INVOICE_REFERENCE_REQUIRED")).toBe(true);
  });

  it("flags a corrective invoice with no precedingInvoiceReference", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("384", 1190, undefined, issues);
    expect(issues.some((i) => i.code === "PRECEDING_INVOICE_REFERENCE_REQUIRED")).toBe(true);
  });

  it("does not apply the positive-amount check to a corrective invoice", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("384", 1190, undefined, issues);
    expect(issues.some((i) => i.code === "CREDIT_NOTE_POSITIVE_AMOUNT")).toBe(false);
  });

  it("accepts a corrective invoice with a positive duePayableAmount when a reference is present", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("384", 1190, reference, issues);
    expect(issues).toEqual([]);
  });

  it("does not apply either check to a plain invoice (380)", () => {
    const issues: ValidationIssue[] = [];
    checkCreditNoteAndCorrectionRequirements("380", 1190, undefined, issues);
    expect(issues).toEqual([]);
  });
});
