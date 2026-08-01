# API

Usage reference for the XML generation module: `generateInvoice`, the lower-level
`toXRechnung`, and the `ValidationIssue` error-code contract between them. `runKosit` is
documented separately at the end as an optional, external validation layer.

For the `Invoice` input shape itself (fields, types, BT mapping), see
[`DATA-MODEL.md`](DATA-MODEL.md) rather than re-reading it here.

## `generateInvoice(invoice)` — recommended entry point

```ts
import { generateInvoice } from "openinvoicexml/adapters";

const result = generateInvoice(invoice);
```

- **Input:** `Invoice` (a fully-populated internal invoice object — see `DATA-MODEL.md`)
- **Output:** `GenerateInvoiceResult`

```ts
interface GenerateInvoiceResult {
  /** The generated XRechnung XML, or null if business-rule validation found an error. */
  xml: string | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}
```

`generateInvoice` runs [`validateBusinessRules`](#validationissue-error-code-contract) against
the invoice first. If any issue has `severity: "error"`, `xml` is `null` and the errors are
returned in `issues` — no XML is produced for a known-non-compliant invoice. Otherwise `xml`
contains the generated UBL 2.1 document (`issues` may still contain non-blocking `warning`
entries). Full XRechnung XSD and Schematron conformance should be checked separately with KoSIT.

```ts
const { xml, issues } = generateInvoice(invoice);

if (xml === null) {
  // issues contains at least one severity: "error" entry — do not send this invoice
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
} else {
  // xml passed OpenInvoiceXML's in-process business-rule validation
  writeFileSync("invoice.xml", xml);
}
```

## `toXRechnung(invoice)` — low-level building block

```ts
import { toXRechnung } from "openinvoicexml/adapters";

const xml: string = toXRechnung(invoice);
```

- **Input:** `Invoice`
- **Output:** a UBL 2.1 XML string (always produced — see caveat below)

`toXRechnung` performs **no business-rule validation**. It maps the invoice straight to XML
(see `adapters/xrechnung-mapping.ts` for the field-mapping step and `adapters/xrechnung.ts` for
serialization) and always returns a document, even one that would fail `validateBusinessRules`
or KoSIT. Use this only when you validate separately (your own pipeline, or a direct call to
`validateBusinessRules`/`runKosit`) — otherwise prefer `generateInvoice`.

TypeScript can catch structurally invalid input at compile time when callers use
the `Invoice` type correctly. Runtime input, such as parsed JSON or data cast to
`Invoice`, is not automatically validated by `toXRechnung` and should be checked
with the JSON Schema validator first (see `validators/test/00.invoice-schema.test.ts`)
if your input arrives as untyped JSON.

## `ValidationIssue` — error-code contract

`validateBusinessRules(invoice)` (used internally by `generateInvoice`, also importable
directly from `openinvoicexml/validators`) returns `ValidationIssue[]`:

```ts
interface ValidationIssue {
  /** Machine-readable rule identifier. */
  code: string;
  /** "error" blocks compliant output; "warning" is informational. */
  severity: "error" | "warning";
  /** Human-readable description, referencing the relevant BT/BG code. */
  message: string;
  /** Location of the offending field, e.g. "lines[1].vatRate" or "vatBreakdowns[0]". */
  path: string;
}
```

`code` is a stable, machine-matchable identifier — safe to switch on in calling code, unlike
`message`, which is meant for humans and may be reworded. Almost every current issue has
`severity: "error"`; the one exception is `PLACE_OF_SUPPLY_CROSS_BORDER`, which is
`"warning"`-severity and never blocks `generateInvoice()` (see the "Place of supply" section
in [`LIMITATIONS.md`](LIMITATIONS.md)).
A representative sample of the codes currently produced by `validators/02.business-rules.ts` and
`validators/rules/17.vat-rate.ts`:

| Code                                                                                                                                                      | Severity  | Meaning                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `VAT_RATE_INVALID_FOR_CATEGORY`                                                                                                                           | `error`   | Category `S` line/breakdown at a rate other than 19% or 7%, or a zero-rate category (`Z`/`E`/`AE`/`K`/`G`/`O`) at a non-zero rate |
| `MONETARY_AMOUNT_DECIMAL_PRECISION`                                                                                                                       | `error`   | A monetary amount has more than 2 decimal places                                                                                  |
| `LINE_AMOUNT_ROUNDING`                                                                                                                                    | `error`   | BT-131 line net amount doesn't match `quantity × unitPrice`                                                                       |
| `REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED`                                                                                                                    | `error`   | VAT category `AE` ([§13b reverse charge][ustg-13b]) used without a buyer VAT ID                                                               |
| `VAT_EXEMPTION_REASON_REQUIRED`                                                                                                                           | `error`   | VAT category requiring BT-120/BT-121 (`E`/`AE`/`K`/`G`/`O`) has neither an exemption reason nor code                              |
| `VAT_BREAKDOWN_RATE_MISMATCH`                                                                                                                             | `error`   | A `vatBreakdowns` entry has no matching invoice lines at that category/rate                                                       |
| `VAT_TAXABLE_AMOUNT_MISMATCH`                                                                                                                             | `error`   | BT-116 taxable amount doesn't match the sum of matching line amounts                                                              |
| `VAT_TAX_AMOUNT_ROUNDING`                                                                                                                                 | `error`   | BT-117 VAT amount doesn't match `taxableAmount × rate`                                                                            |
| `INVOICE_TAX_EXCLUSIVE_AMOUNT_MISMATCH` / `INVOICE_TAX_AMOUNT_MISMATCH` / `INVOICE_TAX_INCLUSIVE_AMOUNT_MISMATCH` / `INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH` | `error`   | Document-level totals (BT-109/110/112/115) don't reconcile against the VAT breakdown sums                                         |
| `PLACE_OF_SUPPLY_CROSS_BORDER`                                                                                                                            | `warning` | Seller/buyer countries differ — informational only, names which place of supply would apply for a B2B service                    |

This list isn't exhaustive by design — new codes are added as `validators/02.business-rules.ts`
grows (e.g. Phase 3's [§19][ustg-19]/[§13b][ustg-13b]-subcase/credit-note rules). Read the source directly for the
full, current set rather than treating this table as authoritative long-term.

## `runKosit(files, options)` — optional external validation

```ts
import { runKosit } from "openinvoicexml/validators";

const results = runKosit(["invoice.xml"]);
```

This is a separate, optional layer from the two functions above: it shells out to the official
[KoSIT validator][kosit-validator] (a Java CLI tool) against already-generated XML files on disk, and is
**additive** to `validateBusinessRules` — it confirms full XRechnung Schematron/XSD conformance
of the generated document, catching anything `validateBusinessRules` doesn't model directly.
It is not part of the in-process `generateInvoice`/`toXRechnung` pipeline and requires a local
Java + KoSIT jar setup (`make kosit-setup`) — see [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output)
for the full setup and usage guide, including the `KositResult`/`KositIssue` shapes.

[kosit-validator]: https://github.com/itplr-kosit/validator
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
