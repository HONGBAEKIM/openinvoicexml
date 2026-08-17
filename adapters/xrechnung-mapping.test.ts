import { describe, it, expect } from "vitest";

import {
  mapParty,
  mapPaymentMeans,
  mapVatSubtotal,
  mapLine,
  mapInvoice,
  mapPrecedingInvoiceReference,
} from "./xrechnung-mapping.js";
import type { Invoice, Party } from "../core/index.js";

import domesticSimple from "../fixtures/01.domestic-simple.invoice.json" with { type: "json" };

const baseParty: Party = {
  name: "Test GmbH",
  address: {
    line1: "Musterstraße 1",
    city: "Berlin",
    postalCode: "10115",
    countryCode: "DE",
  },
  electronicAddress: "billing@test.example",
};

describe("mapParty", () => {
  it("defaults schemeId to 'EM' when electronicAddressSchemeId is absent", () => {
    expect(mapParty(baseParty).schemeId).toBe("EM");
  });

  it("preserves an explicit electronicAddressSchemeId", () => {
    const fields = mapParty({ ...baseParty, electronicAddressSchemeId: "0204" });
    expect(fields.schemeId).toBe("0204");
  });

  it("flattens the nested address into top-level fields", () => {
    const fields = mapParty(baseParty);
    expect(fields.addressLine1).toBe("Musterstraße 1");
    expect(fields.city).toBe("Berlin");
    expect(fields.postalCode).toBe("10115");
    expect(fields.countryCode).toBe("DE");
  });
});

describe("mapPaymentMeans", () => {
  it("carries iban/accountName/bic through unchanged", () => {
    const fields = mapPaymentMeans({
      code: "58",
      iban: "DE89370400440532013000",
      accountName: "Test GmbH",
      bic: "COBADEFFXXX",
    });
    expect(fields).toEqual({
      code: "58",
      iban: "DE89370400440532013000",
      accountName: "Test GmbH",
      bic: "COBADEFFXXX",
    });
  });
});

describe("mapVatSubtotal", () => {
  it("passes VAT breakdown fields through unchanged", () => {
    const fields = mapVatSubtotal({
      categoryCode: "S",
      rate: 19,
      taxableAmount: 1000,
      taxAmount: 190,
    });
    expect(fields.categoryCode).toBe("S");
    expect(fields.rate).toBe(19);
    expect(fields.taxableAmount).toBe(1000);
    expect(fields.taxAmount).toBe(190);
  });
});

describe("mapLine", () => {
  it("passes line fields through unchanged", () => {
    const fields = mapLine({
      id: "1",
      name: "Consulting",
      quantity: 8,
      unitCode: "HUR",
      unitPrice: 125,
      lineAmount: 1000,
      vatCategoryCode: "S",
      vatRate: 19,
    });
    expect(fields.id).toBe("1");
    expect(fields.lineAmount).toBe(1000);
  });
});

describe("mapPrecedingInvoiceReference", () => {
  it("carries id/issueDate through unchanged", () => {
    const fields = mapPrecedingInvoiceReference({ id: "INV-100", issueDate: "2026-01-15" });
    expect(fields).toEqual({ id: "INV-100", issueDate: "2026-01-15" });
  });
});

describe("mapInvoice", () => {
  it("derives lineExtensionAmount as the sum of all line amounts", () => {
    const invoice = domesticSimple as unknown as Invoice;
    const fields = mapInvoice(invoice);
    // starting value of sum is 0
    const expectedSum = invoice.lines.reduce((sum, line) => sum + line.lineAmount, 0);
    expect(fields.lineExtensionAmount).toBe(expectedSum);
  });

  it("maps paymentMeans to undefined when absent from the invoice", () => {
    const invoice = domesticSimple as unknown as Invoice;
    // first only get _paymentMeans
    // second get without paymentMeans
    const { paymentMeans: _paymentMeans, ...withoutPaymentMeans } = invoice;
    expect(mapInvoice(withoutPaymentMeans as Invoice).paymentMeans).toBeUndefined();
  });

  it("maps seller and buyer independently via mapParty", () => {
    const invoice = domesticSimple as unknown as Invoice;
    const fields = mapInvoice(invoice);
    expect(fields.seller.name).toBe(invoice.seller.name);
    expect(fields.buyer.name).toBe(invoice.buyer.name);
  });

  it("maps precedingInvoiceReference to undefined when absent from the invoice", () => {
    const invoice = domesticSimple as unknown as Invoice;
    expect(mapInvoice(invoice).precedingInvoiceReference).toBeUndefined();
  });

  it("maps precedingInvoiceReference when present", () => {
    const invoice: Invoice = {
      ...(domesticSimple as unknown as Invoice),
      precedingInvoiceReference: { id: "INV-2025-001", issueDate: "2025-12-01" },
    };
    expect(mapInvoice(invoice).precedingInvoiceReference).toEqual({
      id: "INV-2025-001",
      issueDate: "2025-12-01",
    });
  });

  it("maps contractReference to undefined when absent from the invoice", () => {
    const invoice = domesticSimple as unknown as Invoice;
    expect(mapInvoice(invoice).contractReference).toBeUndefined();
  });

  it("maps contractReference when present", () => {
    const invoice: Invoice = {
      ...(domesticSimple as unknown as Invoice),
      contractReference: "CONTRACT-2025-001",
    };
    expect(mapInvoice(invoice).contractReference).toBe("CONTRACT-2025-001");
  });

  it("maps purchaseOrderReference to undefined when absent from the invoice", () => {
    const invoice = domesticSimple as unknown as Invoice;
    expect(mapInvoice(invoice).purchaseOrderReference).toBeUndefined();
  });

  it("maps purchaseOrderReference when present", () => {
    const invoice: Invoice = {
      ...(domesticSimple as unknown as Invoice),
      purchaseOrderReference: "PO-2025-001",
    };
    expect(mapInvoice(invoice).purchaseOrderReference).toBe("PO-2025-001");
  });
});
