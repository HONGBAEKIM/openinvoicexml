import { describe, it, expect } from "vitest";

import { toCii } from "./cii.js";
import type { Invoice } from "../core/index.js";

import domesticSimple from "../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import intraEuSupply from "../fixtures/08.intra-eu-supply.invoice.json" with { type: "json" };
import creditNoteFull from "../fixtures/16.credit-note-full.invoice.json" with { type: "json" };
// CII now proves them separately and together with 22, 23, 24 test.
import documentLevelDiscount from "../fixtures/22.document-level-discount.invoice.json" with { type: "json" };
import lineLevelDiscount from "../fixtures/23.line-level-discount.invoice.json" with { type: "json" };
import combinedLineAndDocumentDiscount from "../fixtures/24.combined-line-and-document-discount.invoice.json" with { type: "json" };

import { allFixtures } from "../fixtures/index.js";

describe("toCii", () => {
  describe.each(allFixtures)("basic check: %s", (_label, rawFixture) => {
    it("produces valid CII XML structure", () => {
      const invoice = rawFixture as Invoice;
      const xml = toCii(invoice);

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(xml).toContain("<rsm:CrossIndustryInvoice");
      expect(xml).toContain(
        'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
      );
      expect(xml).toContain(
        'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
      );
      expect(xml).toContain(`<ram:ID>${invoice.id}</ram:ID>`);
      expect(xml).toContain(invoice.seller.name);
      expect(xml).toContain(invoice.buyer.name);
      expect(xml).toContain("</rsm:CrossIndustryInvoice>");
    });
  });

  describe("profile-aware GuidelineSpecifiedDocumentContextParameter", () => {
    it("defaults to the plain EN16931 CII guideline URN", () => {
      const xml = toCii(domesticSimple as Invoice);
      expect(xml).toContain(
        "<ram:GuidelineSpecifiedDocumentContextParameter>\n      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>",
      );
    });

    it("uses the plain EN16931 CII guideline URN for profile: EN16931", () => {
      const xml = toCii(domesticSimple as Invoice, { profile: "EN16931" });
      expect(xml).toContain("<ram:ID>urn:cen.eu:en16931:2017</ram:ID>");
      expect(xml).not.toContain("xrechnung_3.0");
    });

    it("uses the XRechnung-compliant guideline URN for profile: XRECHNUNG", () => {
      const xml = toCii(domesticSimple as Invoice, { profile: "XRECHNUNG" });
      expect(xml).toContain(
        "<ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID>",
      );
    });
  });

  describe("field-specific mapping (domestic-simple)", () => {
    const xml = toCii(domesticSimple as unknown as Invoice);

    it("includes ExchangedDocument/TypeCode and IssueDateTime (format 102)", () => {
      expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
      expect(xml).toContain(
        '<ram:IssueDateTime>\n      <udt:DateTimeString format="102">20260609</udt:DateTimeString>',
      );
    });

    it("includes BuyerReference", () => {
      expect(xml).toContain("<ram:BuyerReference>04011000-12345-03</ram:BuyerReference>");
    });

    it("includes payment IBAN and PaymentMeansCode", () => {
      expect(xml).toContain("<ram:TypeCode>58</ram:TypeCode>");
      expect(xml).toContain("<ram:IBANID>DE89370400440532013000</ram:IBANID>");
    });

    it("includes VAT category S and rate 19 in the header VAT breakdown", () => {
      const start = xml.indexOf("<ram:ApplicableTradeTax>");
      const end = xml.indexOf("</ram:ApplicableTradeTax>") + "</ram:ApplicableTradeTax>".length;
      const subtotal = xml.slice(start, end);
      expect(subtotal).toContain("<ram:CategoryCode>S</ram:CategoryCode>");
      expect(subtotal).toContain("<ram:RateApplicablePercent>19</ram:RateApplicablePercent>");
    });

    it("includes billed quantity with unit code", () => {
      expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">8</ram:BilledQuantity>');
    });

    it("includes seller contact (BG-6)", () => {
      const invoice = domesticSimple as unknown as Invoice;
      expect(xml).toContain(
        `<ram:CompleteNumber>${invoice.seller.contact!.telephone}</ram:CompleteNumber>`,
      );
      expect(xml).toContain(`<ram:URIID>${invoice.seller.contact!.email}</ram:URIID>`);
    });

    it("emits an empty self-closing ApplicableHeaderTradeDelivery when there is no delivery info", () => {
      expect(xml).toContain("<ram:ApplicableHeaderTradeDelivery/>");
    });
  });

  describe("ram:ContractReferencedDocument (BT-12)", () => {
    it("skips ram:ContractReferencedDocument when contractReference is absent", () => {
      const xml = toCii(domesticSimple as unknown as Invoice);
      expect(xml).not.toContain("<ram:ContractReferencedDocument>");
    });

    it("renders ram:ContractReferencedDocument/ram:IssuerAssignedID when contractReference is present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        contractReference: "CONTRACT-2025-001",
      };
      const xml = toCii(invoice);
      const start = xml.indexOf("<ram:ContractReferencedDocument>");
      const end =
        xml.indexOf("</ram:ContractReferencedDocument>") + "</ram:ContractReferencedDocument>".length;
      const contractReferencedDocument = xml.slice(start, end);

      expect(contractReferencedDocument).toBe(
        "<ram:ContractReferencedDocument>\n      <ram:IssuerAssignedID>CONTRACT-2025-001</ram:IssuerAssignedID>\n    </ram:ContractReferencedDocument>",
      );
    });

    it("escapes special characters in the contract reference", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        contractReference: "CONTRACT&2025<001",
      };
      const xml = toCii(invoice);
      expect(xml).toContain("<ram:IssuerAssignedID>CONTRACT&amp;2025&lt;001</ram:IssuerAssignedID>");
    });
  });

  describe("ram:BuyerOrderReferencedDocument (BT-13)", () => {
    it("skips ram:BuyerOrderReferencedDocument when purchaseOrderReference is absent", () => {
      const xml = toCii(domesticSimple as unknown as Invoice);
      expect(xml).not.toContain("<ram:BuyerOrderReferencedDocument>");
    });

    it("renders ram:BuyerOrderReferencedDocument/ram:IssuerAssignedID when purchaseOrderReference is present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        purchaseOrderReference: "PO-2025-001",
      };
      const xml = toCii(invoice);
      const start = xml.indexOf("<ram:BuyerOrderReferencedDocument>");
      const end =
        xml.indexOf("</ram:BuyerOrderReferencedDocument>") + "</ram:BuyerOrderReferencedDocument>".length;
      const orderReferencedDocument = xml.slice(start, end);

      expect(orderReferencedDocument).toBe(
        "<ram:BuyerOrderReferencedDocument>\n      <ram:IssuerAssignedID>PO-2025-001</ram:IssuerAssignedID>\n    </ram:BuyerOrderReferencedDocument>",
      );
    });

    it("escapes special characters in the purchase order reference", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        purchaseOrderReference: "PO&2025<001",
      };
      const xml = toCii(invoice);
      expect(xml).toContain("<ram:IssuerAssignedID>PO&amp;2025&lt;001</ram:IssuerAssignedID>");
    });

    it("places ram:BuyerOrderReferencedDocument before ram:ContractReferencedDocument (fixed CII element sequence)", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        purchaseOrderReference: "PO-2025-001",
        contractReference: "CONTRACT-2025-001",
      };
      const xml = toCii(invoice);

      expect(xml.indexOf("<ram:BuyerOrderReferencedDocument>")).toBeLessThan(
        xml.indexOf("<ram:ContractReferencedDocument>"),
      );
    });
  });

  describe("currencyID placement (CII-DT-031)", () => {
    // Confirmed against a real KoSIT rejection during development: currencyID must not be
    // present on any amount except the header ram:TaxTotalAmount (BT-110) — currency is already
    // established once via ram:InvoiceCurrencyCode, unlike UBL's per-amount currencyID.
    it("carries currencyID only on the header TaxTotalAmount, nowhere else", () => {
      const xml = toCii(domesticSimple as Invoice);
      const withCurrencyId = [...xml.matchAll(/<ram:(\w+)[^>]*currencyID/g)].map((m) => m[1]);
      expect(withCurrencyId).toEqual(["TaxTotalAmount"]);
    });
  });

  describe("SpecifiedLegalOrganization (CII-SR-224/252)", () => {
    it("omits SpecifiedLegalOrganization entirely when the party has no legalId", () => {
      const xml = toCii(domesticSimple as Invoice);
      expect(xml).not.toContain("<ram:SpecifiedLegalOrganization>");
    });

    it("emits only ram:ID (no redundant ram:Name) when legalId is present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        seller: { ...(domesticSimple as unknown as Invoice).seller, legalId: "HRB 12345" },
      };
      const xml = toCii(invoice);
      const start = xml.indexOf("<ram:SpecifiedLegalOrganization>");
      const end =
        xml.indexOf("</ram:SpecifiedLegalOrganization>") + "</ram:SpecifiedLegalOrganization>".length;
      const legalOrg = xml.slice(start, end);
      expect(legalOrg).toBe(
        "<ram:SpecifiedLegalOrganization>\n        <ram:ID>HRB 12345</ram:ID>\n      </ram:SpecifiedLegalOrganization>",
      );
    });
  });

  describe("delivery (intra-eu-supply)", () => {
    it("renders ShipToTradeParty and ActualDeliverySupplyChainEvent", () => {
      const xml = toCii(intraEuSupply as unknown as Invoice);

      const shipToStart = xml.indexOf("<ram:ShipToTradeParty>");
      const shipToEnd = xml.indexOf("</ram:ShipToTradeParty>") + "</ram:ShipToTradeParty>".length;
      const shipTo = xml.slice(shipToStart, shipToEnd);
      expect(shipTo).toContain("<ram:CityName>Paris</ram:CityName>");
      expect(shipTo).toContain("<ram:PostcodeCode>75001</ram:PostcodeCode>");
      expect(shipTo).toContain("<ram:CountryID>FR</ram:CountryID>");

      expect(xml).toContain(
        '<ram:ActualDeliverySupplyChainEvent>\n      <ram:OccurrenceDateTime>\n        <udt:DateTimeString format="102">20260714</udt:DateTimeString>',
      );
    });
  });

  describe("credit note (typeCode 381)", () => {
    const xml = toCii(creditNoteFull as unknown as Invoice);

    it("uses the same rsm:CrossIndustryInvoice root as an ordinary invoice — unlike UBL, there is no separate root/namespace for credit notes", () => {
      expect(xml).toContain("<rsm:CrossIndustryInvoice");
      expect(xml).toContain("<ram:TypeCode>381</ram:TypeCode>");
    });

    it("renders InvoiceReferencedDocument for the preceding invoice (BT-25/26)", () => {
      const start = xml.indexOf("<ram:InvoiceReferencedDocument>");
      const end =
        xml.indexOf("</ram:InvoiceReferencedDocument>") + "</ram:InvoiceReferencedDocument>".length;
      const ref = xml.slice(start, end);
      expect(ref).toContain("<ram:IssuerAssignedID>RE-2026-0042</ram:IssuerAssignedID>");
      expect(ref).toContain(
        '<qdt:DateTimeString format="102">20260609</qdt:DateTimeString>',
      );
    });

    it("carries the negative quantity/amount straight through, same as any other line", () => {
      expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">-8</ram:BilledQuantity>');
      expect(xml).toContain("<ram:LineTotalAmount>-1000.00</ram:LineTotalAmount>");
    });
  });

  describe("VAT category 'O' (outside the scope of VAT)", () => {
    it("omits the line-level RateApplicablePercent element (BR-O-05)", () => {
      const invoice = { ...(domesticSimple as unknown as Invoice) };
      invoice.lines = [{ ...invoice.lines[0]!, vatCategoryCode: "O", vatRate: 0 }];
      const xml = toCii(invoice);
      const start = xml.indexOf("<ram:SpecifiedLineTradeSettlement>");
      const end =
        xml.indexOf("</ram:SpecifiedLineTradeSettlement>") + "</ram:SpecifiedLineTradeSettlement>".length;
      const settlement = xml.slice(start, end);

      expect(settlement).toContain("<ram:CategoryCode>O</ram:CategoryCode>");
      expect(settlement).not.toContain("<ram:RateApplicablePercent>");
    });
  });

  describe("document-level allowance/charge (BG-20/BG-21)", () => {
    it("renders SpecifiedTradeAllowanceCharge with ChargeIndicator/ActualAmount/CategoryTradeTax", () => {
      const xml = toCii(documentLevelDiscount as unknown as Invoice);
      const start = xml.indexOf("<ram:SpecifiedTradeAllowanceCharge>");
      const end =
        xml.indexOf("</ram:SpecifiedTradeAllowanceCharge>") +
        "</ram:SpecifiedTradeAllowanceCharge>".length;
      const allowanceCharge = xml.slice(start, end);

      expect(allowanceCharge).toContain("<udt:Indicator>false</udt:Indicator>");
      expect(allowanceCharge).toContain("<ram:CategoryTradeTax>");
      expect(allowanceCharge).toContain("<ram:CategoryCode>S</ram:CategoryCode>");
    });
  });

  describe("line-level allowance/charge (BG-27/BG-28)", () => {
    it("renders SpecifiedTradeAllowanceCharge inside SpecifiedLineTradeSettlement with no CategoryTradeTax", () => {
      const xml = toCii(lineLevelDiscount as unknown as Invoice);
      const lineStart = xml.indexOf("<ram:SpecifiedLineTradeSettlement>");
      const lineEnd =
        xml.indexOf("</ram:SpecifiedLineTradeSettlement>") + "</ram:SpecifiedLineTradeSettlement>".length;
      const lineSettlement = xml.slice(lineStart, lineEnd);

      const acStart = lineSettlement.indexOf("<ram:SpecifiedTradeAllowanceCharge>");
      const acEnd =
        lineSettlement.indexOf("</ram:SpecifiedTradeAllowanceCharge>") +
        "</ram:SpecifiedTradeAllowanceCharge>".length;
      const allowanceCharge = lineSettlement.slice(acStart, acEnd);

      expect(allowanceCharge).toContain("<udt:Indicator>false</udt:Indicator>");
      expect(allowanceCharge).toContain("<ram:ActualAmount>100.00</ram:ActualAmount>");
      expect(allowanceCharge).toContain("<ram:Reason>Treuerabatt</ram:Reason>");
      expect(allowanceCharge).not.toContain("<ram:CategoryTradeTax>");
    });
  });

  describe("combined document-level and line-level allowances", () => {
    it("renders both a line-level and a document-level ram:SpecifiedTradeAllowanceCharge without double-counting", () => {
      const xml = toCii(combinedLineAndDocumentDiscount as unknown as Invoice);
      const allowanceCharges = [
        ...xml.matchAll(/<ram:SpecifiedTradeAllowanceCharge>[\s\S]*?<\/ram:SpecifiedTradeAllowanceCharge>/g),
      ].map((m) => m[0]);

      expect(allowanceCharges).toHaveLength(2);

      const lineAllowanceCharge = allowanceCharges.find((ac) => !ac.includes("<ram:CategoryTradeTax>"));
      expect(lineAllowanceCharge).toContain("<udt:Indicator>false</udt:Indicator>");
      expect(lineAllowanceCharge).toContain("<ram:ActualAmount>100.00</ram:ActualAmount>");
      expect(lineAllowanceCharge).toContain("<ram:Reason>Treuerabatt</ram:Reason>");

      const documentAllowanceCharge = allowanceCharges.find((ac) => ac.includes("<ram:CategoryTradeTax>"));
      expect(documentAllowanceCharge).toContain("<udt:Indicator>false</udt:Indicator>");
      expect(documentAllowanceCharge).toContain("<ram:ActualAmount>50.00</ram:ActualAmount>");
      expect(documentAllowanceCharge).toContain("<ram:Reason>Sammelrabatt</ram:Reason>");
      expect(documentAllowanceCharge).toContain("<ram:CategoryCode>S</ram:CategoryCode>");

      // €1000 line − €100 line allowance − €50 document allowance = €850 taxable, +19% VAT = €1011.50 —
      // proving the two allowance levels compose additively, same as the UBL adapter's equivalent.
      const start = xml.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
      const end =
        xml.indexOf("</ram:SpecifiedTradeSettlementHeaderMonetarySummation>") +
        "</ram:SpecifiedTradeSettlementHeaderMonetarySummation>".length;
      const monetarySummation = xml.slice(start, end);
      expect(monetarySummation).toContain("<ram:TaxBasisTotalAmount>850.00</ram:TaxBasisTotalAmount>");
      expect(monetarySummation).toContain("<ram:GrandTotalAmount>1011.50</ram:GrandTotalAmount>");
    });
  });

  describe("XML escaping", () => {
    it("escapes & and < in string fields", () => {
      const base = domesticSimple as unknown as Invoice;
      const invoice: Invoice = {
        ...base,
        seller: {
          ...base.seller,
          name: "A&B <GmbH>",
        },
      };
      const xml = toCii(invoice);
      expect(xml).toContain("A&amp;B");
      expect(xml).toContain("&lt;GmbH&gt;");
      expect(xml).not.toContain("A&B <");
    });
  });
});
