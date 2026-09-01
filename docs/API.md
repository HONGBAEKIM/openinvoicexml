# API

Usage reference for the generation modules: `generateInvoice`/`toXRechnung` (XML), the hybrid
PDF/A-3 counterparts `generateHybridPdf`/`toHybridPdf`, and the `ValidationIssue` error-code
contract shared between them. `runKosit`, `runVeraPdf`, and `runMustang`/`extractWithMustang` are
documented separately at the end as optional, external validation layers.

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

## `generateHybridPdf(invoice, options)` — recommended entry point

```ts
import { generateHybridPdf } from "openinvoicexml/adapters";

const result = await generateHybridPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions`
- **Output:** `GenerateHybridPdfResult`

```ts
interface HybridPdfOptions {
  /** Defaults to "EN16931". */
  profile?: EInvoiceProfile;
}

type EInvoiceProfile = "XRECHNUNG" | "EN16931";

interface GenerateHybridPdfResult {
  /** The generated hybrid PDF bytes, or null if business-rule validation found an error. */
  pdf: Uint8Array | null;
  /** All business-rule issues found, including non-blocking warnings. */
  issues: ValidationIssue[];
}
```

Same gate as `generateInvoice`: runs `validateBusinessRules` first, and returns `pdf: null` with
the errors in `issues` if any issue is `severity: "error"`. Otherwise `pdf` contains a PDF/A-3b
invoice with the XRechnung UBL XML embedded as an associated file.

`profile` currently has no effect on generated output. Hybrid PDF generation currently embeds
the same UBL XRechnung XML for both supported values — `"EN16931"` is currently just an accepted
profile selection in the API, not a request for a separate generic EN 16931 serialization;
`toXRechnung()` always produces the same XRechnung UBL document regardless of which value is
passed. Only `"XRECHNUNG"` and `"EN16931"` are supported: this project's hybrid PDF embeds UBL,
and every Factur-X/ZUGFeRD conformance level (MINIMUM/BASIC WL/BASIC) requires CII — see
[`LIMITATIONS.md`](LIMITATIONS.md).

## `toHybridPdf(invoice, options)` — low-level building block

```ts
import { toHybridPdf } from "openinvoicexml/adapters";

const pdf: Uint8Array = await toHybridPdf(invoice);
```

- **Input:** `Invoice`, plus an optional `HybridPdfOptions` (same shape as above)
- **Output:** PDF/A-3b bytes (always produced, no validation)

`toHybridPdf` performs **no business-rule validation** — same relationship to `generateHybridPdf`
that `toXRechnung` has to `generateInvoice`. Use this only when you validate separately; otherwise
prefer `generateHybridPdf`. Check PDF/A-3b conformance separately with veraPDF (`runVeraPdf`,
below, or [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output)).

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
(`make kosit-setup`). See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for
setup and the `KositResult`/`KositIssue` shapes.

[kosit-validator]: https://github.com/itplr-kosit/validator

## `runVeraPdf(files, options)` — optional external validation

```ts
import { runVeraPdf } from "openinvoicexml/validators";

const results = runVeraPdf(["invoice.pdf"]);
```

A separate, optional layer: it shells out to the installed [veraPDF][verapdf-tool] CLI against
already-generated PDF files on disk. It's the PDF/A-3 counterpart to `runKosit` — confirms
ISO 19005-3 conformance for the hybrid PDF adapter's output — and requires veraPDF to be set up
with `make verapdf-setup`; that setup uses either a compatible system Java or the project's
portable JRE (no local Java install required beforehand). See
[`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for setup and the
`VeraPdfResult`/`VeraPdfIssue` shapes.

[verapdf-tool]: https://github.com/veraPDF/veraPDF-apps

## `runMustang(files, options)` / `extractWithMustang(pdfPath, options)` — optional external validation

```ts
import { runMustang, extractWithMustang } from "openinvoicexml/validators";

const extracted = extractWithMustang("invoice.pdf");
const results = runMustang(["invoice.xml"]);
```

A separate, optional layer: it shells out to the [Mustang Project][mustang-tool] CLI as an
independent, third-party second opinion alongside `runKosit`/`runVeraPdf`. `extractWithMustang`
recovers the embedded XML from a hybrid PDF using Mustang's own extractor — deliberately not this
project's own `extractEmbeddedXml()` (`adapters/hybrid-pdf.ts`) — so it can prove a hybrid PDF is
genuinely readable by an independent tool, not just self-consistent with this project's own code.
`runMustang` validates an XRechnung UBL XML file (or, as a secondary capability, a PDF directly)
against Mustang's own EN16931/XRechnung Schematron and XSD rules. Requires
`make mustang-setup`. See [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output) for
setup, the recommended extract-then-validate flow, and the `MustangResult`/`MustangIssue` shapes.

[mustang-tool]: https://github.com/ZUGFeRD/mustangproject
