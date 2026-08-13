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

`generateInvoice` runs `validateBusinessRules` against the invoice first. If any issue has
`severity: "error"`, `xml` is `null` and the errors are returned in `issues` — no XML is
produced for a known-non-compliant invoice. Otherwise `xml` contains the generated UBL 2.1
document (`issues` may still contain non-blocking `warning` entries). This is `generateInvoice`'s
whole contract: compose validation + generation, gate output on error-severity issues, and
return a result instead of throwing. Full XRechnung XSD/Schematron conformance should still be
checked separately with KoSIT.

```ts
const { xml, issues } = generateInvoice(invoice);

if (xml === null) {
  // issues contains at least one severity: "error" entry — do not send this invoice
  for (const issue of issues) console.error(`${issue.code}: ${issue.message}`);
} else {
  writeFileSync("invoice.xml", xml);
}
```

## `toXRechnung(invoice)` — low-level building block

```ts
import { toXRechnung } from "openinvoicexml/adapters";

const xml: string = toXRechnung(invoice);
```

- **Input:** `Invoice`
- **Output:** a UBL 2.1 XML string (always produced, no validation)

`toXRechnung` performs **no business-rule validation** — it maps the invoice straight to XML
and always returns a document, even one that would fail `validateBusinessRules` or KoSIT. Use
this only when you validate separately; otherwise prefer `generateInvoice`. Runtime input (parsed
JSON, or data cast to `Invoice`) isn't validated by `toXRechnung` — check it against
`schemas/invoice.schema.json` with your own JSON Schema validator first if it arrives untyped.

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

`code` is a stable, machine-matchable identifier — safe to switch on, unlike `message`, which is
for humans. Almost every issue is `severity: "error"`; the one exception is
`PLACE_OF_SUPPLY_CROSS_BORDER` (`"warning"`, never blocks `generateInvoice` — see
[`LIMITATIONS.md`](LIMITATIONS.md)). A few representative codes:

| Code | Severity | Meaning |
| --- | --- | --- |
| `VAT_RATE_INVALID_FOR_CATEGORY` | `error` | Category `S` at a rate other than 19%/7%, or a zero-rate category at a non-zero rate |
| `LINE_AMOUNT_ROUNDING` | `error` | BT-131 line net amount doesn't match `quantity × unitPrice` |
| `REVERSE_CHARGE_BUYER_VAT_ID_REQUIRED` | `error` | Category `AE` used without a buyer VAT ID |
| `VAT_EXEMPTION_REASON_REQUIRED` | `error` | Exemption category (`E`/`AE`/`K`/`G`/`O`) missing a reason (BT-120/BT-121) |
| `PLACE_OF_SUPPLY_CROSS_BORDER` | `warning` | Seller/buyer countries differ — informational only |

Not exhaustive — see `validators/02.business-rules.ts` and `validators/rules/17.vat-rate.ts` for
the full, current set.

## `runKosit(files, options)` — optional external validation

```ts
import { runKosit } from "openinvoicexml/validators";

const results = runKosit(["invoice.xml"]);
```

A separate, optional layer: it shells out to the official [KoSIT validator][kosit-validator]
against already-generated XML files on disk. It's additive to `validateBusinessRules`, confirming
full XRechnung Schematron/XSD conformance — it isn't part of the in-process
`generateInvoice`/`toXRechnung` pipeline and requires a local Java + KoSIT jar setup
(`make kosit-setup`). See [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output) for setup
and the `KositResult`/`KositIssue` shapes.

[kosit-validator]: https://github.com/itplr-kosit/validator
