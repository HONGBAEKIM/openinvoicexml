# Data Model and Mapping

## Invoice schema

Internal invoice schema v0.1 — the single source of truth for all output adapters. Adapters
consume an internal `Invoice` object, never raw external input. A consumer with untyped JSON
input should validate it against `schemas/invoice.schema.json` themselves first (this package
uses AJV only in its own test suite — see [`ARCHITECTURE.md`](ARCHITECTURE.md#no-runtime-dependencies)).
Business-rule validation (VAT arithmetic, §13b buyer-VAT-ID requirement, etc.) is a separate
layer — `validateBusinessRules()` (see [`ARCHITECTURE.md`](ARCHITECTURE.md#validators)).

### Field naming conventions

- **camelCase** throughout, matching TypeScript.
- **Semantic names over accounting names**: `taxExclusiveAmount` rather than `netTotal`.
- **Abbreviations kept to a minimum**: only `id`, `vat`, `bic`, `iban`.
- **Sub-objects use flat nesting**: `seller.address.city`, not `sellerAddressCity` — aligns with
  the EN 16931 BG hierarchy.

### VAT category codes (BT-151 / BT-118)

| Code | Meaning             | Typical German context                                                                                  |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `S`  | Standard rate       | 19% or 7% (reduced)                                                                                     |
| `Z`  | Zero-rated          | Supply taxable at 0% (e.g. qualifying photovoltaic, [§12 Abs. 3 UStG][ustg-12], where supported)         |
| `E`  | Exempt              | [§4 UStG][ustg-4] exemptions; also [§19 UStG][ustg-19] small-business (Kleinunternehmer) supplies       |
| `AE` | Reverse charge      | [§13b UStG][ustg-13b] (construction, scrap metal, etc.)                                                  |
| `K`  | Intra-EU supply     | [§6a UStG][ustg-6a] (B2B cross-border within EU)                                                         |
| `G`  | Export (outside EU) | [§6 UStG][ustg-6] (third-country export)                                                                 |
| `O`  | Not subject to VAT  | Genuinely non-taxable transactions                                                                       |

Codes `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) are excluded — see [`LIMITATIONS.md`](LIMITATIONS.md).

### Design decisions

- **JSON Schema Draft-07, not Zod/TS-only** — language-independent, runtime-enforceable, usable
  outside the TypeScript ecosystem.
- **`additionalProperties: false` everywhere** — catches misnamed fields (e.g. `vatAmout`)
  immediately instead of causing a downstream null-pointer.
- **`number` for monetary amounts, not `string` or integer minor units** — simplest for callers;
  rounding/total-consistency is enforced by the business-rule validator, not the schema.
- **`lines`/`vatBreakdowns`: `minItems: 1`** — EN 16931 BR-16 requires at least one invoice line;
  enforced at the schema level so adapters never guard against empty arrays.
- **`issueDate`/`dueDate` as `format: date`** — YYYY-MM-DD only, avoiding locale-ambiguous formats
  like `09/06/2026`.
- **TS interfaces and the JSON Schema are maintained independently**, not generated from each
  other — intentional for v0.1, to keep both easy to read without tooling. Revisit later if the
  duplication becomes a maintenance problem.

### What is NOT validated here

Handled by `validateBusinessRules()` instead:

- VAT arithmetic (`taxAmount = taxableAmount × rate / 100`, `BR-CO-17`)
- Total cross-check (`taxInclusiveAmount = taxExclusiveAmount + taxAmount`, `BR-CO-15`)
- Reverse-charge buyer identifier (this project requires `buyer.vatId` for category `AE` — a
  stricter check than EN 16931's `BR-AE-02`, which also permits a legal registration ID)

Still genuinely unvalidated anywhere in the codebase:

- IBAN check digit (regex validates structure only, not the ISO 7064 MOD-97-10 checksum)

---

## XRechnung Business Term mapping

Maps XRechnung 3.x Business Terms (BT/BG) to internal `Invoice` fields and the UBL 2.1 XML
element they produce. This table is the single source of truth for the BT mapping.

### §14 Abs. 4 UStG numbering, for reference

| Nr. | Requires                                                          |
| --- | ------------------------------------------------------------------ |
| 1   | Full name and address of **both** supplier and recipient          |
| 2   | The **supplier's own** tax number (Finanzamt) or VAT ID           |
| 3   | The issue date                                                    |
| 4   | The unique, sequential invoice number                             |
| 5   | Quantity/type of goods, or scope/type of service                  |
| 6   | The date of delivery or service                                   |
| 7   | The consideration, broken down by tax rate/exemption              |
| 8   | The applicable tax rate and tax amount, or an exemption reference |

### Process control (BG-2)

| BT    | Name                     | Internal field        | Legal basis         | UBL element           |
| ----- | ------------------------ | ---------------------- | -------------------- | ----------------------- |
| BT-24 | Specification identifier | (hardcoded)           | —                    | `cbc:CustomizationID` |
| BT-23 | Business process type    | `businessProcessType` | XRechnung spec §2.5 | `cbc:ProfileID`       |

### Other invoice-level fields

| BT    | Name                   | Internal field          | Legal basis           | UBL element                                  |
| ----- | ----------------------- | ------------------------ | ----------------------- | ---------------------------------------------- |
| BT-1  | Invoice number         | `id`                    | §14 Abs. 4 Nr. 4 UStG | `cbc:ID`                                     |
| BT-2  | Issue date             | `issueDate`             | §14 Abs. 4 Nr. 3 UStG | `cbc:IssueDate`                              |
| BT-3  | Invoice type code      | `typeCode`              | EN 16931 §6.2.1       | `cbc:InvoiceTypeCode`                        |
| BT-22 | Note                   | `note` (optional)       | —                      | `cbc:Note`                                   |
| BT-5  | Document currency code | `currencyCode`          | EN 16931 §6.2.2       | `cbc:DocumentCurrencyCode`                   |
| BT-10 | Buyer reference        | `buyerReference` (opt.) | XRechnung spec §2.4   | `cbc:BuyerReference`                         |
| BT-9  | Payment due date       | `dueDate` (optional)    | —                      | `cbc:DueDate` (invoice root)                 |
| BT-25 | Preceding invoice number | `precedingInvoiceReference.id` (optional)        | EN 16931 §6.2.3 | `cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID`        |
| BT-26 | Preceding invoice issue date | `precedingInvoiceReference.issueDate` (optional) | EN 16931 §6.2.3 | `cac:BillingReference/cac:InvoiceDocumentReference/cbc:IssueDate` |
| BT-12 | Contract reference     | `contractReference` (optional) | —                      | `cac:ContractDocumentReference/cbc:ID`       |

Notes: BT-9 maps to the plain root-level `cbc:DueDate`, not `PaymentMeans`/`PaymentTerms` (both
discouraged by this profile's Schematron). Credit notes (`typeCode` `381`) render as a distinct
UBL `CreditNote` document, not an `Invoice` — no `cbc:DueDate` at all, since a credit reduces what's
owed rather than creating a new deadline. `precedingInvoiceReference` is a single object, not a
list — see [`LIMITATIONS.md`](LIMITATIONS.md) for why.

### Seller (BG-4)

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

Seller contact (BG-6) is mandatory under `BR-DE-2`, enforced via the JSON Schema. `Party.contact`
is shared with `buyer`, but only the seller's is required.

### Buyer (BG-7)

Same structure as seller, BT numbers shift to the BG-7 range.

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

### Delivery (BG-13) / Deliver-to address (BG-15)

Emitted only when `delivery`/`deliverTo` are present.

| BT    | Name                    | Internal field                             | Legal basis                             | UBL element                                                           |
| ----- | ------------------------ | --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| BT-72 | Actual delivery date    | `delivery.actualDeliveryDate` (optional)   | EN 16931 §6.4.6 / §14 Abs. 4 Nr. 6 UStG | `cac:Delivery/cbc:ActualDeliveryDate`                                 |
| BT-77 | Deliver-to city         | `delivery.deliverTo.city` (optional)       | XRechnung BR-DE-10                       | `cac:DeliveryLocation/cac:Address/cbc:CityName`                       |
| BT-78 | Deliver-to post code    | `delivery.deliverTo.postalCode` (optional) | XRechnung BR-DE-11                       | `cac:DeliveryLocation/cac:Address/cbc:PostalZone`                     |
| BT-80 | Deliver-to country code | `delivery.deliverTo.countryCode`           | EN 16931 §6.4.6 (BR-57)                  | `cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode` |

BT-72 (or BG-14, unsupported) is required for category `K` (`BR-IC-11`). BT-80 is required
whenever `deliverTo` is supplied (`BR-57`). BT-77/BT-78 are **not enforced** by this validator
even though XRechnung requires them whenever `deliverTo` is present — see [`LIMITATIONS.md`](LIMITATIONS.md).

### Payment means (BG-16)

Emitted only when `paymentMeans` is present.

| BT    | Name                      | Internal field                        | UBL element                                                       |
| ----- | -------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| BT-81 | Payment means code        | `paymentMeans.code`                   | `cbc:PaymentMeansCode`                                            |
| BT-84 | Payment account ID (IBAN) | `paymentMeans.iban` (optional)        | `cac:PayeeFinancialAccount/cbc:ID`                                |
| BT-85 | Payment account name      | `paymentMeans.accountName` (optional) | `cac:PayeeFinancialAccount/cbc:Name`                              |
| BT-86 | Payment service provider  | `paymentMeans.bic` (optional)         | `cac:PayeeFinancialAccount/cac:FinancialInstitutionBranch/cbc:ID` |

### VAT breakdown (BG-23)

One `cac:TaxSubtotal` per entry in `vatBreakdowns`.

| BT     | Name                  | Internal field                                    | Legal basis           | UBL element                      |
| ------ | ---------------------- | ---------------------------------------------------- | ----------------------- | ----------------------------------- |
| BT-116 | VAT taxable amount    | `vatBreakdowns[i].taxableAmount`                  | §14 Abs. 4 Nr. 7 UStG | `cbc:TaxableAmount[@currencyID]` |
| BT-117 | VAT amount            | `vatBreakdowns[i].taxAmount`                      | §14 Abs. 4 Nr. 8 UStG | `cbc:TaxAmount[@currencyID]`     |
| BT-118 | VAT category code     | `vatBreakdowns[i].categoryCode`                   | EN 16931 §6.3.3        | `cac:TaxCategory/cbc:ID`         |
| BT-119 | VAT category rate     | `vatBreakdowns[i].rate`                           | EN 16931 §6.3.3        | `cac:TaxCategory/cbc:Percent`    |
| BT-120 | Exemption reason      | `vatBreakdowns[i].exemptionReason` (optional)     | —                      | `cbc:TaxExemptionReason`         |
| BT-121 | Exemption reason code | `vatBreakdowns[i].exemptionReasonCode` (optional) | —                      | `cbc:TaxExemptionReasonCode`     |

### Document totals (BG-22)

| BT     | Name                    | Internal field / derivation | Legal basis           | UBL element                                |
| ------ | ------------------------ | ------------------------------ | ----------------------- | --------------------------------------------- |
| BT-106 | Sum of line net amounts | `sum(lines[i].lineAmount)`  | —                      | `cbc:LineExtensionAmount[@currencyID]`     |
| BT-109 | Invoice total excl. VAT | `taxExclusiveAmount`        | §14 Abs. 4 Nr. 7 UStG | `cbc:TaxExclusiveAmount[@currencyID]`      |
| BT-110 | Total VAT amount        | `taxAmount`                  | §14 Abs. 4 Nr. 8 UStG | `cbc:TaxAmount[@currencyID]` (in TaxTotal) |
| BT-112 | Invoice total incl. VAT | `taxInclusiveAmount`        | —                      | `cbc:TaxInclusiveAmount[@currencyID]`      |
| BT-113 | Prepaid amount (optional) | `prepaidAmount`            | —                      | `cbc:PrepaidAmount[@currencyID]`           |
| BT-115 | Amount due for payment  | `duePayableAmount`          | —                      | `cbc:PayableAmount[@currencyID]`           |

`duePayableAmount` must equal `taxInclusiveAmount - prepaidAmount`.

### Invoice lines (BG-25)

One `cac:InvoiceLine` per entry in `lines` (`cac:CreditNoteLine` / `cbc:CreditedQuantity` for
credit notes).

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

### Not yet mapped (deferred)

- **BT-11**: Project reference
- **BT-13**: Purchase order reference
- **BT-17**: Tender or lot reference
- **BG-24**: Additional supporting documents
- **BG-20 / BG-21**: Document-level allowances and charges
- **BG-27 / BG-28**: Line-level allowances and charges

---

## Planned hosted-platform database

Applies to the future hosted application (beta/developer signup forms, `src/backend`) — **not**
required by the core OpenInvoiceXML library, which is stateless (see [`ARCHITECTURE.md`](ARCHITECTURE.md)).

Two independent tables, one per signup form, plain Postgres, no separate migration tool
(`src/db/*.sql` auto-runs on first boot).

### `beta_signups`

| Column          | Type          | Constraint                   | Notes                                         |
| ---------------- | -------------- | ------------------------------ | ---------------------------------------------- |
| `id`            | `SERIAL`      | `PRIMARY KEY`                |                                                |
| `name`          | `TEXT`        | required (API-level, not DB) |                                                |
| `email`         | `TEXT`        | `NOT NULL UNIQUE`            | the only uniqueness constraint on this table  |
| `role`          | `TEXT`        | `NOT NULL`                   | e.g. `freelancer`, `small-business`, `other`  |
| `role_other`    | `TEXT`        | nullable                     | only set when `role = 'other'`                |
| `message`       | `TEXT`        | nullable                     | optional "anything else?" field               |
| `consent`       | `BOOLEAN`     | `NOT NULL`                   | GDPR consent checkbox                         |
| `wants_contact` | `BOOLEAN`     | `NOT NULL DEFAULT false`     |                                                |
| `created_at`    | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()`     |                                                |

### `developer_signups`

Same shape as `beta_signups`, with `what_to_build` in place of `message`.

A duplicate `email` on either table returns HTTP `200` with `{ status: "already_signed_up" }`
(Postgres `23505` unique-violation, caught in `repository.ts`/`routes.ts`) rather than an error —
a repeat signup is treated as a successful outcome from the client's perspective. Field length
limits are enforced by each route's `ajv` `bodySchema` (`name` 200, `email` 320, `role` 50,
`roleOther` 100, `message`/`whatToBuild` 2000); the frontend's `maxLength` attributes mirror these
for UX only.

```sh
make db-sql   # drops into psql (make db for a plain shell instead)
```

[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-6]: https://www.gesetze-im-internet.de/ustg_1980/__6.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
