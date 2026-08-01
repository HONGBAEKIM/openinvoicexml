# Architecture

This document describes the architecture of `openinvoicexml`: how the modules fit together, how data flows through the system, and why the design decisions were made.

---

## Design Principle

The project is built around a **single internal schema** that serves as the source of truth for all invoice data. Every downstream module — validators, XML adapters, PDF adapters — reads only from this schema. No adapter ever touches raw user input directly.

This decoupling means:

- Input formats can change without touching output logic.
- Output adapters can be added, removed, or replaced independently.
- Validation runs against one consistent representation, not format-specific quirks.

---

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

1. **Input** arrives as a JSON object matching `schemas/invoice.schema.json`.
2. **Schema validation** checks structural completeness: required fields, types, formats, enums, value constraints. `schemas/invoice.schema.json` is the contract for this step, but this package doesn't run it at runtime or export a validation function for it — AJV is only used inside this repo's own test suite to check the schema against fixtures (see "No runtime dependencies" below). A consumer whose input arrives as untyped JSON (not already a TypeScript `Invoice`) is expected to validate it against `schemas/invoice.schema.json` themselves, with their own JSON Schema validator, before constructing an `Invoice`.
3. The validated object becomes an **internal `Invoice`** — a TypeScript interface with typed fields mapping to XRechnung Business Terms.
4. **Business rule validation** checks legal/arithmetic correctness: VAT category consistency, [§13b][ustg-13b] reverse-charge requirements, EN 16931 rounding rules, and document-level total coherence.
5. **Output adapters** transform the validated invoice into a target format. Each adapter is independent — adding or replacing one never touches the others.

---

## Module Map

```
openinvoicexml/
├── core/              Internal invoice model
├── schemas/           JSON Schema (machine-readable contract)
├── validators/        Validation logic (schema + business rules)
├── adapters/          Output format adapters (XML, PDF)
├── fixtures/          Example invoice JSON files
└── docs/              Project documentation
```

### `core/`

TypeScript type definitions for the internal invoice model. This is the contract that all other modules depend on.

| File                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `types/invoice.ts`       | `Invoice` interface — the root type with document-level fields (BT-1 through BT-115)  |
| `types/invoice-line.ts`  | `InvoiceLine` interface — a single line item (BG-25)                                  |
| `types/party.ts`         | `Party` interface — seller or buyer with address and identifiers (BG-4/BG-7)          |
| `types/vat-breakdown.ts` | `VatBreakdown` interface and `VatCategoryCode` union type (BG-23)                     |
| `utils/monetary.ts`      | `round2()` and `isClose()` — monetary rounding and comparison with EN 16931 tolerance |
| `index.ts`               | Re-exports all public types                                                           |

`core/` has **no dependencies** on any other module. It is pure types and utility functions.

### `schemas/`

| File                  | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `invoice.schema.json` | JSON Schema (Draft-07) defining the structure of a valid invoice |

The schema mirrors the TypeScript types in `core/` but is language-independent. This repo's own test suite uses AJV against it to check fixtures, and a consumer with untyped JSON input can validate it against this schema at runtime with their own JSON Schema validator (see "No runtime dependencies" below) — the package itself doesn't run this validation. The schema also serves as machine-readable documentation of the invoice format. It enforces:

- Required fields and their types
- String formats (ISO 8601 dates, ISO 4217 currency codes, ISO 3166-1 country codes)
- Enum constraints (invoice type codes, VAT category codes)
- Numeric bounds (VAT rate 0–100, quantities > 0)
- `additionalProperties: false` at every level to catch typos

### `validators/`

Three validation layers, each catching a different class of error:

| File                        | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `types.ts`                  | `ValidationIssue` interface — the return type for all validation           |
| `business-rules.ts`         | `validateBusinessRules()` — orchestrates the checks below plus inline VAT-arithmetic/document-total/place-of-supply checks |
| `rules/vat-rate.ts`         | VAT rate/category consistency, exemption-reason presence, decimal precision |
| `rules/small-business.ts`   | [§19 UStG][ustg-19] small-business exemption (category `E`)                           |
| `rules/outside-scope.ts`    | Category `O` (`BR-O-02`, see [en16931])                                                   |
| `rules/intra-eu.ts`         | Intra-EU supply (category `K`)                                            |
| `rules/export.ts`           | Export outside the EU (category `G`)                                      |
| `rules/reverse-charge.ts`   | [§13b UStG][ustg-13b] reverse-charge subcases (category `AE`)                         |
| `rules/delivery.ts`         | Deliver-to address (BG-15, `BR-57`, see [en16931])                                       |
| `kosit.ts`                  | `runKosit()` — wraps the external KoSIT validator (XSD/Schematron, not a TS business rule) |
| `index.ts`                  | Re-exports public API                                                     |
| `test/*.ts`                 | One test file per module above, plus the pipeline-level tests for `business-rules.ts` |

**Schema validation** (`invoice.schema.json`) catches structural errors: missing fields, wrong types, invalid formats. This package doesn't export a schema-validation function — `validators/test/invoice-schema.test.ts` uses AJV (a devDependency) to check the schema against fixtures during this repo's own tests. A consumer validating untyped JSON at runtime brings their own JSON Schema validator against `schemas/invoice.schema.json`.

**Business rule validation** (`validateBusinessRules()`) catches legal errors that valid JSON can still contain — see each `rules/*.ts` module above for its own scenario, plus these checks inline in `business-rules.ts` itself:

- VAT rate must match category (S requires 19% or 7%; Z/E/AE/K/G/O require 0%)
- Reverse charge (AE) requires buyer VAT ID ([§13b UStG][ustg-13b])
- Exemption categories (E/AE/K/G/O) require an exemption reason (BT-120 or BT-121)
- Line amounts must equal quantity × unit price (within rounding tolerance)
- VAT breakdown taxable amounts must equal the sum of matching line amounts
- Document-level totals must be internally consistent (BT-109, BT-110, BT-112, BT-115)
- All monetary amounts must have at most 2 decimal places
- Cross-border invoices get a warning-severity place-of-supply notice (never blocking) — see `docs/LIMITATIONS.md`

**KoSIT validation** (`kosit.ts`) is a separate, external mechanism: it shells out to the official Java validator to confirm the generated XML itself conforms to the XRechnung XSD/Schematron — see [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output). It doesn't replace `validateBusinessRules()`; the two catch different things (business-rule violations on the internal model vs. full Schematron conformance on the generated XML).

Validators return `ValidationIssue[]` — a flat array of plain objects. They never throw exceptions. Callers decide how to handle issues (log, display, block output).

### `adapters/`

Output adapters transform a validated `Invoice` into a specific format:

- **XRechnung XML adapter** — implemented (Phase 2, Weeks 5–8): UBL 2.1 XML targeting
  XRechnung 3.x. The adapter output is tested against KoSIT fixtures (see
  [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output)), while individual generated
  documents can be validated separately with `runKosit()` — neither `generateInvoice()` nor
  `toXRechnung()` runs KoSIT itself. `xrechnung-mapping.ts` handles BT-to-field resolution,
  `xrechnung.ts` handles serialization, and `generate-invoice.ts` composes
  `validateBusinessRules()` with `toXRechnung()` behind the recommended `generateInvoice()`
  entry point (see "Key Decisions" below).
- **Hybrid PDF/A-3 adapter** — not yet implemented (Phase 4, Weeks 13–16): PDF/A-3b with
  embedded XRechnung XML (Factur-X/ZUGFeRD).

Each adapter is an independent module. Adding a new output format means adding a new adapter — no changes to `core/`, `schemas/`, or `validators/`.

### `fixtures/`

Example invoice JSON files that validate against the schema. Each fixture represents a distinct legal scenario. Sources for the statutory citations below: [§4 UStG][ustg-4], [§13b UStG][ustg-13b], [§19 UStG][ustg-19], [§6a UStG][ustg-6a], [§6 UStG][ustg-6].

| Fixture                                            | Scenario                                          |
| --------------------------------------------------- | -------------------------------------------------- |
| `domestic-simple.invoice.json`                     | Standard domestic invoice, 19% VAT (S)            |
| `domestic-multi-line.invoice.json`                 | Multiple line items, 19% VAT (S)                  |
| `reduced-rate.invoice.json`                        | Reduced 7% VAT rate (S)                           |
| `zero-rated.invoice.json`                          | Zero-rated supply (Z)                             |
| `exempt.invoice.json`                               | VAT-exempt supply, [§4 UStG][ustg-4] (E)                    |
| `reverse-charge.invoice.json`                      | [§13b][ustg-13b] reverse charge, generic (AE)                 |
| `small-business.invoice.json`                      | [§19 UStG][ustg-19] Kleinunternehmer exemption (E)           |
| `intra-eu-supply.invoice.json`                     | Intra-EU supply, [§6a UStG][ustg-6a] (K)                     |
| `export.invoice.json`                              | Export outside the EU (G)                         |
| `reverse-charge-construction.invoice.json`         | [§13b][ustg-13b] Abs. 2 Nr. 4 construction services (AE)      |
| `reverse-charge-scrap-metal.invoice.json`          | [§13b][ustg-13b] Abs. 2 Nr. 7 scrap/waste, Anlage 3 (AE)      |
| `reverse-charge-security-transfer.invoice.json`    | [§13b][ustg-13b] Abs. 2 Nr. 2 security-asset transfer (AE)    |
| `reverse-charge-cleaning.invoice.json`             | [§13b][ustg-13b] Abs. 2 Nr. 8 building cleaning (AE)          |
| `reverse-charge-mobile-devices.invoice.json`       | [§13b][ustg-13b] Abs. 2 Nr. 10 mobile devices, Anlage 4 (AE)  |
| `reverse-charge-gas-and-electricity.invoice.json`  | [§13b][ustg-13b] Abs. 2 Nr. 5 gas/electricity (AE)            |

Fixtures serve three purposes: test inputs for automated tests, reference implementations for contributors, and documentation of supported scenarios. See [`LIMITATIONS.md`](LIMITATIONS.md) for which §13b subcases still lack a fixture.

---

## Key Decisions

### JSON Schema as the structural contract

The invoice structure is defined in JSON Schema (`schemas/invoice.schema.json`), not in a TypeScript-only validation library like Zod or io-ts.

**Why:** JSON Schema is language-independent. The schema can be consumed by tools in any language, used for code generation, embedded in API documentation, or handed to non-TypeScript collaborators. The TypeScript types in `core/` mirror the schema for compile-time safety, but the schema is the authority.

### No runtime dependencies

The engine has zero production dependencies. All dependencies (`ajv`, `vitest`, `eslint`, `prettier`, `typescript`) are devDependencies used only for development and testing — nothing in `core/`, `adapters/`, or the exported `validators/` API (`validateBusinessRules`, `runKosit`) imports `ajv`. `ajv` is used solely inside `validators/test/invoice-schema.test.ts` to check `schemas/invoice.schema.json` against the fixtures as part of this repo's own test suite; it is not exported for consumers to run JSON Schema validation at runtime. A consumer who needs to validate untyped JSON against the schema before building an `Invoice` supplies their own JSON Schema validator.

**Why:** A zero-dependency library is easier to embed, audit, and trust. Invoice processing is a sensitive domain — every dependency is a supply chain risk. This held even through the Phase 2 XML adapter: `adapters/xrechnung.ts` serializes UBL 2.1 XML directly rather than pulling in an XML-builder library. Runtime dependencies will only be added when genuinely necessary going forward.

### Validation returns data, not exceptions

`validateBusinessRules()` returns `ValidationIssue[]` instead of throwing. Each issue is a plain object with `code`, `severity`, `message`, and `path`.

**Why:** Invoices can have multiple independent errors. Throwing on the first one forces the caller into a try-catch-fix-retry loop. Returning all issues at once lets callers display a complete error report, batch-process fixes, or selectively ignore warnings.

### VAT rate for category "S" is restricted to 19%/7%

Category "S" (standard rate) only accepts the current German standard (19%) and reduced (7%) rates — `validators/rules/vat-rate.ts`'s `STANDARD_VAT_RATES`.

**Why:** The engine targets current German invoicing. Historical rates (Germany's COVID-era 16%/5%, July–December 2020) and other EU member states' EN 16931 rates are not validated today. Broader rate support is a documented future extension, not current behavior — see `docs/LIMITATIONS.md` — and would require widening `STANDARD_VAT_RATES` plus corresponding fixtures.

### `generateInvoice()` gates output on business-rule errors

`toXRechnung()` remains a pure, unchecked building block — it always serializes whatever `Invoice` it's given. `generateInvoice()` (in `adapters/generate-invoice.ts`) is the recommended entry point: it runs `validateBusinessRules()` first and only calls `toXRechnung()` if there are no error-severity issues, returning `{ xml, issues }`.

**Why:** Keeps `toXRechnung` and `validateBusinessRules` independently testable and composable — no forced coupling — while giving callers who want it a default that can't silently produce business-rule-invalid XML. It returns a structured result rather than throwing, consistent with "Validation returns data, not exceptions" below.

### Adapter pattern for output formats

Each output format is a separate adapter module that depends only on `core/` types. Adapters do not depend on each other.

**Why:** XRechnung XML and PDF/A-3 have completely different generation logic, dependencies, and validation toolchains (KoSIT vs. veraPDF). Coupling them would make both harder to test and maintain. The adapter pattern also makes it straightforward to add future formats (e.g., UN/CEFACT CII XML) without touching existing code.

---

## What This Architecture Does Not Include

These are explicitly out of scope for the current design:

- **Input adapters** (CSV import, REST API, GUI) — the engine accepts JSON objects directly. Input adapters are a consumer-side concern.
- **Persistence / database** — invoices are stateless objects. Storage is a consumer-side concern.
- **Authentication / multi-tenancy** — this is a library, not a web service.
- **Localization** — field names and error messages are in English. German legal terms are referenced in documentation but not in the API surface.

---

## Backend structure

This section describes the folder convention for `src/backend/src/`: the same numbered-prefix layout used for the frontend (see ["Frontend structure"](#frontend-structure) below). It's a target/reference structure — most numbered slices below don't exist yet, since today's backend only serves the beta-program and developer-feedback signup APIs. The near-term plan is a focused product, not a full multi-tenant SaaS: an XML-in/XML-out invoicing feature (wrapping the root-level engine) plus the existing beta/developer signups. There's no accounts/auth/billing system planned right now, so those speculative slices have been dropped from the example tree below — the numbering convention still reserves `300`–`600` for them if that ever changes.

### The convention

The numbered top-level folders use a **hybrid structure**:

- `000` through `200` contain shared infrastructure and application-level composition (config, middleware, route registration) — these are technical layers, not feature slices.
- `300` and above contain domain-oriented **feature slices**. Within a feature slice, its routes, service logic, schema, and types stay together instead of being separated globally by file type — e.g. the invoicing feature's route handler lives in `700-invoicing/routes.ts`, not in a global `200-routes/invoicing.ts`. `200-routes` only registers each feature's routes; it doesn't hold their implementations.
- Numbers normally increment in steps of 100, leaving room to insert an additional slice later without renumbering existing folders.
- Lower numbers are more foundational; higher numbers are more feature-specific.
- Planned slices are reserved in this document but don't need to exist as empty directories — create a new numbered folder when implementation actually starts, not ahead of it.
- The entrypoint (`index.ts`) stays at the `src/` root, not inside a numbered folder.

This is a convention, not a standard architecture — the numbers only buy predictable ordering and reserved room for growth. For a project this size, plain names (`core/`, `features/invoicing/`, ...) would work just as well; numbered slices are used here for 1:1 parity with the frontend structure.

### Slice numbers

| #       | Slice        | Meaning                                                                                                                                                                     |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 000     | `core`       | Shared config, types — no persistence, no feature/route logic                                                                                                               |
| 100     | `middleware` | Fastify plugins: CORS, error handling                                                                                                                                       |
| 200     | `routes`     | Route registration root, `/health` — registers each feature's routes, doesn't implement them                                                                                |
| 300–600 | _(reserved)_ | Not currently planned — available for future domain slices (e.g. authentication, customer accounts, billing) if the product grows beyond invoicing + beta/developer signups |
| 700     | `invoicing`  | Hosted service layer over the invoice engine — stateless, XML file in/out (planned — next feature)                                                                          |
| 800     | `beta`       | Beta-program signup API for end users — today's actual feature                                                                                                              |
| 900     | `developer`  | Developer feedback/interest API — today's actual feature                                                                                                                    |

`000`/`100`/`200` are backend-specific infrastructure concepts (there's no frontend equivalent of "middleware" or "route registration"). If a reserved domain slice (e.g. `300-authentication`) is ever built, use the same number on the frontend (["Frontend structure"](#frontend-structure) below) so the domain stays aligned across stacks.

### Relationship to the invoice engine

The root-level `core/`, `adapters/`, and `validators/` directories (documented above) are the standalone invoice-generation engine — they have no dependency on `src/backend` or any web-service concern. `700-invoicing` in the tree below is where the hosted API will call into that engine (e.g. accept an invoice file, run `generateInvoice()`, return the generated XML); it's a thin service wrapper, not a duplicate of the engine.

### Persistence

`800-beta` and `900-developer` each use their own database connection (Postgres, via their own `db.ts`) — persistence is a feature-specific dependency, not shared infrastructure, so each slice owns its own `Pool` rather than sharing one in `000-core`. `700-invoicing` is deliberately stateless: input and output are XML (files in, XML out via the engine), with no database involved. If a future slice ever needs persistence, add its own `db.ts` (or repository module) inside that slice rather than growing a shared one in `000-core` — that keeps each feature's storage dependency visible and independently replaceable, mirroring the adapter isolation already used in the invoice engine. See [`DATA-MODEL.md`](DATA-MODEL.md#planned-hosted-platform-database) for the current beta/developer signup table schemas.

### Target example tree

```
src/backend/src/
├── index.ts                      # entrypoint stays at src root
├── 000-core/
│   └── config.ts
├── 100-middleware/
│   └── cors.ts
├── 200-routes/
│   └── register-routes.ts         # registers betaRoutes(app), developerRoutes(app), ...
├── 700-invoicing/                  # planned — wraps root-level core/adapters/validators engine
│   ├── routes.ts
│   ├── schema.ts
│   ├── service.ts
│   └── file-handling.ts            # reads/writes the XML input/output files
├── 800-beta/
│   ├── routes.ts                   # POST /api/beta
│   ├── schema.ts
│   ├── repository.ts               # beta_signups queries
│   └── db.ts                       # pg pool — only used here
└── 900-developer/
    ├── routes.ts                   # POST /api/developer
    ├── schema.ts
    ├── repository.ts               # developer_signups queries
    └── db.ts                       # pg pool — only used here
```

`200-routes/register-routes.ts` is the central registration point — it imports and wires up each feature's `routes.ts`, but the route handlers themselves live inside their feature slice alongside the service/schema/repository code they depend on.

There's no centralized `100-middleware/error-handler.ts` yet — Fastify's default error handler covers uncaught errors, and each feature slice handles its own expected error cases inline in its `routes.ts` (e.g. `800-beta/routes.ts` and `900-developer/routes.ts` each catch their own unique-violation case). A dedicated error-handler middleware is reserved by the `100-middleware` convention but hasn't been needed yet. Everything else in this tree matches the actual current code for `000`–`200`, `800-beta`, and `900-developer`. `700-invoicing` is still aspirational — the files under it don't exist yet and are shown here as the planned shape once that feature starts.

---

## Frontend structure

This section describes the folder convention for `src/frontend/src/`: a numbered-prefix layout, already applied to the current code. The near-term plan is a focused product, not a full multi-tenant SaaS: an XML-in/XML-out invoicing UI (`700-invoicing`) plus the existing beta/developer signup forms. There's no accounts/auth/billing system planned right now, so those speculative slices aren't part of the tree below — the numbering convention still reserves `300`–`600` for them if that ever changes.

### The convention

The numbered top-level folders use a **hybrid structure**:

- `000` through `200` contain shared infrastructure and application-level composition (API client, styles, shared layout chrome, top-level page routing) — these are technical layers, not feature slices.
- `300` and above contain domain-oriented **feature slices**. Within a feature slice, its pages, components, hooks, and API calls stay together instead of being separated globally by file type — e.g. the invoicing feature's components will live in `700-invoicing/components/`, not scattered across a global `200-pages/`. `200-pages` holds only pages that aren't owned by a specific feature (the landing page, legal pages).
- Numbers normally increment in steps of 100, leaving room to insert an additional slice later without renumbering existing folders.
- Lower numbers are more foundational; higher numbers are more feature-specific.
- Planned slices are reserved in this document but don't need to exist as empty directories, and files inside an existing slice aren't created ahead of having real content to put in them (e.g. no `000-core/types.ts` until there's an actual shared type to move there).
- Entrypoint files (`main.tsx` and friends — anything wired up directly in `vite.config.ts` / `index.html`) stay at the `src/` root, not inside a numbered folder.

This is a convention, not a standard architecture — the numbers only buy predictable ordering and reserved room for growth. For a project this size, plain names (`core/`, `features/invoicing/`, ...) would work just as well; numbered slices are used here for 1:1 parity with the backend structure.

### Slice numbers

| #       | Slice        | Meaning                                                                                                                                                                     |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 000     | `core`       | Shared API client, styles — no feature/page logic                                                                                                                           |
| 100     | `layout`     | Shared chrome: `Header` (site brand link, shown on every page) and `Footer` (wrapper; each page passes its own footer content as children)                                  |
| 200     | `pages`      | Top-level pages not owned by a specific feature                                                                                                                             |
| 300–600 | _(reserved)_ | Not currently planned — available for future domain slices (e.g. authentication, customer accounts, billing) if the product grows beyond invoicing + beta/developer signups |
| 700     | `invoicing`  | UI for the XML invoice engine (planned — next feature)                                                                                                                      |
| 800     | `beta`       | Beta-program signup form for end users — today's actual feature                                                                                                             |
| 900     | `developer`  | Developer feedback form — today's actual feature                                                                                                                            |

`000`/`100`/`200` are frontend-specific infrastructure concepts (there's no backend equivalent of "layout" or "pages"). If a reserved domain slice (e.g. `300-authentication`) is ever built, use the same number on the backend (["Backend structure"](#backend-structure) above) so the domain stays aligned across stacks.

### Current tree

```
src/frontend/src/
├── main.tsx                     # entrypoints stay at src root, not numbered
├── impressum-main.tsx
├── privacy-main.tsx
├── beta-main.tsx
├── developer-main.tsx
├── 000-core/
│   ├── api.ts                    # shared fetch helper
│   ├── i18n.tsx                  # LanguageProvider/useLanguage — de/en, persisted to localStorage
│   └── style.css
├── 100-layout/
│   ├── Header.tsx                 # site brand link, rendered above <main> on every page
│   ├── Footer.tsx                 # shared wrapper; each page passes its own footer content as children
│   └── footer.i18n.ts             # Footer's de/en copy
├── 200-pages/
│   ├── App.tsx                   # landing page
│   ├── App.i18n.ts
│   ├── Impressum.tsx
│   ├── Impressum.i18n.ts
│   ├── Privacy.tsx
│   └── Privacy.i18n.ts
├── 700-invoicing/                 # planned — next feature, not built yet
│   ├── components/
│   │   ├── InvoiceForm.tsx
│   │   ├── XmlUpload.tsx
│   │   └── DownloadResult.tsx
│   └── api.ts
├── 800-beta/
│   ├── BetaPage.tsx               # standalone page, served at beta.html
│   ├── BetaPage.i18n.ts
│   ├── BetaForm.tsx
│   ├── BetaForm.i18n.ts
│   ├── StatusList.tsx
│   └── StatusList.i18n.ts
└── 900-developer/
    ├── DeveloperPage.tsx          # standalone page, served at developer.html
    ├── DeveloperPage.i18n.ts
    ├── DeveloperForm.tsx
    └── DeveloperForm.i18n.ts
```

Each page/component that renders user-facing text has a matching `*.i18n.ts` sibling file holding its `de`/`en` copy; `000-core/i18n.tsx` provides the `LanguageProvider`/`useLanguage` context those siblings are read through. `700-invoicing` is still aspirational — the files under it don't exist yet and are shown here as the planned shape once that feature starts. Everything else in this tree matches the actual code. Five HTML entry points now exist (`index.html`, `privacy.html`, `impressum.html`, `beta.html`, `developer.html`), each wired to its own `*-main.tsx` in `vite.config.ts`'s `build.rollupOptions.input` — still no client-side router needed since each page is a fully separate static entry.

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-6]: https://www.gesetze-im-internet.de/ustg_1980/__6.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
