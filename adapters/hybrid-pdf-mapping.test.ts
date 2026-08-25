import { describe, it, expect } from "vitest";

import {
  mapPartyToPdfFields,
  mapLineToPdfFields,
  mapVatSubtotalToPdfFields,
  mapAllowanceChargeToPdfFields,
  mapPaymentMeansToPdfFields,
  mapInvoiceToPdfFields,
} from "./hybrid-pdf-mapping.js";
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

describe("mapPartyToPdfFields", () => {
  it("flattens the nested address into top-level fields", () => {
    const fields = mapPartyToPdfFields(baseParty);
    expect(fields.addressLine1).toBe("Musterstraße 1");
    expect(fields.city).toBe("Berlin");
    expect(fields.postalCode).toBe("10115");
    expect(fields.countryCode).toBe("DE");
  });

  it("omits contact fields when contact is absent", () => {
    const fields = mapPartyToPdfFields(baseParty);
    expect(fields.contactEmail).toBeUndefined();
    expect(fields.contactPhone).toBeUndefined();
  });

  it("flattens contact email/telephone when present", () => {
    const fields = mapPartyToPdfFields({
      ...baseParty,
      contact: { telephone: "+49 30 1234567", email: "buchhaltung@test.example" },
    });
    expect(fields.contactEmail).toBe("buchhaltung@test.example");
    expect(fields.contactPhone).toBe("+49 30 1234567");
  });

  it("carries vatId and taxRegistrationId through unchanged", () => {
    const fields = mapPartyToPdfFields({
      ...baseParty,
      vatId: "DE123456789",
      taxRegistrationId: "12/345/67890",
    });
    expect(fields.vatId).toBe("DE123456789");
    expect(fields.taxRegistrationId).toBe("12/345/67890");
  });
});

describe("mapLineToPdfFields", () => {
  it("carries line fields through unchanged", () => {
    const fields = mapLineToPdfFields({
      id: "1",
      name: "TypeScript Consulting",
      description: "Software architecture consulting, June 2026",
      quantity: 8,
      unitCode: "HUR",
      unitPrice: 125.0,
      lineAmount: 1000.0,
      vatCategoryCode: "S",
      vatRate: 19,
    });
    expect(fields).toEqual({
      name: "TypeScript Consulting",
      description: "Software architecture consulting, June 2026",
      quantity: 8,
      unitCode: "HUR",
      unitPrice: 125.0,
      lineAmount: 1000.0,
      vatCategoryCode: "S",
      vatRate: 19,
    });
  });

  it("does not carry the line id or allowancesCharges through", () => {
    const fields = mapLineToPdfFields({
      id: "1",
      name: "Item",
      quantity: 1,
      unitCode: "C62",
      unitPrice: 10,
      lineAmount: 10,
      vatCategoryCode: "S",
      vatRate: 19,
    });
    expect(fields).not.toHaveProperty("id");
    expect(fields).not.toHaveProperty("allowancesCharges");
  });
});

describe("mapVatSubtotalToPdfFields", () => {
  it("carries the VAT breakdown fields through unchanged", () => {
    const fields = mapVatSubtotalToPdfFields({
      categoryCode: "S",
      rate: 19,
      taxableAmount: 1000,
      taxAmount: 190,
    });
    expect(fields).toEqual({ categoryCode: "S", rate: 19, taxableAmount: 1000, taxAmount: 190 });
  });
});

describe("mapAllowanceChargeToPdfFields", () => {
  it("carries amount/isCharge/reason through unchanged", () => {
    const fields = mapAllowanceChargeToPdfFields({
      amount: 50,
      isCharge: false,
      reason: "Treuerabatt",
    });
    expect(fields).toEqual({ amount: 50, isCharge: false, reason: "Treuerabatt" });
  });
});

describe("mapPaymentMeansToPdfFields", () => {
  it("carries iban/bic/accountName through unchanged, dropping the payment means code", () => {
    const fields = mapPaymentMeansToPdfFields({
      code: "58",
      iban: "DE89370400440532013000",
      accountName: "Test GmbH",
      bic: "COBADEFFXXX",
    });
    expect(fields).toEqual({
      iban: "DE89370400440532013000",
      accountName: "Test GmbH",
      bic: "COBADEFFXXX",
    });
  });
});

describe("mapInvoiceToPdfFields", () => {
  it("maps the domestic-simple fixture end to end", () => {
    const fields = mapInvoiceToPdfFields(domesticSimple as unknown as Invoice);
    expect(fields.invoiceId).toBe("RE-2026-0042");
    expect(fields.typeCode).toBe("380");
    expect(fields.issueDate).toBe("2026-06-09");
    expect(fields.dueDate).toBe("2026-07-09");
    expect(fields.currencyCode).toBe("EUR");
    expect(fields.seller.name).toBe("Max Mustermann GmbH");
    expect(fields.buyer.name).toBe("Acme GmbH");
    expect(fields.lines).toHaveLength(1);
    expect(fields.lines[0]?.name).toBe("TypeScript Consulting");
    expect(fields.vatSubtotals).toHaveLength(1);
    expect(fields.vatSubtotals[0]?.rate).toBe(19);
    expect(fields.taxExclusiveAmount).toBe(1000.0);
    expect(fields.taxAmount).toBe(190.0);
    expect(fields.taxInclusiveAmount).toBe(1190.0);
    expect(fields.duePayableAmount).toBe(1190.0);
    expect(fields.paymentMeans).toEqual({
      iban: "DE89370400440532013000",
      accountName: "Max Mustermann GmbH",
      bic: "COBADEFFXXX",
    });
  });

  it("defaults allowancesCharges to an empty array when absent", () => {
    const fields = mapInvoiceToPdfFields(domesticSimple as unknown as Invoice);
    expect(fields.allowancesCharges).toEqual([]);
  });

  it("leaves paymentMeans undefined when the invoice has none", () => {
    // Take paymentMeans out with renaming _paymentMeans
    const { paymentMeans: _paymentMeans, ...rest } = domesticSimple as unknown as Invoice;
    expect(mapInvoiceToPdfFields(rest as Invoice).paymentMeans).toBeUndefined();
  });
});
