# Architecture

How `openinvoicexml`'s modules fit together and why.

---

## Design Principle

The project is built around a **single internal schema** that serves as the source of truth for
all invoice data. Every downstream module — validators, XML adapters, PDF adapters — reads only
from this schema. No adapter ever touches raw user input directly. This means input formats can
change without touching output logic, output adapters can be added/removed independently, and
validation runs against one consistent representation.

## Data Flow

```
                          ┌─────────────────┐
                          │   JSON input     │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  JSON Schema     │
                          │  validation      │
                          │  (consumer-side) │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Internal        │
                          │  Invoice object  │
                          │  (TypeScript)    │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  Business rule   │
                          │  validation      │
                          └────────┬────────┘
                                   │
                        ┌──────────┴──────────┐
                        ▼                     ▼
               ┌─────────────────┐   ┌─────────────────┐
               │  XRechnung XML  │   │  Hybrid PDF/A-3 │
               │  adapter        │   │  adapter         │
               │  (implemented)  │   │  (planned)       │
               └─────────────────┘   └─────────────────┘
```

1. **Input** arrives as JSON matching `schemas/invoice.schema.json`.
2. **Schema validation** (consumer-side, not run by this package at runtime) checks structural
   completeness — see "No runtime dependencies" below.
3. The validated object becomes an **internal `Invoice`** — a TypeScript interface with fields
   mapping to XRechnung Business Terms.
4. **Business rule validation** checks legal/arithmetic correctness: VAT category consistency,
   §13b reverse-charge requirements, EN 16931 rounding rules, document-total coherence.
5. **Output adapters** transform the validated invoice into a target format, independently of
   each other.

## Module Map

| Directory     | Purpose                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `core/`       | TypeScript types for the internal invoice model — no dependencies on any other module                                    |
| `schemas/`    | `invoice.schema.json` (JSON Schema, Draft-07) — the language-independent structural contract                             |
| `validators/` | `validateBusinessRules()` + per-scenario `rules/*.ts`, plus `runKosit()` for external XML validation                     |
| `adapters/`   | Output adapters (XRechnung XML implemented, PDF/A-3 planned)                                                             |
| `fixtures/`   | Example invoice JSON files, one per legal scenario — see [`fixtures/README.md`](../fixtures/README.md) for the full list |
| `docs/`       | Project documentation                                                                                                    |

### `validators/`

Three layers, each catching a different class of error:

- **Schema validation** (`invoice.schema.json`) — structural errors: missing fields, wrong
  types, invalid formats. Not run automatically by this package; a consumer with untyped JSON
  input validates it themselves before constructing an `Invoice`.
- **Business rule validation** (`validateBusinessRules()`, in `02.business-rules.ts` +
  `rules/*.ts`) — legal errors valid JSON can still contain: VAT rate/category consistency,
  reverse-charge/exemption requirements, line and document total arithmetic. Returns
  `ValidationIssue[]`, never throws.
- **KoSIT validation** (`90.kosit.ts`) — a separate, external mechanism confirming the generated
  XML conforms to the XRechnung XSD/Schematron. See
  [`COMPLIANCE.md`](COMPLIANCE.md#validating-this-projects-output).

### `adapters/`

- **XRechnung XML adapter** — implemented: UBL 2.1 XML targeting XRechnung 3.x.
  `xrechnung-mapping.ts` handles BT-to-field resolution, `xrechnung.ts` handles serialization,
  and `generate-invoice.ts` composes `validateBusinessRules()` with `toXRechnung()` behind the
  `generateInvoice()` entry point (see [`API.md`](API.md)).
- **Hybrid PDF/A-3 adapter** — not yet implemented (planned, see [`ROADMAP.md`](ROADMAP.md)).

---

## Key Decisions

- **JSON Schema, not TypeScript-only validation** — language-independent, so it can be consumed
  by non-TypeScript tooling and collaborators.
- **No runtime dependencies** — see below.
- **Validation returns data, not exceptions** — `validateBusinessRules()` returns
  `ValidationIssue[]` so callers can see every issue at once instead of catch-fix-retry.
- **`generateInvoice()` gates output on business-rule errors** — see [`API.md`](API.md) for the
  full contract.
- **Adapter pattern for output formats** — each format is an independent module depending only
  on `core/` types, so XML and PDF generation/validation stay decoupled.

### No runtime dependencies

The engine has exactly two production dependencies, both scoped solely to the hybrid PDF/A-3
adapter (`adapters/hybrid-pdf.ts`/`adapters/hybrid-pdf-mapping.ts`):
[`@cantoo/pdf-lib`](https://github.com/cantoo-scribe/pdf-lib) and
[`fontkit`](https://github.com/foliojs/fontkit) (the font engine `@cantoo/pdf-lib` requires,
registered via `PDFDocument.registerFontkit()`, to embed a custom TTF font — it doesn't bundle one
itself). PDF/A-3 conformance — font subsetting, ICC output intents, embedded-file attachments with
`AFRelationship`, XMP metadata — isn't something that can reasonably be hand-rolled the way
XRechnung's XML serialization was; these are a deliberate, narrowly scoped exception, not an
abandonment of the zero-dependency stance for the rest of the engine. `ajv`, `vitest`, `eslint`,
`prettier`, and `typescript` remain devDependencies used only for this repo's own build/test/lint,
not exported for consumers. `ajv` in particular is used solely inside
`validators/test/00.invoice-schema.test.ts` to check `schemas/invoice.schema.json` against
fixtures; it's not part of the runtime API. A consumer validating untyped JSON supplies their own
JSON Schema validator. **Why:** minimizing dependencies keeps the library easy to embed, audit,
and trust — invoice processing is a sensitive domain, and every dependency is a supply-chain
risk — so each one added, including this one, should be a deliberate, justified exception rather
than a default.

---

## Backend & Frontend structure

Both `src/backend/src/` and `src/frontend/src/` use the same numbered-prefix convention:

- `000`–`200` = shared infrastructure and app-level composition (config, middleware, routing on
  the backend; API client, layout, top-level pages on the frontend) — technical layers, not
  feature slices.
- `300` and above = domain-oriented **feature slices**, each keeping its routes/pages,
  components, and logic together rather than split globally by file type.
- Numbers step by 100, leaving room to insert a slice later without renumbering.
- `300`–`600` are reserved but unused today — there's no accounts/auth/billing system planned;
  the near-term scope is just the invoicing feature plus the existing beta/developer signups.
- This is a convention for predictable ordering and 1:1 backend/frontend parity, not a standard
  architecture — plain names would work fine at this project's size.

| #           | Slice                                         | Status                                              |
| ----------- | --------------------------------------------- | --------------------------------------------------- |
| 000/100/200 | core / middleware-or-layout / routes-or-pages | Implemented (infra)                                 |
| 300–600     | _(reserved)_                                  | Not planned                                         |
| 700         | `invoicing`                                   | Planned — next feature, wraps the root-level engine |
| 800         | `beta`                                        | Implemented — beta-program signup                   |
| 900         | `developer`                                   | Implemented — developer feedback signup             |

The root-level `core/`, `adapters/`, and `validators/` (documented above) are the standalone
invoice engine — no dependency on `src/backend` or any web-service concern. `700-invoicing` is
where the future hosted API/UI will call into that engine. `800-beta` and `900-developer` each
own their own Postgres connection (no shared pool in `000-core`) — see
[`DATA-MODEL.md`](DATA-MODEL.md#planned-hosted-platform-database) for their table schemas.
