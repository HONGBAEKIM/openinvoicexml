import type { Invoice } from "../core/index.js";
import { esc, amt } from "../core/utils/xml.js";
import type { EInvoiceProfile } from "./hybrid-pdf.js";
import {
  mapInvoice,
  type PartyFields,
  type PaymentMeansFields,
  type VatSubtotalFields,
  type LineFields,
  type DeliveryFields,
  type PrecedingInvoiceReferenceFields,
  type AllowanceChargeFields,
} from "./cii-mapping.js";

/**
 * XML serialization — converts the prepared data from cii-mapping.ts
 * into CII XML used by Factur-X and ZUGFeRD.
 * XML details such as escaping, tag names, and element order are handled here.
 * Default values and calculated fields should be handled in cii-mapping.ts instead.
 *
 * Element order below is confirmed against the real vendored XSD family in
 * tools/kosit/config/resources/cii/16b/xsd/ (CrossIndustryInvoice_100pD16B.xsd and
 * CrossIndustryInvoice_ReusableAggregateBusinessInformationEntity_100pD16B.xsd), not assumed by
 * analogy to xrechnung.ts's UBL ordering — CII's XSDs are strict about child element sequence.
 */

/** CII qdt:DocumentCodeType-style dates use format "102" — YYYYMMDD, no separators. */
function dt102(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function renderDateTime(isoDate: string, tag: string): string {
  return `<ram:${tag}>\n        <udt:DateTimeString format="102">${dt102(isoDate)}</udt:DateTimeString>\n      </ram:${tag}>`;
}

function renderReferencedDocument(
  wrapperTag: string,
  id: string,
  issueDate?: string,
  indent = "  ",
): string {
  const formattedIssueDate = issueDate
    ? `\n${indent}    <ram:FormattedIssueDateTime>\n${indent}      <qdt:DateTimeString format="102">${dt102(issueDate)}</qdt:DateTimeString>\n${indent}    </ram:FormattedIssueDateTime>`
    : "";
  return `${indent}<ram:${wrapperTag}>\n${indent}  <ram:IssuerAssignedID>${esc(id)}</ram:IssuerAssignedID>${formattedIssueDate}\n${indent}</ram:${wrapperTag}>`;
}

function renderInvoiceReferencedDocument(ref: PrecedingInvoiceReferenceFields): string {
  return renderReferencedDocument("InvoiceReferencedDocument", ref.id, ref.issueDate, "    ");
}

function renderParty(wrapperTag: string, party: PartyFields): string {
  // CII-SR-224/CII-SR-252 (confirmed by a real KoSIT run): 
  // SpecifiedLegalOrganization/Name should not be present
  // The party already has its own Name, so adding it again would be duplicate data. 
  // Only create SpecifiedLegalOrganization when legalId exists, and only include the ID.
  const legalOrg = party.legalId
    ? `\n      <ram:SpecifiedLegalOrganization>\n        <ram:ID>${esc(party.legalId)}</ram:ID>\n      </ram:SpecifiedLegalOrganization>`
    : "";

  const contact = party.contact
    ? `\n      <ram:DefinedTradeContact>${
        party.contact.name ? `\n        <ram:PersonName>${esc(party.contact.name)}</ram:PersonName>` : ""
      }
        <ram:TelephoneUniversalCommunication>
          <ram:CompleteNumber>${esc(party.contact.telephone)}</ram:CompleteNumber>
        </ram:TelephoneUniversalCommunication>
        <ram:EmailURIUniversalCommunication>
          <ram:URIID>${esc(party.contact.email)}</ram:URIID>
        </ram:EmailURIUniversalCommunication>
      </ram:DefinedTradeContact>`
    : "";

  const line2 = party.addressLine2
    ? `\n        <ram:LineTwo>${esc(party.addressLine2)}</ram:LineTwo>`
    : "";
  const address = `\n      <ram:PostalTradeAddress>
        <ram:PostcodeCode>${esc(party.postalCode)}</ram:PostcodeCode>
        <ram:LineOne>${esc(party.addressLine1)}</ram:LineOne>${line2}
        <ram:CityName>${esc(party.city)}</ram:CityName>
        <ram:CountryID>${party.countryCode}</ram:CountryID>
      </ram:PostalTradeAddress>`;

  const electronicAddress = `\n      <ram:URIUniversalCommunication>
        <ram:URIID schemeID="${esc(party.schemeId)}">${esc(party.electronicAddress)}</ram:URIID>
      </ram:URIUniversalCommunication>`;

  const vatRegistration = party.vatId
    ? `\n      <ram:SpecifiedTaxRegistration>\n        <ram:ID schemeID="VA">${esc(party.vatId)}</ram:ID>\n      </ram:SpecifiedTaxRegistration>`
    : "";
  const fcRegistration = party.taxRegistrationId
    ? `\n      <ram:SpecifiedTaxRegistration>\n        <ram:ID schemeID="FC">${esc(party.taxRegistrationId)}</ram:ID>\n      </ram:SpecifiedTaxRegistration>`
    : "";

  return `  <ram:${wrapperTag}>
      <ram:Name>${esc(party.name)}</ram:Name>${legalOrg}${contact}${address}${electronicAddress}${vatRegistration}${fcRegistration}
  </ram:${wrapperTag}>`;
}

function renderShipTo(delivery: DeliveryFields): string {
  const deliverTo = delivery.deliverTo;
  if (!deliverTo) return "";
  const city = deliverTo.city ? `\n        <ram:CityName>${esc(deliverTo.city)}</ram:CityName>` : "";
  const postalCode = deliverTo.postalCode
    ? `\n        <ram:PostcodeCode>${esc(deliverTo.postalCode)}</ram:PostcodeCode>`
    : "";
  const country = deliverTo.countryCode
    ? `\n        <ram:CountryID>${deliverTo.countryCode}</ram:CountryID>`
    : "";
  if (!city && !postalCode && !country) return "";
  return `\n    <ram:ShipToTradeParty>\n      <ram:PostalTradeAddress>${postalCode}${city}${country}\n      </ram:PostalTradeAddress>\n    </ram:ShipToTradeParty>`;
}

function renderActualDelivery(delivery: DeliveryFields): string {
  if (!delivery.actualDeliveryDate) return "";
  return `\n    <ram:ActualDeliverySupplyChainEvent>\n      <ram:OccurrenceDateTime>\n        <udt:DateTimeString format="102">${dt102(delivery.actualDeliveryDate)}</udt:DateTimeString>\n      </ram:OccurrenceDateTime>\n    </ram:ActualDeliverySupplyChainEvent>`;
}

function renderPaymentMeans(pm: PaymentMeansFields): string {
  const account =
    pm.iban || pm.accountName
      ? `\n      <ram:PayeePartyCreditorFinancialAccount>${
          pm.iban ? `\n        <ram:IBANID>${esc(pm.iban)}</ram:IBANID>` : ""
        }${
          pm.accountName ? `\n        <ram:AccountName>${esc(pm.accountName)}</ram:AccountName>` : ""
        }\n      </ram:PayeePartyCreditorFinancialAccount>`
      : "";
  const institution = pm.bic
    ? `\n      <ram:PayeeSpecifiedCreditorFinancialInstitution>\n        <ram:BICID>${esc(pm.bic)}</ram:BICID>\n      </ram:PayeeSpecifiedCreditorFinancialInstitution>`
    : "";

  return `    <ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:TypeCode>${esc(pm.code)}</ram:TypeCode>${account}${institution}
    </ram:SpecifiedTradeSettlementPaymentMeans>`;
}

/** BT-119/BT-152: CII, like UBL, omits the VAT percent entirely for category "O" (BR-O-05/06/07). */
function renderRateApplicablePercent(categoryCode: string, rate: number | undefined): string {
  return categoryCode === "O" || rate === undefined
    ? ""
    : `\n        <ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent>`;
}

function renderVatSubtotal(bd: VatSubtotalFields): string {
  const exemptionReason = bd.exemptionReason
    ? `\n        <ram:ExemptionReason>${esc(bd.exemptionReason)}</ram:ExemptionReason>`
    : "";
  const exemptionReasonCode = bd.exemptionReasonCode
    ? `\n        <ram:ExemptionReasonCode>${esc(bd.exemptionReasonCode)}</ram:ExemptionReasonCode>`
    : "";
  const percent = renderRateApplicablePercent(bd.categoryCode, bd.rate);

  // ram:TradeTaxType's fixed sequence: CalculatedAmount, TypeCode, ExemptionReason, ...,
  // BasisAmount, CategoryCode, ..., ExemptionReasonCode, ..., RateApplicablePercent.
  //
  // CII-DT-031: currencyID must NOT be present on CalculatedAmount/BasisAmount (or on any
  // amount below except the header ram:TaxTotalAmount, BT-110) — currency is already
  // established once via ram:InvoiceCurrencyCode; confirmed against a real KoSIT rejection
  // during Task 1's validate-as-you-go pass, not assumed by analogy to UBL's per-amount
  // currencyID convention.
  return `    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${amt(bd.taxAmount)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>${exemptionReason}
      <ram:BasisAmount>${amt(bd.taxableAmount)}</ram:BasisAmount>
      <ram:CategoryCode>${bd.categoryCode}</ram:CategoryCode>${exemptionReasonCode}${percent}
    </ram:ApplicableTradeTax>`;
}

// BG-20/BG-21 (document level) / BG-27/BG-28 (line level) — ram:TradeAllowanceChargeType's fixed
// sequence: ChargeIndicator, ..., ActualAmount, ..., ReasonCode, Reason, ..., CategoryTradeTax.
// CategoryTradeTax is only present for document-level allowances/charges, same as UBL's
// cac:TaxCategory — line-level entries inherit the line's own VAT category.
function renderAllowanceCharge(ac: AllowanceChargeFields, indent: string): string {
  const reasonCode = ac.reasonCode
    ? `\n${indent}  <ram:ReasonCode>${esc(ac.reasonCode)}</ram:ReasonCode>`
    : "";
  const reason = ac.reason ? `\n${indent}  <ram:Reason>${esc(ac.reason)}</ram:Reason>` : "";
  const percent = renderRateApplicablePercent(ac.vatCategoryCode ?? "", ac.vatRate);
  const categoryTradeTax =
    ac.vatCategoryCode !== undefined
      ? `\n${indent}  <ram:CategoryTradeTax>\n${indent}    <ram:TypeCode>VAT</ram:TypeCode>\n${indent}    <ram:CategoryCode>${ac.vatCategoryCode}</ram:CategoryCode>${percent}\n${indent}  </ram:CategoryTradeTax>`
      : "";

  // CII-DT-031: no currencyID on ActualAmount — see renderVatSubtotal's note above.
  return `${indent}<ram:SpecifiedTradeAllowanceCharge>
${indent}  <ram:ChargeIndicator>
${indent}    <udt:Indicator>${ac.isCharge}</udt:Indicator>
${indent}  </ram:ChargeIndicator>
${indent}  <ram:ActualAmount>${amt(ac.amount)}</ram:ActualAmount>${reasonCode}${reason}${categoryTradeTax}
${indent}</ram:SpecifiedTradeAllowanceCharge>`;
}

// ram:SupplyChainTradeLineItemType's fixed sequence: AssociatedDocumentLineDocument,
// SpecifiedTradeProduct, SpecifiedLineTradeAgreement, SpecifiedLineTradeDelivery,
// SpecifiedLineTradeSettlement.
function renderLine(line: LineFields): string {
  const description = line.description
    ? `\n      <ram:Description>${esc(line.description)}</ram:Description>`
    : "";
  const lineAllowancesCharges = line.allowancesCharges.length
    ? `\n${line.allowancesCharges.map((ac) => renderAllowanceCharge(ac, "      ")).join("\n")}`
    : "";
  const percent = renderRateApplicablePercent(line.vatCategoryCode, line.vatRate);

  // CII-DT-031: no currencyID on ChargeAmount/LineTotalAmount — see renderVatSubtotal's note.
  return `  <ram:IncludedSupplyChainTradeLineItem>
    <ram:AssociatedDocumentLineDocument>
      <ram:LineID>${esc(line.id)}</ram:LineID>
    </ram:AssociatedDocumentLineDocument>
    <ram:SpecifiedTradeProduct>
      <ram:Name>${esc(line.name)}</ram:Name>${description}
    </ram:SpecifiedTradeProduct>
    <ram:SpecifiedLineTradeAgreement>
      <ram:NetPriceProductTradePrice>
        <ram:ChargeAmount>${amt(line.unitPrice)}</ram:ChargeAmount>
      </ram:NetPriceProductTradePrice>
    </ram:SpecifiedLineTradeAgreement>
    <ram:SpecifiedLineTradeDelivery>
      <ram:BilledQuantity unitCode="${esc(line.unitCode)}">${line.quantity}</ram:BilledQuantity>
    </ram:SpecifiedLineTradeDelivery>
    <ram:SpecifiedLineTradeSettlement>
      <ram:ApplicableTradeTax>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:CategoryCode>${line.vatCategoryCode}</ram:CategoryCode>${percent}
      </ram:ApplicableTradeTax>${lineAllowancesCharges}
      <ram:SpecifiedTradeSettlementLineMonetarySummation>
        <ram:LineTotalAmount>${amt(line.lineAmount)}</ram:LineTotalAmount>
      </ram:SpecifiedTradeSettlementLineMonetarySummation>
    </ram:SpecifiedLineTradeSettlement>
  </ram:IncludedSupplyChainTradeLineItem>`;
}

/**
 * The two CII profile IDs used by KoSIT:
 * one for EN16931 and one for XRechnung.
 * These exact IDs make toCii() match KoSIT's real CII validation scenarios.
 */
const GUIDELINE_ID: Record<EInvoiceProfile, string> = {
  EN16931: "urn:cen.eu:en16931:2017",
  XRECHNUNG: "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0",
};

export function toCii(invoice: Invoice, options: { profile?: EInvoiceProfile } = {}): string {
  const profile = options.profile ?? "EN16931";
  const fields = mapInvoice(invoice);
  const currency = fields.currencyCode;

  const businessProcess = fields.businessProcessType
    ? `\n    <ram:BusinessProcessSpecifiedDocumentContextParameter>\n      <ram:ID>${esc(fields.businessProcessType)}</ram:ID>\n    </ram:BusinessProcessSpecifiedDocumentContextParameter>`
    : "";

  const note = fields.note
    ? `\n    <ram:IncludedNote>\n      <ram:Content>${esc(fields.note)}</ram:Content>\n    </ram:IncludedNote>`
    : "";

  // The newline is mainly for readability
  const lines = fields.lines.map((l) => renderLine(l)).join("\n");

  // ram:HeaderTradeAgreementType's fixed sequence: ..., BuyerReference, SellerTradeParty,
  // BuyerTradeParty, ..., BuyerOrderReferencedDocument (BT-13), ..., ContractReferencedDocument
  // (BT-12), ...
  const buyerReference = fields.buyerReference
    ? `\n    <ram:BuyerReference>${esc(fields.buyerReference)}</ram:BuyerReference>`
    : "";
  const orderReference = fields.purchaseOrderReference
    ? `\n${renderReferencedDocument("BuyerOrderReferencedDocument", fields.purchaseOrderReference, undefined, "    ")}`
    : "";
  const contractReference = fields.contractReference
    ? `\n${renderReferencedDocument("ContractReferencedDocument", fields.contractReference, undefined, "    ")}`
    : "";

  // ram:HeaderTradeDeliveryType's fixed sequence: ..., ShipToTradeParty, ...,
  // ActualDeliverySupplyChainEvent, ...
  const delivery = fields.delivery ? renderShipTo(fields.delivery) : "";
  const actualDelivery = fields.delivery ? renderActualDelivery(fields.delivery) : "";
  const hasDelivery = delivery || actualDelivery;

  // ram:HeaderTradeSettlementType's fixed sequence: ..., InvoiceCurrencyCode, ...,
  // SpecifiedTradeSettlementPaymentMeans, ApplicableTradeTax, ..., SpecifiedTradeAllowanceCharge,
  // ..., SpecifiedTradePaymentTerms, SpecifiedTradeSettlementHeaderMonetarySummation, ...,
  // InvoiceReferencedDocument, ...
  const paymentMeans = fields.paymentMeans ? `\n${renderPaymentMeans(fields.paymentMeans)}` : "";
  const vatSubtotals = fields.vatSubtotals.map((bd) => renderVatSubtotal(bd)).join("\n");
  const documentAllowancesCharges = fields.allowancesCharges.length
    ? `\n${fields.allowancesCharges.map((ac) => renderAllowanceCharge(ac, "    ")).join("\n")}`
    : "";
  const paymentTerms = fields.dueDate
    ? `\n    <ram:SpecifiedTradePaymentTerms>\n      ${renderDateTime(fields.dueDate, "DueDateDateTime")}\n    </ram:SpecifiedTradePaymentTerms>`
    : "";
  // CII-DT-031: no currencyID here either — see renderVatSubtotal's note above.
  const prepaidAmount = fields.prepaidAmount
    ? `\n      <ram:TotalPrepaidAmount>${amt(fields.prepaidAmount)}</ram:TotalPrepaidAmount>`
    : "";
  const invoiceReferencedDocument = fields.precedingInvoiceReference
    ? `\n${renderInvoiceReferencedDocument(fields.precedingInvoiceReference)}`
    : "";
// rsm = main CII document structure
// ram = reusable business structures
// udt = basic data types
// qdt = qualified data types
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>${businessProcess}
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${GUIDELINE_ID[profile]}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(fields.id)}</ram:ID>
    <ram:TypeCode>${fields.typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dt102(fields.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>${note}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>${buyerReference}
${renderParty("SellerTradeParty", fields.seller)}
${renderParty("BuyerTradeParty", fields.buyer)}${orderReference}${contractReference}
    </ram:ApplicableHeaderTradeAgreement>
    ${
      hasDelivery
        ? `<ram:ApplicableHeaderTradeDelivery>${delivery}${actualDelivery}\n    </ram:ApplicableHeaderTradeDelivery>`
        : "<ram:ApplicableHeaderTradeDelivery/>"
    }
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${paymentMeans}
${vatSubtotals}${documentAllowancesCharges}${paymentTerms}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(fields.lineExtensionAmount)}</ram:LineTotalAmount>
        <ram:ChargeTotalAmount>${amt(fields.chargeTotalAmount)}</ram:ChargeTotalAmount>
        <ram:AllowanceTotalAmount>${amt(fields.allowanceTotalAmount)}</ram:AllowanceTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(fields.taxExclusiveAmount)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${amt(fields.taxAmount)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(fields.taxInclusiveAmount)}</ram:GrandTotalAmount>${prepaidAmount}
        <ram:DuePayableAmount>${amt(fields.duePayableAmount)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>${invoiceReferencedDocument}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
