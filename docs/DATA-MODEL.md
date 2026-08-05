# Data Model and Mapping

## Invoice schema

Internal invoice schema v0.1 — the single source of truth for all output adapters.

### Purpose and scope

The internal schema is the contract between user input and every downstream output module. The adapters consume an internal `Invoice` object rather than raw external input. When input originates as untyped JSON, the consumer should validate it against `schemas/invoice.schema.json` before treating it as an `Invoice` — this package currently uses AJV in its test suite to verify fixtures against the schema, but it does not run JSON Schema validation automatically in the `generateInvoice()` pipeline (see [`ARCHITECTURE.md`](ARCHITECTURE.md#no-runtime-dependencies)). This decoupling ensures that a change to the XML output format cannot corrupt the PDF output, and vice versa.

`schemas/invoice.schema.json` enforces **structural correctness**: field types, required fields, allowed enumerations, and value formats. Business-rule validation (VAT arithmetic consistency, cross-field constraints from EN 16931 Schematron, §13b buyer-VAT-ID requirement) is out of scope here and is handled by the separate `validateBusinessRules()` layer (`validators/02.business-rules.ts` + `validators/rules/*.ts`, landed Week 7 — see [`ARCHITECTURE.md`](ARCHITECTURE.md#validators)).

### Field naming conventions

- **camelCase** throughout, matching TypeScript conventions and avoiding conversion friction when the schema is consumed by TypeScript code.
- **Semantic names over accounting names**: `taxExclusiveAmount` rather than `netTotal`; `taxInclusiveAmount` rather than `grossTotal`. Semantic names survive translation to multiple output formats (EN 16931 XML, IBAN-PDF label, structured data export) without ambiguity.
- **Abbreviations kept to a minimum**: only `id`, `vat`, `bic`, `iban` are abbreviated. All other names spell out the concept in full.
- **Sub-objects use flat nesting**: `seller.address.city`, not `sellerAddressCity`. Flat nesting aligns with the EN 16931 BG (Business Group) hierarchy.

### VAT category codes (BT-151 / BT-118)

| Code | Meaning             | Typical German context                                                                                  |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `S`  | Standard rate       | 19% or 7% (reduced)                                                                                     |
| `Z`  | Zero-rated          | Supply taxable at 0%; distinct from exempt, intra-EU, and export transactions (e.g. a qualifying photovoltaic-system supply under [§12 Abs. 3 UStG][ustg-12], where supported) |
| `E`  | Exempt              | [§4 UStG][ustg-4] exemptions (doctors, insurance, etc.); also [§19 UStG][ustg-19] small-business (Kleinunternehmer) supplies |
| `AE` | Reverse charge      | [§13b UStG][ustg-13b] (construction, scrap metal, etc.)                                                             |
| `K`  | Intra-EU supply     | [§6a UStG][ustg-6a] (B2B cross-border within EU)                                                                   |
| `G`  | Export (outside EU) | [§6 UStG][ustg-6] (third-country export)                                                                          |
| `O`  | Not subject to VAT  | Genuinely non-taxable transactions                                                                      |

Codes `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) are excluded — see [`LIMITATIONS.md`](LIMITATIONS.md).

### Design decisions

#### JSON Schema Draft-07, not TypeScript-only validation

The schema is expressed as a JSON Schema document (`schemas/invoice.schema.json`) rather than Zod schemas or TypeScript-only constructs. Reasons:

- **Format-agnostic**: JSON Schema can be consumed by validation tools written in any language, such as Java, Python, JavaScript, or Rust. It is independent of the KoSIT toolchain, which validates generated XML using XSD and Schematron — KoSIT never sees `schemas/invoice.schema.json` or the internal JSON input.
- **Runtime enforcement**: TypeScript interfaces in `core/types/` are erased at compile time. JSON Schema validation, when a consumer applies it, happens at runtime — which is when user-supplied data is actually present.
- **Separation of concerns**: The TypeScript interfaces in `core/types/` and the JSON Schema in `schemas/` both represent the same structure, but they serve different purposes. The JSON Schema is the machine-readable structural contract for runtime validation by consumers. The TypeScript interfaces provide compile-time safety inside the package.

#### `additionalProperties: false` at every level

Every object in the schema sets `"additionalProperties": false`. This catches misnamed fields immediately — a fixture with `vatAmout` instead of `vatAmount` fails validation rather than passing silently and causing a null-pointer error in an adapter. This is especially important because downstream adapters do direct property access by name.

#### `number` for monetary amounts, not `string`

Amounts are stored as `number`. Alternatives considered:

- **String with fixed precision** (e.g. `"1000.00"`): avoids floating-point representation, but forces callers to parse before arithmetic and makes comparison error-prone.
- **Integer minor units** (e.g. `100000` = €1000.00): eliminates floating-point entirely, but requires all callers to know the currency's exponent and makes the schema harder to read.

The chosen approach: `number`. Callers are responsible for ensuring at most 2 decimal places. Rounding and document-total arithmetic consistency (e.g. EN 16931 `BR-CO-15`, `BR-CO-17` — see "What is NOT validated here" below) is enforced by the business-rule validator, not by JSON Schema.

#### `lines: minItems: 1` and `vatBreakdowns: minItems: 1`

EN 16931 Business Rule BR-16 states "An invoice shall have at least one Invoice line". An invoice with zero lines is structurally invalid regardless of business context. Enforcing this at the schema level means adapters never need to guard against empty arrays.

#### `issueDate` / `dueDate` as `format: date`

YYYY-MM-DD format is declared via the `"date"` format keyword — enforced when a consumer runs the schema through a JSON Schema validator that supports it, such as AJV with the `ajv-formats` plugin (the combination this repo's own test suite uses against the fixtures). This prevents locale-ambiguous formats like `09/06/2026` (June 9 or September 6?) from entering the system, for any input that goes through that validation step. XML adapters emit dates in ISO 8601 without any conversion.

### Relationship to TypeScript interfaces

The TypeScript interfaces in `core/types/` and `schemas/invoice.schema.json` express the same structure but are maintained independently in v0.1. Neither is auto-generated from the other.

This duplication is intentional at this stage — it keeps both representations easy to read and modify without tooling dependencies. Week 4 should evaluate adding `ts-json-schema-generator` to the build pipeline to generate the JSON Schema from the TypeScript interfaces, eliminating the duplication.

### What is NOT validated here

The following are intentionally out of scope for the JSON Schema and are instead handled by `validateBusinessRules()` (`validators/02.business-rules.ts` + `validators/rules/*.ts`, landed Week 7 — see [`ARCHITECTURE.md`](ARCHITECTURE.md#validators)):

- **VAT arithmetic**: `vatBreakdown.taxAmount` must equal `taxableAmount × rate / 100` within rounding tolerance (BR-CO-17)
- **Total cross-check**: `taxInclusiveAmount` must equal `taxExclusiveAmount + taxAmount` (BR-CO-15)
- **Reverse-charge buyer identifier**: OpenInvoiceXML currently requires `buyer.vatId` for category `AE`. This is a stricter project-level check than EN 16931 `BR-AE-02` (see [en16931]), which also permits the buyer legal registration identifier.

Still genuinely unvalidated anywhere in the codebase, not just deferred to the business-rule layer:

- **Credit note reference**: when `typeCode` is `381`, a `precedingInvoiceReference` must be present — credit notes themselves aren't implemented yet (Phase 3, in progress — see `docs/ROADMAP.md`)
- **IBAN check digit**: the IBAN regex validates structure but not the ISO 7064 MOD-97-10 check digit

---

## XRechnung Business Term mapping

Maps XRechnung 3.x Business Terms (BT/BG) to their corresponding fields in the internal Invoice schema and to the UBL 2.1 XML element they produce. This table is the single source of truth for the BT mapping.

### §14 Abs. 4 UStG numbering, for reference

The "Legal basis" columns below cite specific `Nr.` items under §14 Abs. 4 UStG. Verified directly against [the statute text][ustg-14] — this table exists so a future edit doesn't have to re-derive it from memory:

| Nr. | Requires                                                          |
| --- | ------------------------------------------------------------------ |
| 1   | Full name and address of **both** the supplier and the recipient  |
| 2   | The **supplier's own** tax number (Finanzamt) or VAT ID           |
| 3   | The issue date                                                    |
| 4   | The unique, sequential invoice number                             |
| 5   | Quantity/type of goods, or scope/type of service                  |
| 6   | The date of delivery or service                                   |
| 7   | The consideration, broken down by tax rate/exemption              |
| 8   | The applicable tax rate and tax amount, or an exemption reference |

Nr. 2 is easy to mis-cite as covering the buyer's VAT ID by analogy with Nr. 1's "both parties" wording — it doesn't; Nr. 2 is supplier-specific.

### Process control (BG-2)

Source for the BT numbers and their EN 16931/XRechnung basis below: [en16931], [xrechnung-spec].

BG-2 is specifically the "PROCESS CONTROL" group — just these two elements. It does not cover the invoice number, dates, currency, or other document-level fields below; those belong directly to the invoice root, not to BG-2.

| BT    | Name                     | Internal field        | Legal basis         | UBL element           |
| ----- | ------------------------ | ---------------------- | -------------------- | ----------------------- |
| BT-24 | Specification identifier | (hardcoded)           | —                    | `cbc:CustomizationID` |
| BT-23 | Business process type    | `businessProcessType` | XRechnung spec §2.5 | `cbc:ProfileID`       |

### Other invoice-level fields

Source for the BT numbers and their EN 16931/XRechnung basis below: [en16931], [xrechnung-spec].

| BT    | Name                   | Internal field          | Legal basis           | UBL element                                  |
| ----- | ----------------------- | ------------------------ | ----------------------- | ---------------------------------------------- |
| BT-1  | Invoice number         | `id`                    | §14 Abs. 4 Nr. 4 UStG | `cbc:ID`                                     |
| BT-2  | Issue date             | `issueDate`             | §14 Abs. 4 Nr. 3 UStG | `cbc:IssueDate`                              |
| BT-3  | Invoice type code      | `typeCode`              | EN 16931 §6.2.1       | `cbc:InvoiceTypeCode`                        |
| BT-22 | Note                   | `note` (optional)       | —                      | `cbc:Note`                                   |
| BT-5  | Document currency code | `currencyCode`          | EN 16931 §6.2.2       | `cbc:DocumentCurrencyCode`                   |
| BT-10 | Buyer reference        | `buyerReference` (opt.) | XRechnung spec §2.4   | `cbc:BuyerReference`                         |
| BT-9  | Payment due date       | `dueDate` (optional)    | —                      | `cbc:DueDate` (invoice root, per `BR-CO-25`) |
| BT-25 | Preceding invoice number | `precedingInvoiceReference.id` (optional)        | EN 16931 §6.2.3 | `cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID`        |
| BT-26 | Preceding invoice issue date | `precedingInvoiceReference.issueDate` (optional) | EN 16931 §6.2.3 | `cac:BillingReference/cac:InvoiceDocumentReference/cbc:IssueDate` |

BT-9 maps to the plain root-level `cbc:DueDate` element — **not** `cac:PaymentMeans/cbc:PaymentDueDate` or `cac:PaymentTerms/cbc:PaymentDueDate`. Both of those are explicitly discouraged by this EN 16931 profile's own Schematron (`UBL-CR-412` / `UBL-CR-463` in `tools/kosit/config/resources/ubl/2.1/xsl/EN16931-UBL-validation.xsl` — both say "a UBL invoice should not include" those elements). `BR-CO-25` itself checks for `//cbc:DueDate` (or `BT-20` payment terms) whenever the amount due is positive. `adapters/xrechnung.ts` already emits the correct root-level `<cbc:DueDate>` next to `<cbc:IssueDate>` — this row previously described the wrong element, but the generator itself was already correct.

**Credit notes (`typeCode` `381`) are a different UBL document type, not an `Invoice` variant.** Per
`UBL-CreditNote-2.1.xsd`, BT-3 is `cbc:CreditNoteTypeCode` under a `ubl:CreditNote` root
(`urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2` namespace), not `cbc:InvoiceTypeCode`
under `ubl:Invoice` — `381` is not a legal `InvoiceTypeCode` value at all (`BR-CL-01`). `CreditNoteType`
also has **no `cbc:DueDate` element** in its schema, so BT-9 is never included for a `381` document
even if `dueDate` is set on the `Invoice` object — a credit reduces what's owed, it doesn't create a
new payment deadline. `adapters/xrechnung.ts` branches on `typeCode === "381"` to switch the root
element/namespace, type-code element, and (see below) the line-item wrapper; everything else
(parties, totals, VAT breakdown, `BillingReference`) is shared structure between the two document
types. See `tools/kosit/config/scenarios.xml`'s "EN16931 XRechnung (UBL CreditNote)" scenario, which
validates against this exact root/namespace.

`precedingInvoiceReference` renders only when present — a plain invoice (`380`) never needs it. `cac:BillingReference` is a repeatable group with several optional children in the UBL schema, but this project emits only `cac:InvoiceDocumentReference/cbc:ID` and `.../cbc:IssueDate`: `BR-55` (fatal, in `tools/kosit/config/resources/ubl/2.1/xsl/EN16931-UBL-validation.xsl`) requires `cbc:ID` whenever `cac:BillingReference` is present at all, while `UBL-CR-023` through `UBL-CR-026` (warnings) discourage including `CopyIndicator`, `UUID`, `IssueTime`, `DocumentTypeCode`, or `DocumentType` in this block.

### Seller (BG-4)

Source for the BT numbers and their EN 16931/XRechnung basis below: [en16931], [xrechnung-config].

| BT    | Name                      | Internal field                                                            | Legal basis           | UBL element                                          |
| ----- | -------------------------- | ---------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------- |
| BT-34 | Seller electronic address | `seller.electronicAddress` (+ `electronicAddressSchemeId` as `@schemeID`) | XRechnung spec §2.4   | `cbc:EndpointID[@schemeID]` (default `"EM"`)         |
| BT-27 | Seller name               | `seller.name`                                                             | §14 Abs. 4 Nr. 1 UStG | `cac:PartyName/cbc:Name`                             |
| BT-35 | Seller address line 1     | `seller.address.line1`                                                    | §14 Abs. 4 Nr. 1 UStG | `cbc:StreetName`                                     |
| BT-36 | Seller address line 2     | `seller.address.line2` (optional)                                         | —                      | `cbc:AdditionalStreetName`                           |
| BT-37 | Seller city               | `seller.address.city`                                                     | §14 Abs. 4 Nr. 1 UStG | `cbc:CityName`                                       |
| BT-38 | Seller postal code        | `seller.address.postalCode`                                               | §14 Abs. 4 Nr. 1 UStG | `cbc:PostalZone`                                     |
| BT-40 | Seller country code       | `seller.address.countryCode`                                              | EN 16931 §6.4.1       | `cac:Country/cbc:IdentificationCode`                 |
| BT-31 | Seller VAT identifier     | `seller.vatId` (optional)                                                 | §14 Abs. 4 Nr. 2 UStG | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `VAT`) |
| BT-32 | Seller tax registration   | `seller.taxRegistrationId` (optional)                                     | §14 Abs. 4 Nr. 2 UStG | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `FC`)  |
| BT-30 | Seller legal registration | `seller.legalId` (opt., fallback: name)                                   | —                      | `cac:PartyLegalEntity/cbc:CompanyID`                 |
| BT-28 | Seller legal name         | `seller.name`                                                             | —                      | `cac:PartyLegalEntity/cbc:RegistrationName`          |
| BT-41 | Seller contact point      | `seller.contact.name` (optional)                                          | XRechnung BR-DE-5     | `cac:Contact/cbc:Name`                               |
| BT-42 | Seller contact telephone  | `seller.contact.telephone`                                                | XRechnung BR-DE-6     | `cac:Contact/cbc:Telephone`                          |
| BT-43 | Seller contact email      | `seller.contact.email`                                                    | XRechnung BR-DE-7     | `cac:Contact/cbc:ElectronicMail`                     |

Seller contact (BG-6) as a _group_ is mandatory under the XRechnung national extension rule `BR-DE-2` — enforced structurally: the JSON Schema requires `seller.contact` (see `schemas/invoice.schema.json`). Each individual field within that group has its own rule instead of BR-DE-2 covering all three: `BR-DE-5` (BT-41 contact point), `BR-DE-6` (BT-42 telephone), and `BR-DE-7` (BT-43 email) — confirmed directly against `tools/kosit/config/resources/xrechnung/3.0.2/xsl/XRechnung-UBL-validation.xsl`. `Party.contact` is defined once and shared with `buyer` (EN 16931 BG-9), but only the seller's is required.

### Buyer (BG-7)

Buyer follows the same structure as seller. BT numbers shift to the BG-7 range. Source: [en16931], [xrechnung-config].

| BT    | Name                     | Internal field                                                           | Legal basis                                                        | UBL element                                          |
| ----- | ------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| BT-49 | Buyer electronic address | `buyer.electronicAddress` (+ `electronicAddressSchemeId` as `@schemeID`) | XRechnung spec §2.4                                                | `cbc:EndpointID[@schemeID]` (default `"EM"`)         |
| BT-44 | Buyer name               | `buyer.name`                                                             | §14 Abs. 4 Nr. 1 UStG                                              | `cac:PartyName/cbc:Name`                             |
| BT-50 | Buyer address line 1     | `buyer.address.line1`                                                    | §14 Abs. 4 Nr. 1 UStG                                              | `cbc:StreetName`                                     |
| BT-51 | Buyer address line 2     | `buyer.address.line2` (optional)                                         | —                                                                   | `cbc:AdditionalStreetName`                           |
| BT-52 | Buyer city               | `buyer.address.city`                                                     | §14 Abs. 4 Nr. 1 UStG                                              | `cbc:CityName`                                       |
| BT-53 | Buyer postal code        | `buyer.address.postalCode`                                               | §14 Abs. 4 Nr. 1 UStG                                              | `cbc:PostalZone`                                     |
| BT-55 | Buyer country code       | `buyer.address.countryCode`                                              | EN 16931 §6.4.1                                                    | `cac:Country/cbc:IdentificationCode`                 |
| BT-48 | Buyer VAT identifier     | `buyer.vatId` (optional)                                                 | Conditional — EN 16931 `BR-IC-02` (category K) / `BR-AE-02` (`AE`) | `cac:PartyTaxScheme/cbc:CompanyID` (TaxScheme `VAT`) |
| BT-47 | Buyer legal registration | `buyer.legalId` (opt., fallback: name)                                   | —                                                                   | `cac:PartyLegalEntity/cbc:CompanyID`                 |
| BT-45 | Buyer legal name         | `buyer.name`                                                             | —                                                                   | `cac:PartyLegalEntity/cbc:RegistrationName`          |

§14 Abs. 4 Nr. 1 UStG requires the full name and address of _both_ the supplier and the recipient — it is not seller-specific, unlike Nr. 2 (which concerns only the seller's own tax number / VAT ID). BT-48 (buyer VAT ID) is therefore not a Nr. 2 requirement at all: it's conditionally required by EN 16931 depending on VAT category — `BR-IC-02` requires it for category `K` (intra-EU supply), `BR-AE-02` for category `AE` (reverse charge) — both confirmed in `tools/kosit/config/resources/ubl/2.1/xsl/EN16931-UBL-validation.xsl`. This project's own `validators/rules/13.intra-eu.ts` (`INTRA_EU_SUPPLY_BUYER_VAT_ID_REQUIRED`) and the inline `REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED` check in `validators/02.business-rules.ts` already enforce this correctly — only this document's legal-basis citation was wrong, not the implementation.

### Delivery (BG-13) / Deliver-to address (BG-15)

Emitted only when `delivery` is present. `deliverTo` (BG-15) nests inside `delivery` (BG-13) and is emitted only when present. Source: [en16931], [xrechnung-config].

- BT-72 (or the unsupported BG-14 invoicing-period alternative) is required via business-rule validation, not JSON Schema, whenever any VAT breakdown uses category `K` (intra-EU supply) — see `BR-IC-11`. This codebase doesn't implement BG-14, so `actualDeliveryDate` is required in practice for category `K`.
- BT-80 is required by JSON Schema (`deliverTo.countryCode` is a required property) whenever a `deliverTo` address is supplied at all, per EN 16931's general `BR-57` — regardless of VAT category. It's also independently required for category `K` by `BR-IC-12`.
- BT-77 and BT-78 are **not enforced** by this validator, although XRechnung `BR-DE-10` and `BR-DE-11` (see [xrechnung-config]) require them whenever a deliver-to address (BG-15) is supplied — see [`LIMITATIONS.md`](LIMITATIONS.md) for why. These are unconditional national-extension rules, not scoped to a "German supplier/customer" precondition: the Schematron rule context is simply `cac:Delivery/cac:DeliveryLocation/cac:Address`, with no seller/buyer-country check anywhere. An invoice can pass this project's internal validation and still fail real XRechnung/KoSIT validation over a missing city/postal code — a real, declared gap, not a theoretical one.

| BT    | Name                    | Internal field                             | Legal basis                             | UBL element                                                           |
| ----- | ------------------------ | --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| BT-72 | Actual delivery date    | `delivery.actualDeliveryDate` (optional)   | EN 16931 §6.4.6 / §14 Abs. 4 Nr. 6 UStG | `cac:Delivery/cbc:ActualDeliveryDate`                                 |
| BT-77 | Deliver-to city         | `delivery.deliverTo.city` (optional)       | XRechnung BR-DE-10                       | `cac:DeliveryLocation/cac:Address/cbc:CityName`                       |
| BT-78 | Deliver-to post code    | `delivery.deliverTo.postalCode` (optional) | XRechnung BR-DE-11                       | `cac:DeliveryLocation/cac:Address/cbc:PostalZone`                     |
| BT-80 | Deliver-to country code | `delivery.deliverTo.countryCode`           | EN 16931 §6.4.6 (BR-57)                  | `cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode` |

### Payment means (BG-16)

Emitted only when `paymentMeans` is present. Source: [en16931].

| BT    | Name                      | Internal field                        | Legal basis | UBL element                                                       |
| ----- | -------------------------- | ---------------------------------------- | ------------- | --------------------------------------------------------------------- |
| BT-81 | Payment means code        | `paymentMeans.code`                   | —            | `cbc:PaymentMeansCode`                                            |
| BT-84 | Payment account ID (IBAN) | `paymentMeans.iban` (optional)        | —            | `cac:PayeeFinancialAccount/cbc:ID`                                |
| BT-85 | Payment account name      | `paymentMeans.accountName` (optional) | —            | `cac:PayeeFinancialAccount/cbc:Name`                              |
| BT-86 | Payment service provider  | `paymentMeans.bic` (optional)         | —            | `cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID` |

### VAT breakdown (BG-23)

One `cac:TaxSubtotal` per entry in `vatBreakdowns`. Source: [en16931].

| BT     | Name                  | Internal field                                    | Legal basis           | UBL element                      |
| ------ | ---------------------- | ---------------------------------------------------- | ----------------------- | ----------------------------------- |
| BT-116 | VAT taxable amount    | `vatBreakdowns[i].taxableAmount`                  | §14 Abs. 4 Nr. 7 UStG | `cbc:TaxableAmount[@currencyID]` |
| BT-117 | VAT amount            | `vatBreakdowns[i].taxAmount`                      | §14 Abs. 4 Nr. 8 UStG | `cbc:TaxAmount[@currencyID]`     |
| BT-118 | VAT category code     | `vatBreakdowns[i].categoryCode`                   | EN 16931 §6.3.3        | `cac:TaxCategory/cbc:ID`         |
| BT-119 | VAT category rate     | `vatBreakdowns[i].rate`                           | EN 16931 §6.3.3        | `cac:TaxCategory/cbc:Percent`    |
| BT-120 | Exemption reason      | `vatBreakdowns[i].exemptionReason` (optional)     | —                      | `cbc:TaxExemptionReason`         |
| BT-121 | Exemption reason code | `vatBreakdowns[i].exemptionReasonCode` (optional) | —                      | `cbc:TaxExemptionReasonCode`     |

### Document totals (BG-22)

Source: [en16931].

| BT     | Name                    | Internal field / derivation | Legal basis           | UBL element                                |
| ------ | ------------------------ | ------------------------------ | ----------------------- | --------------------------------------------- |
| BT-106 | Sum of line net amounts | `sum(lines[i].lineAmount)`  | —                      | `cbc:LineExtensionAmount[@currencyID]`     |
| BT-109 | Invoice total excl. VAT | `taxExclusiveAmount`        | §14 Abs. 4 Nr. 7 UStG | `cbc:TaxExclusiveAmount[@currencyID]`      |
| BT-110 | Total VAT amount        | `taxAmount`                  | §14 Abs. 4 Nr. 8 UStG | `cbc:TaxAmount[@currencyID]` (in TaxTotal) |
| BT-112 | Invoice total incl. VAT | `taxInclusiveAmount`        | —                      | `cbc:TaxInclusiveAmount[@currencyID]`      |
| BT-115 | Amount due for payment  | `duePayableAmount`          | —                      | `cbc:PayableAmount[@currencyID]`           |

### Invoice lines (BG-25)

One `cac:InvoiceLine` per entry in `lines`. Source: [en16931].

For a credit note (`typeCode` `381`), each line is `cac:CreditNoteLine` instead, and BT-129 (the
quantity element) is `cbc:CreditedQuantity` instead of `cbc:InvoicedQuantity` — per
`UBL-CreditNote-2.1.xsd`'s `CreditNoteLineType`. Everything else in the line-item table below is
identical between the two document types.

| BT     | Name                 | Internal field                    | Legal basis           | UBL element                                      |
| ------ | ---------------------- | ------------------------------------ | ----------------------- | --------------------------------------------------- |
| BT-126 | Line identifier      | `lines[i].id`                     | —                      | `cbc:ID`                                         |
| BT-129 | Invoiced quantity    | `lines[i].quantity`               | §14 Abs. 4 Nr. 5 UStG | `cbc:InvoicedQuantity`                           |
| BT-130 | Unit of measure code | `lines[i].unitCode`               | EN 16931 §6.4.4        | `cbc:InvoicedQuantity[@unitCode]`                |
| BT-131 | Line net amount      | `lines[i].lineAmount`             | —                      | `cbc:LineExtensionAmount[@currencyID]`           |
| BT-153 | Item name            | `lines[i].name`                   | §14 Abs. 4 Nr. 5 UStG | `cac:Item/cbc:Name`                              |
| BT-154 | Item description     | `lines[i].description` (optional) | —                      | `cac:Item/cbc:Description`                       |
| BT-151 | Line VAT category    | `lines[i].vatCategoryCode`        | EN 16931 §6.4.5        | `cac:Item/cac:ClassifiedTaxCategory/cbc:ID`      |
| BT-152 | Line VAT rate        | `lines[i].vatRate`                | §14 Abs. 4 Nr. 8 UStG | `cac:Item/cac:ClassifiedTaxCategory/cbc:Percent` |
| BT-146 | Item net price       | `lines[i].unitPrice`              | —                      | `cac:Price/cbc:PriceAmount[@currencyID]`         |

### Not yet mapped (deferred to Phase 3+)

- **BT-11**: Project reference
- **BT-12**: Contract reference (`contractReference` exists in schema but not emitted as a BT-12 element yet)
- **BT-13**: Purchase order reference (`purchaseOrderReference` exists in schema but not emitted yet)
- **BT-17**: Tender or lot reference
- **BG-24**: Additional supporting documents
- **BG-20 / BG-21**: Document-level allowances and charges
- **BG-27 / BG-28**: Line-level allowances and charges
- **BT-113**: Prepaid amount

---

## Planned hosted-platform database

This database design applies to the future hosted application (beta/developer signup forms, `src/backend`) and is **not** required by the core OpenInvoiceXML library — the engine itself (`core/`, `schemas/`, `validators/`, `adapters/`) is stateless and has no database dependency (see [`ARCHITECTURE.md`](ARCHITECTURE.md)).

Two tables, one per signup form (`src/db/001_create_beta_signups.sql`, `src/db/002_create_developer_signups.sql`). Both are plain Postgres tables with no separate migration tool — Postgres auto-runs every `.sql` file in `src/db/` on first boot of an empty data directory (see `docker-compose.yml`'s `postgres` service).

### `beta_signups`

| Column          | Type          | Constraint                   | Notes                                                                                 |
| ---------------- | -------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `id`            | `SERIAL`      | `PRIMARY KEY`                |                                                                                        |
| `name`          | `TEXT`        | required (API-level, not DB) |                                                                                        |
| `email`         | `TEXT`        | `NOT NULL UNIQUE`            | the only uniqueness constraint on this table                                          |
| `role`          | `TEXT`        | `NOT NULL`                   | e.g. `freelancer`, `small-business`, `other`                                          |
| `role_other`    | `TEXT`        | nullable                     | only set when `role = 'other'`; `NULL` otherwise, even if the client sends stray data |
| `message`       | `TEXT`        | nullable                     | optional "anything else?" field, beta form only                                       |
| `consent`       | `BOOLEAN`     | `NOT NULL`                   | GDPR consent checkbox                                                                 |
| `wants_contact` | `BOOLEAN`     | `NOT NULL DEFAULT false`     |                                                                                        |
| `created_at`    | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`     |                                                                                        |

### `developer_signups`

| Column          | Type          | Constraint                   | Notes                                                                  |
| ---------------- | -------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `id`            | `SERIAL`      | `PRIMARY KEY`                |                                                                         |
| `name`          | `TEXT`        | required (API-level, not DB) |                                                                         |
| `email`         | `TEXT`        | `NOT NULL UNIQUE`            | the only uniqueness constraint on this table                           |
| `role`          | `TEXT`        | `NOT NULL`                   | e.g. `software-developer`, `erp-developer`, `other`                    |
| `role_other`    | `TEXT`        | nullable                     | same rule as `beta_signups.role_other`                                 |
| `what_to_build` | `TEXT`        | nullable                     | developer form's free-text field (`beta_signups.message`'s equivalent) |
| `wants_contact` | `BOOLEAN`     | `NOT NULL DEFAULT false`     |                                                                         |
| `consent`       | `BOOLEAN`     | `NOT NULL`                   | GDPR consent checkbox                                                  |
| `created_at`    | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`     |                                                                         |

The two tables are independent — no foreign key between them. Someone can sign up for both the beta and the developer list with the same email; the `UNIQUE` constraint only prevents duplicates _within_ a single table.

### Duplicate signups: what "already_signed_up" means

`email` is the **only** column either table treats as unique — nothing else (`name`, `role`, `message`/`what_to_build`, etc.) is checked for duplicates, and a duplicate `email` is detected even if every other field in the new submission differs from the original row.

Flow (identical in `src/backend/src/800-beta/` and `.../900-developer/`, one file pair per form):

1. `routes.ts` calls `insert*Signup(request.body)` (`repository.ts`), a plain `INSERT`.
2. If `email` already exists, Postgres raises error code `23505` (`unique_violation`) instead of the row being inserted.
3. `repository.ts`'s `isUniqueViolation(err)` checks for exactly that code:
   ```ts
   export function isUniqueViolation(err: unknown): boolean {
     return (
       typeof err === "object" &&
       err !== null &&
       "code" in err &&
       (err as { code: unknown }).code === "23505"
     );
   }
   ```
4. `routes.ts`'s `catch` block reacts to the answer — this is the only place that actually produces the `"already_signed_up"` string:
   ```ts
   } catch (err) {
     if (isUniqueViolation(err)) {
       return reply.code(200).send({ status: "already_signed_up" });
     }
     request.log.error(err);
     return reply.code(500).send({ error: "internal error" });
   }
   ```
   Note this returns HTTP `200`, not an error status — a repeat signup is treated as a successful outcome from the client's point of view, not a failure.
5. On the frontend, `BetaForm.tsx`/`DeveloperForm.tsx` both treat `ok` (HTTP 2xx) as success regardless of which branch fired, and only pick a different message string based on `result.status`:
   ```ts
   text: result.status === "already_signed_up" ? t.alreadySignedUp : t.success,
   ```
   Nothing else about the UI differs — same green "success" styling either way, no second row inserted, and the new submission's other field values (name, role, etc.) are silently discarded rather than merged into the existing row.

This works safely only because each table has exactly one `UNIQUE` constraint. Neither `isUniqueViolation` nor `routes.ts` inspects _which_ column caused a `23505` — if a second `UNIQUE` column were ever added to either table, a violation on that new column would also be misreported as `already_signed_up`.

### Field length limits

Enforced by the `ajv` JSON-schema validation in `src/backend/src/800-beta/schema.ts` and `.../900-developer/schema.ts` (`bodySchema`) — this is the actual enforcement layer; a request exceeding these gets rejected with `400` before it ever reaches the database. The frontend forms (`BetaForm.tsx`/`DeveloperForm.tsx`) mirror the same numbers via each `<input>`/`<textarea>`'s `maxLength` attribute, but that's UX only (stops the browser from letting you type past it) — the backend schema is the source of truth.

| Field                                        | Max length | Notes                                                                                                                                                                                                |
| ---------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                       | 200        |                                                                                                                                                                                                        |
| `email`                                      | 320        | RFC 5321's actual maximum length for a valid email address — not arbitrary                                                                                                                           |
| `role`                                       | 50         |                                                                                                                                                                                                        |
| `roleOther`                                  | 100        | only validated/required when `role === "other"`                                                                                                                                                      |
| `message` (beta) / `whatToBuild` (developer) | 2000       | free-text "tell us more" field                                                                                                                                                                       |
| `website` (honeypot)                         | 200        | hidden field; any non-empty value here silently short-circuits the submission as spam (see `routes.ts`'s `if (website) return reply.code(201).send({ status: "ok" })` — accepted but never inserted) |

Both `email` (`minLength: 3`) and `name` (`minLength: 1`) also have a minimum; other fields have no minimum beyond what `required` already implies.

### Inspecting the data

```sh
make db-sql            # drops straight into psql (make db for a plain shell instead)
```

```sql
\dt                                      -- list tables
\d beta_signups                          -- describe columns
SELECT * FROM beta_signups;
SELECT * FROM developer_signups;
SELECT email, count(*) FROM beta_signups GROUP BY email HAVING count(*) > 1;  -- should always be empty
```

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-14]: https://www.gesetze-im-internet.de/ustg_1980/__14.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-6]: https://www.gesetze-im-internet.de/ustg_1980/__6.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
[xrechnung-config]: https://github.com/itplr-kosit/validator-configuration-xrechnung
[xrechnung-spec]: https://xeinkauf.de/xrechnung/
