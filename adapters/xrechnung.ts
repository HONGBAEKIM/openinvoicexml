import type { Invoice } from "../core/index.js";
import { esc, amt } from "../core/utils/xml.js";
import {
  mapInvoice,
  type PartyFields,
  type PaymentMeansFields,
  type VatSubtotalFields,
  type LineFields,
  type DeliveryFields,
  type PrecedingInvoiceReferenceFields,
} from "./xrechnung-mapping.js";

/**
 * XML serialization — turns already-resolved field structures (see xrechnung-mapping.ts) into
 * UBL 2.1 markup. Escaping and tag/element structure live here; no field defaulting or
 * derivation belongs in this file.
 */

function renderBillingReference(ref: PrecedingInvoiceReferenceFields): string {
  return `  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(ref.id)}</cbc:ID>
      <cbc:IssueDate>${ref.issueDate}</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

function renderParty(wrapperTag: string, party: PartyFields): string {
  const line2 = party.addressLine2
    ? `\n        <cbc:AdditionalStreetName>${esc(party.addressLine2)}</cbc:AdditionalStreetName>`
    : "";
  const vatScheme = party.vatId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${esc(party.vatId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const fcScheme = party.taxRegistrationId
    ? `\n      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${esc(party.taxRegistrationId)}</cbc:CompanyID>\n        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>\n      </cac:PartyTaxScheme>`
    : "";
  const companyId = party.legalId
    ? `\n        <cbc:CompanyID>${esc(party.legalId)}</cbc:CompanyID>`
    : "";
  const contact = party.contact
    ? `\n      <cac:Contact>${party.contact.name ? `\n        <cbc:Name>${esc(party.contact.name)}</cbc:Name>` : ""}\n        <cbc:Telephone>${esc(party.contact.telephone)}</cbc:Telephone>\n        <cbc:ElectronicMail>${esc(party.contact.email)}</cbc:ElectronicMail>\n      </cac:Contact>`
    : "";

  return `  <${wrapperTag}>
    <cac:Party>
      <cbc:EndpointID schemeID="${esc(party.schemeId)}">${esc(party.electronicAddress)}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${esc(party.name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(party.addressLine1)}</cbc:StreetName>${line2}
        <cbc:CityName>${esc(party.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(party.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${party.countryCode}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${vatScheme}${fcScheme}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(party.name)}</cbc:RegistrationName>${companyId}
      </cac:PartyLegalEntity>${contact}
    </cac:Party>
  </${wrapperTag}>`;
}

function renderDelivery(delivery: DeliveryFields): string {
  const actualDeliveryDate = delivery.actualDeliveryDate
    ? `\n    <cbc:ActualDeliveryDate>${delivery.actualDeliveryDate}</cbc:ActualDeliveryDate>`
    : "";
  const deliverTo = delivery.deliverTo;
  const city = deliverTo?.city ? `\n        <cbc:CityName>${esc(deliverTo.city)}</cbc:CityName>` : "";
  const postalCode = deliverTo?.postalCode
    ? `\n        <cbc:PostalZone>${esc(deliverTo.postalCode)}</cbc:PostalZone>`
    : "";
  const country = deliverTo?.countryCode
    ? `\n        <cac:Country><cbc:IdentificationCode>${deliverTo.countryCode}</cbc:IdentificationCode></cac:Country>`
    : "";
  const deliveryLocation =
    city || postalCode || country
      ? `\n    <cac:DeliveryLocation>\n      <cac:Address>${city}${postalCode}${country}\n      </cac:Address>\n    </cac:DeliveryLocation>`
      : "";

  return `  <cac:Delivery>${actualDeliveryDate}${deliveryLocation}
  </cac:Delivery>`;
}

function renderPaymentMeans(pm: PaymentMeansFields): string {
  const iban = pm.iban ? `\n      <cbc:ID>${esc(pm.iban)}</cbc:ID>` : "";
  const accountName = pm.accountName ? `\n      <cbc:Name>${esc(pm.accountName)}</cbc:Name>` : "";
  const bic = pm.bic
    ? `\n      <cac:FinancialInstitutionBranch><cbc:ID>${esc(pm.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`
    : "";

  const account =
    iban || accountName || bic
      ? `\n    <cac:PayeeFinancialAccount>${iban}${accountName}${bic}\n    </cac:PayeeFinancialAccount>`
      : "";

  return `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${esc(pm.code)}</cbc:PaymentMeansCode>${account}
  </cac:PaymentMeans>`;
}

function renderVatSubtotal(bd: VatSubtotalFields, currency: string): string {
  const exemptionReason = bd.exemptionReason
    ? `\n        <cbc:TaxExemptionReason>${esc(bd.exemptionReason)}</cbc:TaxExemptionReason>`
    : "";
  const exemptionReasonCode = bd.exemptionReasonCode
    ? `\n        <cbc:TaxExemptionReasonCode>${esc(bd.exemptionReasonCode)}</cbc:TaxExemptionReasonCode>`
    : "";

  return `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${amt(bd.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${amt(bd.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${bd.categoryCode}</cbc:ID>
        <cbc:Percent>${bd.rate}</cbc:Percent>${exemptionReasonCode}${exemptionReason}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
}

function renderLine(line: LineFields, currency: string, isCreditNote: boolean): string {
  const description = line.description
    ? `\n      <cbc:Description>${esc(line.description)}</cbc:Description>`
    : "";
  // BR-O-05: an invoice line whose VAT category is 'O' (outside VAT scope) must not
  // carry an item VAT rate at all — not even 0.
  const percent =
    line.vatCategoryCode === "O" ? "" : `\n        <cbc:Percent>${line.vatRate}</cbc:Percent>`;
  // UBL (Universal Business Language) models credit note lines 
  // as cac:CreditNoteLine/cbc:CreditedQuantity, distinct from
  // cac:InvoiceLine/cbc:InvoicedQuantity used by every other document type.
  const lineTag = isCreditNote ? "CreditNoteLine" : "InvoiceLine";
  const quantityTag = isCreditNote ? "CreditedQuantity" : "InvoicedQuantity";

  return `  <cac:${lineTag}>
    <cbc:ID>${esc(line.id)}</cbc:ID>
    <cbc:${quantityTag} unitCode="${esc(line.unitCode)}">${line.quantity}</cbc:${quantityTag}>
    <cbc:LineExtensionAmount currencyID="${currency}">${amt(line.lineAmount)}</cbc:LineExtensionAmount>
    <cac:Item>${description}
      <cbc:Name>${esc(line.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${line.vatCategoryCode}</cbc:ID>${percent}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${amt(line.unitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${lineTag}>`;
}

export function toXRechnung(invoice: Invoice): string {
  const fields = mapInvoice(invoice);
  const currency = fields.currencyCode;

  // A credit note (381) is its own UBL document type — CreditNote-2, not Invoice-2 — with a
  // cbc:CreditNoteTypeCode instead of cbc:InvoiceTypeCode and cac:CreditNoteLine instead of
  // cac:InvoiceLine. Everything else (parties, totals, VAT breakdown, BillingReference) is
  // shared structure. See tools/kosit/config/scenarios.xml's "EN16931 XRechnung (UBL
  // CreditNote)" scenario, which matches on this exact root/namespace.
  const isCreditNote = fields.typeCode === "381";
  const rootTag = isCreditNote ? "CreditNote" : "Invoice";
  const namespace = isCreditNote
    ? "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"
    : "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  const typeCodeTag = isCreditNote ? "CreditNoteTypeCode" : "InvoiceTypeCode";

  const note = fields.note ? `\n  <cbc:Note>${esc(fields.note)}</cbc:Note>` : "";
  const buyerRef = fields.buyerReference
    ? `\n  <cbc:BuyerReference>${esc(fields.buyerReference)}</cbc:BuyerReference>`
    : "";
  const billingReference = fields.precedingInvoiceReference
    ? `\n${renderBillingReference(fields.precedingInvoiceReference)}`
    : "";
  // BT-13: cac:OrderReference sits before cac:BillingReference in UBL-Invoice-2.1.xsd's fixed
  // element sequence; only cbc:ID is mapped, matching cac:ContractDocumentReference below.
  const orderReference = fields.purchaseOrderReference
    ? `\n  <cac:OrderReference>\n    <cbc:ID>${esc(fields.purchaseOrderReference)}</cbc:ID>\n  </cac:OrderReference>`
    : "";
  // BT-12: cac:ContractDocumentReference sits between BillingReference and the parties in
  // UBL-Invoice-2.1.xsd's fixed element sequence; only cbc:ID is mapped (BR rules discourage
  // every other DocumentReferenceType child here, e.g. UBL-CR-096 for IssueDate).
  const contractReference = fields.contractReference
    ? `\n  <cac:ContractDocumentReference>\n    <cbc:ID>${esc(fields.contractReference)}</cbc:ID>\n  </cac:ContractDocumentReference>`
    : "";
  const delivery = fields.delivery ? `\n${renderDelivery(fields.delivery)}` : "";
  const paymentMeans = fields.paymentMeans ? `\n${renderPaymentMeans(fields.paymentMeans)}` : "";
  // CreditNoteType has no cbc:DueDate element at all (UBL-CreditNote-2.1.xsd) — a credit
  // reduces what's owed, it doesn't create a new payment deadline.
  const dueDate =
    !isCreditNote && fields.dueDate ? `\n  <cbc:DueDate>${fields.dueDate}</cbc:DueDate>` : "";
  const prepaidAmount = fields.prepaidAmount
    ? `\n    <cbc:PrepaidAmount currencyID="${currency}">${amt(fields.prepaidAmount)}</cbc:PrepaidAmount>`
    : "";

  const lineExtension = amt(fields.lineExtensionAmount);
  // Converting each VAT breakdown into XML
  // using map() many items -> many transformed items
  // vat1, vat2 -> xml1, xml2
  const vatSubtotals = fields.vatSubtotals.map((bd) => renderVatSubtotal(bd, currency)).join("\n");

  // for each invoice line(items), generate one <cac:InvoiceLine>/<cac:CreditNoteLine> xml element
  const invoiceLines = fields.lines.map((l) => renderLine(l, currency, isCreditNote)).join("\n");

  // ubl = the overall document.
  // cac = complex "object-like" structures.
  // cbc = simple data values inside those structures.
  return `<?xml version="1.0" encoding="UTF-8"?>
<ubl:${rootTag}
  xmlns:ubl="${namespace}"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>${esc(fields.businessProcessType)}</cbc:ProfileID>
  <cbc:ID>${esc(fields.id)}</cbc:ID>
  <cbc:IssueDate>${fields.issueDate}</cbc:IssueDate>${dueDate}
  <cbc:${typeCodeTag}>${fields.typeCode}</cbc:${typeCodeTag}>${note}
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>${buyerRef}${orderReference}${billingReference}${contractReference}
${renderParty("cac:AccountingSupplierParty", fields.seller)}
${renderParty("cac:AccountingCustomerParty", fields.buyer)}${delivery}${paymentMeans}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${amt(fields.taxAmount)}</cbc:TaxAmount>
${vatSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${lineExtension}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${amt(fields.taxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${amt(fields.taxInclusiveAmount)}</cbc:TaxInclusiveAmount>${prepaidAmount}
    <cbc:PayableAmount currencyID="${currency}">${amt(fields.duePayableAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</ubl:${rootTag}>`;
}
