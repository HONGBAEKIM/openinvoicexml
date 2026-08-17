import { describe, it, expect } from "vitest";

import { toXRechnung } from "./xrechnung.js";
import type { Invoice } from "../core/index.js";

import domesticSimple from "../fixtures/01.domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "../fixtures/02.domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "../fixtures/03.reduced-rate.invoice.json" with { type: "json" };
import exempt from "../fixtures/04.exempt.invoice.json" with { type: "json" };
import zeroRated from "../fixtures/05.zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "../fixtures/06.reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "../fixtures/07.small-business.invoice.json" with { type: "json" };
import intraEuSupply from "../fixtures/08.intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "../fixtures/09.export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "../fixtures/10.reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "../fixtures/11.reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import creditNoteFull from "../fixtures/16.credit-note-full.invoice.json" with { type: "json" };

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
];

describe("toXRechnung", () => {
  describe.each(fixtures)("basic check: %s", (_label, rawFixture) => {
    it("produces valid XRechnung XML structure", () => {
      const invoice = rawFixture as Invoice;
      const xml = toXRechnung(invoice);

      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
      expect(xml).toContain("<ubl:Invoice");
      expect(xml).toContain('xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      expect(xml).toContain(
        'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
      );
      expect(xml).toContain(
        'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
      );
      expect(xml).toContain(`<cbc:ID>${invoice.id}</cbc:ID>`);
      expect(xml).toContain(`<cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>`);
      expect(xml).toContain(invoice.seller.name);
      expect(xml).toContain(invoice.buyer.name);
    });
  });

  describe("field-specific mapping (domestic-simple)", () => {
    const xml = toXRechnung(domesticSimple as unknown as Invoice);

    it("CustomizationID is the XRechnung 3.x string", () => {
      expect(xml).toContain(
        "<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>",
      );
    });

    it("includes BuyerReference", () => {
      expect(xml).toContain("<cbc:BuyerReference>04011000-12345-03</cbc:BuyerReference>");
    });

    it("includes payment IBAN", () => {
      expect(xml).toContain("<cbc:ID>DE89370400440532013000</cbc:ID>");
    });

    // Just test fist <cac:TaxSubtotal>, </cac:TaxSubtotal>
    it("includes VAT category S and percent 19 in TaxSubtotal", () => {
      const start = xml.indexOf("<cac:TaxSubtotal>");
      const end = xml.indexOf("</cac:TaxSubtotal>") + "</cac:TaxSubtotal>".length;
      const subtotal = xml.slice(start, end);
      expect(subtotal).toContain("<cbc:ID>S</cbc:ID>");
      expect(subtotal).toContain("<cbc:Percent>19</cbc:Percent>");
    });

    it("includes invoiced quantity with unit code", () => {
      expect(xml).toContain('<cbc:InvoicedQuantity unitCode="HUR">8</cbc:InvoicedQuantity>');
    });

    it("TaxExclusiveAmount is 1000.00", () => {
      expect(xml).toContain(
        '<cbc:TaxExclusiveAmount currencyID="EUR">1000.00</cbc:TaxExclusiveAmount>',
      );
    });

    it("PayableAmount is 1190.00", () => {
      expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">1190.00</cbc:PayableAmount>');
    });

    it("includes seller Contact (BG-6, required by BR-DE-2)", () => {
      const invoice = domesticSimple as unknown as Invoice;
      expect(xml).toContain(`<cbc:Telephone>${invoice.seller.contact!.telephone}</cbc:Telephone>`);
      expect(xml).toContain(
        `<cbc:ElectronicMail>${invoice.seller.contact!.email}</cbc:ElectronicMail>`,
      );
    });
  });

  describe("field-specific mapping (intra-eu-supply)", () => {
    const xml = toXRechnung(intraEuSupply as unknown as Invoice);

    it("renders the nested delivery.deliverTo address as a flat cac:DeliveryLocation", () => {
      const start = xml.indexOf("<cac:Delivery>");
      const end = xml.indexOf("</cac:Delivery>") + "</cac:Delivery>".length;
      const delivery = xml.slice(start, end);

      expect(delivery).toContain("<cbc:ActualDeliveryDate>2026-07-14</cbc:ActualDeliveryDate>");
      expect(delivery).toContain("<cbc:CityName>Paris</cbc:CityName>");
      expect(delivery).toContain("<cbc:PostalZone>75001</cbc:PostalZone>");
      expect(delivery).toContain("<cbc:IdentificationCode>FR</cbc:IdentificationCode>");
    });
  });

  describe("cac:BillingReference (BT-25/BT-26)", () => {
    it("omits cac:BillingReference when precedingInvoiceReference is absent", () => {
      const xml = toXRechnung(domesticSimple as unknown as Invoice);
      expect(xml).not.toContain("<cac:BillingReference>");
    });

    it("renders cac:BillingReference/cac:InvoiceDocumentReference with ID and IssueDate when present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        typeCode: "381",
        precedingInvoiceReference: { id: "INV-2025-001", issueDate: "2025-12-01" },
      };
      const xml = toXRechnung(invoice);
      const start = xml.indexOf("<cac:BillingReference>");
      const end = xml.indexOf("</cac:BillingReference>") + "</cac:BillingReference>".length;
      const billingReference = xml.slice(start, end);

      expect(billingReference).toContain("<cac:InvoiceDocumentReference>");
      expect(billingReference).toContain("<cbc:ID>INV-2025-001</cbc:ID>");
      expect(billingReference).toContain("<cbc:IssueDate>2025-12-01</cbc:IssueDate>");
    });

    it("places cac:BillingReference before cac:AccountingSupplierParty (UBL 2.1 element order)", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        precedingInvoiceReference: { id: "INV-2025-001", issueDate: "2025-12-01" },
      };
      const xml = toXRechnung(invoice);
      // checks order with indexOf
      expect(xml.indexOf("<cac:BillingReference>")).toBeLessThan(
        xml.indexOf("<cac:AccountingSupplierParty>"),
      );
    });

    it("escapes special characters in the preceding invoice ID but not the issue date", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        precedingInvoiceReference: { id: "INV&2025<001", issueDate: "2025-12-01" },
      };
      const xml = toXRechnung(invoice);
      // &  becomes  &amp;
      // <  becomes  &lt;
      expect(xml).toContain("<cbc:ID>INV&amp;2025&lt;001</cbc:ID>");
      expect(xml).toContain("<cbc:IssueDate>2025-12-01</cbc:IssueDate>");
    });
  });

  describe("cac:ContractDocumentReference (BT-12)", () => {
    it("skips cac:ContractDocumentReference when contractReference is absent", () => {
      const xml = toXRechnung(domesticSimple as unknown as Invoice);
      expect(xml).not.toContain("<cac:ContractDocumentReference>");
    });

    it("renders cac:ContractDocumentReference/cbc:ID when contractReference is present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        contractReference: "CONTRACT-2025-001",
      };
      const xml = toXRechnung(invoice);
      const start = xml.indexOf("<cac:ContractDocumentReference>");
      const end =
        xml.indexOf("</cac:ContractDocumentReference>") + "</cac:ContractDocumentReference>".length;
      const contractDocumentReference = xml.slice(start, end);

      expect(contractDocumentReference).toBe(
        "<cac:ContractDocumentReference>\n    <cbc:ID>CONTRACT-2025-001</cbc:ID>\n  </cac:ContractDocumentReference>",
      );
    });

    it("places cac:ContractDocumentReference after cac:BillingReference and before cac:AccountingSupplierParty (UBL 2.1 element order)", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        precedingInvoiceReference: { id: "INV-2025-001", issueDate: "2025-12-01" },
        contractReference: "CONTRACT-2025-001",
      };
      const xml = toXRechnung(invoice);

      expect(xml.indexOf("<cac:BillingReference>")).toBeLessThan(
        xml.indexOf("<cac:ContractDocumentReference>"),
      );
      expect(xml.indexOf("<cac:ContractDocumentReference>")).toBeLessThan(
        xml.indexOf("<cac:AccountingSupplierParty>"),
      );
    });

    it("escapes special characters in the contract reference", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        contractReference: "CONTRACT&2025<001",
      };
      const xml = toXRechnung(invoice);
      expect(xml).toContain("<cbc:ID>CONTRACT&amp;2025&lt;001</cbc:ID>");
    });
  });

  describe("cac:OrderReference (BT-13)", () => {
    it("skips cac:OrderReference when purchaseOrderReference is absent", () => {
      const xml = toXRechnung(domesticSimple as unknown as Invoice);
      expect(xml).not.toContain("<cac:OrderReference>");
    });

    it("renders cac:OrderReference/cbc:ID when purchaseOrderReference is present", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        purchaseOrderReference: "PO-2025-001",
      };
      const xml = toXRechnung(invoice);
      const start = xml.indexOf("<cac:OrderReference>");
      const end = xml.indexOf("</cac:OrderReference>") + "</cac:OrderReference>".length;
      const orderReference = xml.slice(start, end);

      expect(orderReference).toBe(
        "<cac:OrderReference>\n    <cbc:ID>PO-2025-001</cbc:ID>\n  </cac:OrderReference>",
      );
    });

    it("places cac:OrderReference before cac:BillingReference (UBL 2.1 element order)", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        precedingInvoiceReference: { id: "INV-2025-001", issueDate: "2025-12-01" },
        purchaseOrderReference: "PO-2025-001",
      };
      const xml = toXRechnung(invoice);

      expect(xml.indexOf("<cac:OrderReference>")).toBeLessThan(
        xml.indexOf("<cac:BillingReference>"),
      );
    });

    it("escapes special characters in the purchase order reference", () => {
      const invoice: Invoice = {
        ...(domesticSimple as unknown as Invoice),
        purchaseOrderReference: "PO&2025<001",
      };
      const xml = toXRechnung(invoice);
      expect(xml).toContain("<cbc:ID>PO&amp;2025&lt;001</cbc:ID>");
    });
  });

  describe("VAT category 'O' (outside the scope of VAT)", () => {
    it("omits the line-level VAT Percent element (BR-O-05)", () => {
      const invoice = { ...(domesticSimple as unknown as Invoice) };
      invoice.lines = [{ ...invoice.lines[0]!, vatCategoryCode: "O", vatRate: 0 }];
      const xml = toXRechnung(invoice);
      const start = xml.indexOf("<cac:ClassifiedTaxCategory>");
      const end = xml.indexOf("</cac:ClassifiedTaxCategory>") + "</cac:ClassifiedTaxCategory>".length;
      const classifiedTaxCategory = xml.slice(start, end);

      expect(classifiedTaxCategory).toContain("<cbc:ID>O</cbc:ID>");
      expect(classifiedTaxCategory).not.toContain("<cbc:Percent>");
    });
  });

  describe("UBL document type by typeCode (Invoice vs CreditNote)", () => {
    it("renders ubl:Invoice / Invoice-2 namespace and cbc:InvoiceTypeCode for typeCode 380", () => {
      const xml = toXRechnung(domesticSimple as unknown as Invoice);
      expect(xml).toContain("<ubl:Invoice");
      expect(xml).toContain('xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
      expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
      expect(xml).toContain("</ubl:Invoice>");
    });

    it("renders ubl:CreditNote / CreditNote-2 namespace and cbc:CreditNoteTypeCode for typeCode 381", () => {
      const xml = toXRechnung(creditNoteFull as unknown as Invoice);
      expect(xml).toContain("<ubl:CreditNote");
      expect(xml).toContain(
        'xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"',
      );
      expect(xml).toContain("<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>");
      expect(xml).not.toContain("<cbc:InvoiceTypeCode>");
      expect(xml).toContain("</ubl:CreditNote>");
    });

    it("uses cac:CreditNoteLine and cbc:CreditedQuantity, not cac:InvoiceLine, for a credit note", () => {
      const xml = toXRechnung(creditNoteFull as unknown as Invoice);
      expect(xml).toContain("<cac:CreditNoteLine>");
      expect(xml).toContain('<cbc:CreditedQuantity unitCode="HUR">-8</cbc:CreditedQuantity>');
      expect(xml).not.toContain("<cac:InvoiceLine>");
      expect(xml).not.toContain("InvoicedQuantity");
    });

    it("omits cbc:DueDate for a credit note even when dueDate is set (CreditNoteType has no such element)", () => {
      const invoice: Invoice = {
        ...(creditNoteFull as unknown as Invoice),
        dueDate: "2026-07-20",
      };
      const xml = toXRechnung(invoice);
      expect(xml).not.toContain("<cbc:DueDate>");
    });

    it("still renders typeCode 384 (corrective invoice) as ubl:Invoice, not CreditNote", () => {
      const invoice: Invoice = { ...(domesticSimple as unknown as Invoice), typeCode: "384" };
      const xml = toXRechnung(invoice);
      expect(xml).toContain("<ubl:Invoice");
      expect(xml).toContain("<cbc:InvoiceTypeCode>384</cbc:InvoiceTypeCode>");
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
      const xml = toXRechnung(invoice);
      expect(xml).toContain("A&amp;B");
      expect(xml).toContain("&lt;GmbH&gt;");
      expect(xml).not.toContain("A&B <");
    });
  });
});
