# Invoice Schema

Internal invoice schema v0.1 — the single source of truth for all output adapters.

## Purpose and scope

The internal schema is the contract between user input and every downstream output module. The XML adapter, the PDF adapter, and any future adapters read **only** from a validated schema object — never from raw user input. This decoupling ensures that a change to the XML output format cannot corrupt the PDF output, and vice versa.

`schemas/invoice.schema.json` enforces **structural correctness**: field types, required fields, allowed enumerations, and value formats. Business-rule validation (VAT arithmetic consistency, cross-field constraints from EN 16931 Schematron, §13b buyer-VAT-ID requirement) is out of scope here and is deferred to a separate validator layer (planned for Week 7).

## Field naming conventions

- **camelCase** throughout, matching TypeScript conventions and avoiding conversion friction when the schema is consumed by TypeScript code.
- **Semantic names over accounting names**: `taxExclusiveAmount` rather than `netTotal`; `taxInclusiveAmount` rather than `grossTotal`. Semantic names survive translation to multiple output formats (EN 16931 XML, IBAN-PDF label, structured data export) without ambiguity.
- **Abbreviations kept to a minimum**: only `id`, `vat`, `bic`, `iban` are abbreviated. All other names spell out the concept in full.
- **Sub-objects use flat nesting**: `seller.address.city`, not `sellerAddressCity`. Flat nesting aligns with the EN 16931 BG (Business Group) hierarchy.

## BT mapping

See [`MAPPING.md`](MAPPING.md) for the full field ↔ BT ↔ UBL XML element table, including each
field's German/EU legal basis — that table is the single source of truth for the BT mapping;
it isn't repeated here to avoid the two documents drifting out of sync with each other.

## VAT category codes (BT-151 / BT-118)

| Code | Meaning             | Typical German context                                                                                  |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `S`  | Standard rate       | 19% or 7% (reduced)                                                                                     |
| `Z`  | Zero-rated          | Export within EU (proof required)                                                                       |
| `E`  | Exempt              | §4 UStG exemptions (doctors, insurance, etc.); also §19 UStG small-business (Kleinunternehmer) supplies |
| `AE` | Reverse charge      | §13b UStG (construction, scrap metal, etc.)                                                             |
| `K`  | Intra-EU supply     | §6a UStG (B2B cross-border within EU)                                                                   |
| `G`  | Export (outside EU) | §6 UStG (third-country export)                                                                          |
| `O`  | Not subject to VAT  | Genuinely non-taxable transactions                                                                      |

Codes `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) are excluded — see `LIMITATIONS.md`.

## Design decisions

### JSON Schema Draft-07, not TypeScript-only validation

The schema is expressed as a JSON Schema document (`schemas/invoice.schema.json`) rather than Zod schemas or TypeScript-only constructs. Reasons:

- **Format-agnostic**: JSON Schema can be consumed by tools written in any language (Java, Python, Rust) and is used by the KoSIT validation toolchain in Phase 2.
- **Runtime enforcement**: TypeScript interfaces in `core/types/` are erased at compile time. JSON Schema validation happens at runtime, which is when user-supplied data is actually present.
- **Separation of concerns**: The TypeScript interfaces in `core/types/` and the JSON Schema in `schemas/` both represent the same structure, but they serve different purposes. The schema is the authority for runtime validation; the interfaces are the authority for type safety in adapter code.

### `additionalProperties: false` at every level

Every object in the schema sets `"additionalProperties": false`. This catches misnamed fields immediately — a fixture with `vatAmout` instead of `vatAmount` fails validation rather than passing silently and causing a null-pointer error in an adapter. This is especially important because downstream adapters do direct property access by name.

### `number` for monetary amounts, not `string`

Amounts are stored as `number`. Alternatives considered:

- **String with fixed precision** (e.g. `"1000.00"`): avoids floating-point representation, but forces callers to parse before arithmetic and makes comparison error-prone.
- **Integer minor units** (e.g. `100000` = €1000.00): eliminates floating-point entirely, but requires all callers to know the currency's exponent and makes the schema harder to read.

The chosen approach: `number`. Callers are responsible for ensuring at most 2 decimal places. Rounding consistency (BR-CO-3 through BR-CO-15 in EN 16931) is enforced by the business-rule validator, not by JSON Schema.

### `lines: minItems: 1` and `vatBreakdowns: minItems: 1`

EN 16931 Business Rule BR-16 states "An invoice shall have at least one Invoice line". An invoice with zero lines is structurally invalid regardless of business context. Enforcing this at the schema level means adapters never need to guard against empty arrays.

### `issueDate` / `dueDate` as `format: date`

YYYY-MM-DD format is enforced by the `"date"` format keyword (validated by `ajv-formats`). This prevents locale-ambiguous formats like `09/06/2026` (June 9 or September 6?) from entering the system. XML adapters emit dates in ISO 8601 without any conversion.

## Relationship to TypeScript interfaces

The TypeScript interfaces in `core/types/` and `schemas/invoice.schema.json` express the same structure but are maintained independently in v0.1. Neither is auto-generated from the other.

This duplication is intentional at this stage — it keeps both representations easy to read and modify without tooling dependencies. Week 4 should evaluate adding `ts-json-schema-generator` to the build pipeline to generate the JSON Schema from the TypeScript interfaces, eliminating the duplication.

## What is NOT validated here

The following are intentionally deferred to the EN 16931 Schematron business-rule validator (planned for Week 7):

- **VAT arithmetic**: `vatBreakdown.taxAmount` must equal `taxableAmount × rate / 100` within rounding tolerance (BR-CO-17)
- **Total cross-check**: `taxInclusiveAmount` must equal `taxExclusiveAmount + taxAmount` (BR-CO-15)
- **Reverse-charge buyer VAT ID**: when `vatCategoryCode` is `AE`, the buyer must supply a `vatId` (BR-AE-10)
- **Credit note reference**: when `typeCode` is `381`, a `precedingInvoiceReference` must be present
- **IBAN check digit**: the IBAN regex validates structure but not the ISO 7064 MOD-97-10 check digit
