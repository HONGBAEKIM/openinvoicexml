# Roadmap

From 2028 onward, all domestic B2B invoices in Germany must be issued as a structured electronic invoice (e.g., XRechnung XML). Hybrid PDF/A-3 (Factur-X/ZUGFeRD) is a combined human-readable and machine-readable e-invoice format (PDF with embedded XML).

### Work Packages

| Work Package                           | Period                 | Focus                                                               |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| WP1 – Architecture & Internal Schema   | Weeks 1–4 (4 weeks)    | Internal schema design, repo setup, modular architecture foundation |
| WP2 – XML Engine & Validation          | Weeks 5–8 (4 weeks)    | XRechnung generation + local validation                             |
| WP3 – Legal Compliance & Test Fixtures | Weeks 9–12 (4 weeks)   | VAT scenarios, invoice types, fixture validation                    |
| WP4 – Hybrid PDF/A-3 Export            | Weeks 13–16 (4 weeks)  | Hybrid export + profile support                                     |
| WP5 – Stabilization & Release Prep     | Weeks 17–26 (10 weeks) | Testing, documentation, hardening, release prep                     |

---

## Phase 1 – Architecture & Internal Schema

**Deliverable:** Public GitHub repository with runnable local development setup, documented internal invoice schema, and modular architecture documentation. XML generation, hybrid export, and validation integration begin in Phase 2.

### Week 1 (1 Jun – 7 Jun)

- [ ] Create repo + initial skeleton
- [ ] Add README quickstart

Detailed tasks:

- Create public GitHub repository under an open-source license (Apache-2.0); set up branch protection, issue templates, and PR template
- Initialize project skeleton with clear module directory structure: `/core`, `/adapters`, `/validators`, `/fixtures`, `/docs`
- Write README with quickstart guide: prerequisites, local dev setup instructions, how to run tests, links to docs
- Add `.editorconfig`, `.gitignore`, and code style configuration (e.g. Prettier / ESLint or equivalent for chosen stack)

> **Why this matters:** A clean, well-documented repo from day one signals project credibility and makes onboarding contributors or reviewers effortless later in Phase 5.

### Week 2 (8 Jun – 14 Jun)

- [ ] Draft internal invoice schema v0.1
- [ ] Add 2 example invoice JSON files
- [ ] Add schema validation test

Detailed tasks:

- Draft internal invoice schema v0.1 as a JSON Schema document covering mandatory XRechnung fields: invoice number, issue date, seller/buyer identifiers, line items, totals, payment terms
- Document the purpose of each field: which EU/German legal requirement it satisfies, and which XRechnung BT (Business Term) it maps to
- Create 2 example invoice JSON files that validate against the schema: one simple domestic invoice, one with multiple line items
- Write a schema validation test using a JSON Schema validator library — test must pass in CI
- Add a `DATA-MODEL.md` file explaining the design decisions and field naming conventions

> **Key design decision:** The internal schema is the single source of truth that decouples user input from output formats. Every downstream module (XML adapter, PDF adapter) reads only from this schema — never directly from raw user input.

### Week 3 (15 Jun – 21 Jun)

- [ ] Expand schema (VAT block, references, payment terms)
- [ ] Add 3 more example invoices
- [ ] Add normalization spec

Detailed tasks:

- Expand schema with a dedicated VAT block: VAT category code (S, Z, E, AE, K, G, O), VAT rate, taxable amount, VAT amount — aligned with EN 16931 tax breakdown requirements
- Add document-level reference fields: preceding invoice reference (for corrections), contract reference, purchase order reference, project reference
- Add payment terms block: due date, payment means code, IBAN/BIC for bank transfer, payment reference text
- Add allowances and charges block at both document and line level
- Create 3 additional example invoice JSON files covering: VAT-exempt invoice, invoice with discount, invoice referencing a contract
- Write a normalization spec document describing how raw input is cleaned and normalized before validation (e.g. date formats, decimal precision, whitespace trimming)

> **Legal context:** German invoices under [§14 UStG][ustg-14] must include specific VAT breakdowns. The VAT block structure here directly mirrors the XRechnung BG-23 (VAT breakdown) group, making XML mapping straightforward in Phase 2.

### Week 4 (22 Jun – 28 Jun)

- [ ] Write `ARCHITECTURE.md`
- [ ] Add roadmap doc
- [ ] Tag release v0.1.0

Detailed tasks:

- Write `ARCHITECTURE.md`: describe the adapter pattern (input normalizer → internal schema → output adapter), module boundaries, data flow diagram, and rationale for key decisions
- Write `ROADMAP.md`: describe all 5 phases with goals, non-goals, and open questions for community input
- Write `DEVELOPMENT.md`: how to file issues, how to propose changes, code style requirements, how to run the test suite locally
- Add a `LIMITATIONS.md` noting what is NOT supported in v0.1.0 (no XML output yet, no PDF output yet, limited VAT scenarios)
- Tag release v0.1.0 with a release note summarizing what is included

> **Why document early:** Architecture docs written before the code is complex are cleaner and more honest. They also serve as the specification for Phase 2 implementation, reducing ambiguity.

**Milestone: Stable internal invoice schema and modular architecture foundation.**

---

## Phase 2 – XML Engine & Validation

**Deliverable:** Structured JSON → compliant XRechnung XML generation with local validator integration.

### Week 5 (29 Jun – 5 Jul)

- [ ] Implement XRechnung output adapter
- [ ] Generate first XML draft

Detailed tasks:

- Implement the XRechnung output adapter: a module that accepts a normalized internal invoice object and produces a UBL 2.1 XML document conforming to the XRechnung 3.x specification
- Map all mandatory internal schema fields to their corresponding XRechnung Business Terms (BT-1 through BT-130 range for core fields)
- Generate the first XML draft from one of the Week 2 example invoices and inspect it manually against the XRechnung specification PDF
- Add XML generation as a new CI step: generate XML from all example fixtures, check output is well-formed XML
- Document the BT mapping table in `DATA-MODEL.md` for transparency and future reference

> **Technical note:** XRechnung supports both UBL 2.1 and UN/CEFACT CII syntax. UBL 2.1 is recommended as the primary target because it is more widely supported in German toolchains and has better library support.

### Week 6 (6 Jul – 12 Jul)

- [ ] Integrate KoSIT validator
- [ ] Fix structural issues

Detailed tasks:

- Integrate the KoSIT Validator (`validationtool`) as an automated validation step: either via CLI subprocess call or by embedding the Java-based validator in the build pipeline
- Run all generated XML fixtures through KoSIT and capture the validation report (errors, warnings, notices)
- Triage and fix all structural validation errors reported by KoSIT in the Week 5 XML output
- Add a validation result summary to CI output so that any XML regression is immediately visible
- Document the KoSIT setup process (Java version requirement, downloading scenarios, running locally) in the README developer section

> **KoSIT is the authority:** Only XML that passes KoSIT validation with zero errors is considered compliant. Warnings are acceptable but should be documented. This makes KoSIT the single definition of "done" for all XML output throughout the project.

### Week 7 (13 Jul – 19 Jul)

- [ ] Implement structured VAT rule enforcement logic
- [ ] Add automated test cases
- [ ] Build user onboarding area (beta signup) in frontend

Detailed tasks:

- Implement structured VAT rule enforcement: a validation layer that checks VAT category code consistency (e.g. if category is AE/reverse charge, buyer VAT ID must be present; if category is S, rate must be 19% or 7%)
- Implement rounding rules per EN 16931: line amounts must be rounded to 2 decimal places; total VAT must equal sum of line-level VAT amounts within tolerance
- Write automated test cases covering: standard 19% VAT, reduced 7% VAT, VAT-exempt (E), zero-rated (Z), and at least one reverse-charge (AE) scenario
- Ensure all test cases pass KoSIT validation — add KoSIT check to the automated test runner
- Log all VAT rule violations with a human-readable error message that can be surfaced to the end user
- Wire `validateBusinessRules` into a new `generateInvoice()` pipeline (schema → business rules → XML) so any error-severity issue blocks XML output by default; `toXRechnung` remains available unchanged as the lower-level building block for callers who validate separately
- Add a basic CI workflow (`.github/workflows/ci.yml`) running `test` + `typecheck` + `validate-kosit` on every push/PR, before Phase 3 broadens the fixture set — cheap now (public repo, so GitHub Actions runners are free and unlimited) and pays off once the fixture count triples in Weeks 9–12;
- Note: a GitHub Pages deployment workflow for the Second-Stage frontend prototype (`.github/workflows/deploy-frontend.yml`) shipped ahead of schedule during Week 7's parallel frontend work — it only builds/publishes `src/frontend`, and does not include the `test`/`typecheck`/`validate-kosit` steps above, which remain scoped to this week
- Note: a user onboarding area (`beta.html` / `BetaPage` / `BetaForm`) is also being built ahead of schedule this week as part of the parallel frontend work — a simple signup form so people can register interest in the beta program; this is normally Phase 7 (User Onboarding & Public Beta) scope, started early alongside the frontend prototype
- Open `openinvoicexml.de` to the public once DNS/VPS deployment is complete — beyond collecting beta/developer signups through `beta.html`/`developer.html`, the launch itself is a demand-validation signal (visits, signup conversion) for whether Phase 6's hosted service is worth building

> **Why enforcement matters:** XRechnung uses Schematron rules (not just XSD) for business-level validation. Many conformance errors come from valid XML that violates business rules — e.g. a reverse-charge invoice missing the buyer's VAT ID. Catching these before KoSIT submission improves developer experience significantly.

### Week 8 (20 Jul – 26 Jul)

- [ ] Stabilize XML generation
- [ ] Tag release v0.2.0

Detailed tasks:

- Stabilize XML generation: fix any remaining KoSIT validation errors across all existing fixtures; aim for 100% pass rate on all current test invoices
- Refactor XML adapter for clarity: separate field mapping logic from XML serialization logic so each can be tested independently
- Write API usage documentation for the XML generation module (input format, output format, error codes)
- Tag release v0.2.0 with a detailed changelog listing which XRechnung BTs are now supported and which are deferred to Phase 3

> **Scope note:** v0.2.0 covers standard invoice scenarios. Complex legal scenarios ([§19][ustg-19] small business, reverse charge subcases, intra-EU supplies, credit notes) are explicitly deferred to Phase 3 and documented as known limitations.

**Milestone: Compliant XRechnung generation validated locally.**

---

## Phase 3 – German Law Compliance Depth & Test Fixtures

**Deliverable:** Expanded VAT/legal scenario logic + 30+ KoSIT-validated fixtures.

### Week 9 (27 Jul – 2 Aug)

- [ ] Implement [§19][ustg-19] small business regulation, [§13b][ustg-13b] reverse charge subcases, intra-EU supply/export, place-of-supply rules

Detailed tasks:

- **[§19 UStG][ustg-19] (Kleinunternehmerregelung):** Implement logic for small business invoices where VAT is not charged. The invoice must include the correct exemption notice text, no VAT amount, and VAT category code O. Validate the mandatory legal notice is present in the XML.
- **[§13b UStG][ustg-13b] (reverse charge) subcases:** Implement the 5+ reverse-charge subcases — domestic construction services, security services, cleaning services, scrap metal, mobile phones/integrated circuits, gas/electricity via network. Each has distinct buyer VAT ID requirements and VAT exemption reason text.
- **Intra-EU supply:** Implement zero-rated intra-EU goods supply (VAT category K) — seller and buyer must have valid EU VAT IDs, VAT exemption reason "intra-community supply" must be present in XML.
- **Export outside EU:** Implement VAT category G (zero-rated export) — no VAT, correct exemption code, optional customs reference support.
- **Place-of-supply rules:** Implement basic place-of-supply detection for services: default to seller country, override for B2B services to buyer country. Log a warning when place-of-supply affects VAT treatment so users can verify manually.

> **Legal complexity:** [§13b][ustg-13b] alone has 14 distinct subcases in German law, each with different triggering conditions. The implementation will cover the 5 most common ones affecting freelancers and micro-businesses; remaining subcases will be noted in `LIMITATIONS.md`.

### Week 10 (3 Aug – 9 Aug)

- [ ] Add credit notes and correction workflows

Detailed tasks:

- Implement credit note generation (XRechnung document type code 381): must reference the original invoice number and issue date, negate line amounts, and recalculate totals
- Implement corrective invoice (document type 384): partial correction workflow where only specific line items are amended — original invoice remains valid for uncorrected lines
- Validate that credit note XML passes KoSIT with type code 381 and that the preceding invoice reference (BT-25, BT-26) is correctly populated
- Add business rule: a credit note cannot have a positive total payable amount — add pre-validation check with a clear error message
- Write 3 fixture scenarios: full credit note, partial credit note, corrective invoice with amended line items

> **Real-world importance:** Credit notes are one of the most common invoice corrections freelancers need. A missing or incorrectly structured credit note can create VAT reconciliation problems for both parties.

### Week 11 (10 Aug – 16 Aug)

- [ ] Add partial/final/down payment invoice types

Detailed tasks:

- Implement down payment (Anzahlungsrechnung) invoice: a separate invoice for an advance payment, with its own VAT calculation at the time of payment
- Implement final invoice (Schlussrechnung) that references one or more prior down payment invoices and deducts the already-paid amounts from the final total — this must be reflected correctly in the XML prepaid amount fields
- Implement partial delivery invoice (Teilrechnung): invoice for a subset of a larger delivery or project, with references to the overall contract value and remaining balance
- Ensure that referenced down payment amounts carry their original VAT treatment correctly into the final invoice (VAT on down payments follows the time-of-payment principle in Germany)
- Add 3 fixture scenarios: a down payment invoice, its corresponding final invoice, and a standalone partial delivery invoice

> **Practical note:** Many freelancers working on long-term projects issue down payment invoices. The interaction between down payment VAT and final invoice VAT is a common source of errors — getting this right in the engine is a genuine compliance win for users.

### Week 12 (17 Aug – 23 Aug)

- [ ] Build 30+ legally distinct invoice fixtures based on real-world scenarios
- [ ] Validate all fixtures via KoSIT
- [ ] Tag release v0.3.0

Detailed tasks:

- Build a fixture library of 30+ legally distinct invoice scenarios, each with: a JSON input file, the expected XML output, KoSIT validation result, and a short description of which legal rule or scenario it tests
- Fixture coverage must include: standard 19% VAT, 7% VAT, 0% VAT (export), VAT-exempt ([§19][ustg-19]), reverse-charge domestic, reverse-charge intra-EU, intra-EU supply, credit note (full), credit note (partial), corrective invoice, down payment invoice, final invoice with deduction, partial delivery invoice, invoice with discount, invoice with surcharge, invoice with multiple VAT rates on same document, invoice with payment in advance, invoice referencing a contract, invoice referencing a purchase order
- Run all 30+ fixtures through KoSIT validator in CI — all must pass with zero errors
- Tag release v0.3.0 with complete fixture index in the release notes

> **Why fixtures matter:** The fixture library is the primary deliverable of Phase 3. It is both a test suite and a public documentation resource — other developers building on XRechnung can use these fixtures as reference implementations for each legal scenario.

**Milestone: All major German VAT and invoice-type scenarios implemented in logic and validated through 30+ KoSIT-tested fixtures; release v0.3.0 published.**

---

## Phase 4 – Hybrid PDF/A-3 Export Hardening & Profile Support

**Deliverable:** Stable hybrid PDF/A-3 export module with support for relevant Factur-X/ZUGFeRD profiles, validated across 40+ KoSIT-tested invoice scenarios and packaged as release v0.4.0.

### Week 13 (24 Aug – 30 Aug)

- [ ] Implement PDF/A-3 generation

Detailed tasks:

- Implement a PDF/A-3b generation module that accepts a normalized internal invoice and produces a human-readable PDF invoice following German invoice layout conventions (header, line items table, totals, payment info)
- Embed the compliant XRechnung XML as an attachment within the PDF using the PDF/A-3 embedded file stream mechanism (`AFRelationship = Alternative`)
- Ensure PDF metadata (XMP) correctly declares conformance to PDF/A-3b: `pdfaid:conformance=B`, `pdfaid:part=3`
- Embed correct ZUGFeRD/Factur-X XMP metadata extension schema in the PDF so it is recognized by receiving systems
- Generate first hybrid PDF from one of the Phase 3 fixtures and verify the XML attachment is extractable and intact

> **Technical note:** PDF/A-3 is a strict subset of PDF 1.7. Common pitfalls include embedded fonts not being subset-embedded, ICC color profiles missing, and transparency groups failing the validator. Use a tested PDF library (e.g. pdfmake, PDFKit, or ReportLab) rather than generating PDF bytes manually.

### Week 14 (31 Aug – 6 Sep)

- [ ] Ensure metadata compliance

Detailed tasks:

- Validate generated PDFs against PDF/A-3 using veraPDF (the industry-standard open-source PDF/A validator) — integrate veraPDF into CI pipeline
- Fix all PDF/A-3 conformance errors reported by veraPDF: typically font embedding, color space declarations, and metadata schema issues
- Ensure the embedded XMP metadata includes ZUGFeRD/Factur-X mandatory fields: `DocumentType`, `DocumentFileName`, `ConformanceLevel`, `Version`
- Test that the PDF/XML hybrid can be opened by at least two independent tools that can extract and re-validate the embedded XML (e.g. Mustang Project viewer, ZUGFeRD-Community tools)

> **veraPDF is the reference:** Just as KoSIT is the authority on XRechnung XML, veraPDF is the authoritative validator for PDF/A conformance. Both must pass before a hybrid invoice is considered compliant.

### Week 15 (7 Sep – 13 Sep)

- [ ] Expand hybrid export validation coverage across legally distinct invoice scenarios
- [ ] Implement structured support for selected Factur-X/ZUGFeRD profiles

Detailed tasks:

- Implement structured support for ZUGFeRD/Factur-X profiles: MINIMUM (read-only basic data), BASIC WL (without line items), BASIC (with line items), EN 16931 (full compliance), and XRECHNUNG (XRechnung-aligned) — choose which profiles to support based on the needs of the target user group
- Each profile maps to a different subset of XML fields embedded in the PDF — implement profile-specific XML generation as a variant of the Phase 2 adapter
- Add profile selection as an input parameter to the generation API, with EN 16931 as the default
- Expand hybrid export validation coverage: generate hybrid PDFs from at least 20 of the Phase 3 fixtures and validate all with both veraPDF and KoSIT (XML extraction → KoSIT check)

> **Profile guidance:** For the target user group (freelancers, NGOs), the EN 16931 and XRECHNUNG profiles are the most relevant. MINIMUM is too limited for real invoices. BASIC is a reasonable minimum for automated processing by receiving companies.

### Week 16 (14 Sep – 20 Sep)

- [ ] Refine export reliability
- [ ] Increase validation coverage to 40+ scenarios
- [ ] Improve diagnostics for compliance errors
- [ ] Tag release v0.4.0

Detailed tasks:

- Increase validation coverage to 40+ legally distinct invoice scenarios with hybrid PDF/A-3 export — each must pass both veraPDF and KoSIT
- Refine export reliability: test edge cases such as very long line item descriptions, special characters (umlauts, ampersands) in XML-embedded strings, invoices with 50+ line items, and empty optional fields
- Improve compliance error diagnostics: when generation fails, return a structured error object with: which validator flagged it, the specific rule violated, the field(s) involved, and a suggested fix
- Tag release v0.4.0 with a profile compatibility matrix in the release notes showing which features are supported per Factur-X profile

**Milestone: Hybrid PDF/A-3 export reliably generated and validated across 40+ legally distinct invoice scenarios; release v0.4.0 published.**

---

## Phase 5 – Stabilization & Release Preparation

**Deliverable:** Production-ready open-source prototype.

### Week 17 (21 Sep – 27 Sep)

- [ ] Begin stabilization phase toward production-ready prototype
- [ ] Establish full automated test suite (schema, XML, hybrid export)
- [ ] Regression tests for all supported legal scenarios and document types (50+ fixtures)

Detailed tasks:

- Establish a unified automated test suite covering all three layers: schema validation tests, XML generation + KoSIT tests, and hybrid export + veraPDF tests
- Write regression tests for all legal scenarios implemented in Phases 2–4 — every fixture must have a corresponding automated regression test
- Introduce test coverage reporting in CI: set a minimum coverage threshold and fail the build if it drops below it
- Expand fixture library to 50+ scenarios including edge VAT cases not yet covered (e.g. mixed VAT rates on a single invoice, 0% + 19% on different line items)

### Week 18 (28 Sep – 4 Oct)

- [ ] Expand automated test coverage
- [ ] Test edge VAT scenarios and rounding consistency
- [ ] Fix failing test cases and stabilize core logic

Detailed tasks:

- Test and fix rounding consistency across all fixtures: verify that rounding applied at line level (per EN 16931) does not cause total-level discrepancies that fail KoSIT
- Test edge VAT scenarios: line items with quantities involving decimal fractions, unit prices with more than 2 decimal places, and invoices where rounding causes the summed VAT to differ from the document-level VAT by ±0.01
- Implement and test the "rounding adjustment line" approach used in XRechnung for resolving permitted ±0.02 rounding tolerances
- Fix all failing test cases — no known test failures should remain after this week

### Week 19 (5 Oct – 11 Oct)

- [ ] Perform security and stability checks
- [ ] Review file handling and input sanitization
- [ ] Test malformed input scenarios

Detailed tasks:

- Review all file handling: ensure no path traversal vulnerabilities when reading/writing fixture files; validate file size limits are enforced
- Audit input sanitization: all string fields from JSON input must be sanitized before insertion into XML (prevent XML injection via crafted invoice field values)
- Test malformed input scenarios: missing mandatory fields, wrong data types, null values in required fields, excessively long strings, negative amounts, future dates — all must return structured errors, never crash
- Run a dependency audit (`npm audit` / `pip-audit`) and update any dependencies with known vulnerabilities
- Document security considerations in `SECURITY.md`: what the engine does and does not protect against, responsible disclosure process

### Week 20 (12 Oct – 18 Oct)

- [ ] Finalize core documentation
- [ ] API documentation
- [ ] Architecture overview
- [ ] Limitations and supported scope section

Detailed tasks:

- Write complete API reference documentation: every public function/endpoint with parameter descriptions, return types, error codes, and usage examples
- Finalize `ARCHITECTURE.md`: update to reflect the actual implemented architecture (it will have evolved from the Phase 1 draft)
- Write `SUPPORTED_SCENARIOS.md`: a clear, honest list of all supported legal scenarios, all partially supported scenarios (with caveats), and all explicitly unsupported scenarios
- Write `LIMITATIONS.md`: known edge cases not handled, XRechnung BTs that are not implemented, and any scenarios where manual user verification is recommended
- Translate key documentation sections into German (at minimum: README quickstart, scenario list, and API overview)

### Week 21 (19 Oct – 25 Oct)

- [ ] Performance testing
- [ ] Large invoice stress tests
- [ ] Multiple line item handling
- [ ] Memory and execution consistency checks

Detailed tasks:

- Run large invoice stress tests: generate XML and hybrid PDFs for invoices with 100, 500, and 1000 line items — measure generation time and memory usage
- Run batch generation test: generate 100 invoices sequentially and measure total time, memory peak, and any memory leaks
- Profile the most expensive operations (XML serialization, PDF rendering, validator calls) and document the findings
- Set performance baseline targets (e.g. "a 100-line-item invoice generates in under 2 seconds on reference hardware") and document them in a `PERFORMANCE.md` file
- Optimize obvious bottlenecks if found, but do not over-optimize — document deferred optimizations for post-v1.0 work

### Week 22 (26 Oct – 1 Nov)

- [ ] Internal refactoring for clarity and maintainability
- [ ] Clean module boundaries
- [ ] Improve code comments
- [ ] Strengthen adapter isolation

Detailed tasks:

- Review and clean module boundaries: ensure the adapter pattern is consistently applied — no leakage of XML or PDF concerns into the core schema module
- Improve inline code comments: every non-obvious function or rule should have a comment explaining WHY it exists (the legal rule or edge case that motivated it), not just WHAT it does
- Strengthen adapter isolation: XML and PDF adapters should be replaceable independently without touching shared code
- Rename any poorly named variables, functions, or files identified during review — prioritize clarity for future open-source contributors
- No new features this week — pure code quality work

### Week 23 (2 Nov – 8 Nov)

- [ ] Final compliance verification
- [ ] KoSIT validation for XML across all fixtures
- [ ] Hybrid generation smoke tests across representative fixtures
- [ ] Confirm conformity with defined supported profiles

Detailed tasks:

- Run KoSIT validation for XML across all 50+ fixtures — all must pass with zero errors; document any warnings and their acceptability
- Run veraPDF validation for hybrid PDFs across all PDF fixtures — all must pass PDF/A-3b conformance
- Run smoke tests across all supported Factur-X/ZUGFeRD profiles: generate one representative invoice per profile and validate
- Confirm conformity with the supported profile list documented in Week 20 — verify no undocumented gaps exist
- If any compliance failures are found, fix and re-run before proceeding to Week 24

### Week 24 (9 Nov – 15 Nov)

- [ ] Developer documentation
- [ ] Contribution guidelines
- [ ] Local setup instructions refinement
- [ ] Example usage documentation

Detailed tasks:

- Finalize `DEVELOPMENT.md`: detailed guide for external contributors including how to add a new legal scenario (fixture + logic + test), how to update the BT mapping, and coding conventions
- Refine local setup instructions: ensure a developer with no prior knowledge of XRechnung can go from `git clone` to running the full test suite in under 15 minutes
- Write example usage documentation: at least 3 end-to-end code examples showing how to use the API to generate a standard invoice, a [§19][ustg-19] small business invoice, and a hybrid PDF
- Publish a FAQ section addressing the most likely questions from freelancer/small business users

### Week 25 (16 Nov – 22 Nov)

- [ ] Final stability pass
- [ ] Full regression testing
- [ ] Review open issues
- [ ] Prepare release notes

Detailed tasks:

- Run full regression test suite from scratch in a clean environment — verify all 50+ fixtures pass KoSIT and veraPDF
- Review all open GitHub issues: triage, close as "won't fix for v1.0" with explanation, or fix if small scope
- Draft release notes for v1.0.0-prototype: what is included, what is explicitly out of scope, upgrade path expectations, and call for community feedback
- Share a pre-release version with 2–3 trusted reviewers from the target audience (freelancers or open-source contributors) and incorporate any critical feedback

### Week 26 (23 Nov – 29 Nov)

- [ ] Freeze scope
- [ ] Tag release v1.0.0-prototype
- [ ] Prepare final funding documentation summary

Detailed tasks:

- Freeze scope: no new features accepted after this point; only critical bug fixes permitted
- Tag release v1.0.0-prototype on the main branch — include a signed tag with the full release notes
- Publish the release on GitHub with: release notes, link to documentation, link to the fixture library, known limitations, and roadmap for Second Stage (public web service)
- Prepare final funding documentation summary: a written report covering what was built, which milestones were achieved, which scenarios are covered, validation results, and open items for the next phase
- Post an announcement on LinkedIn, Mastodon, and relevant freelancer/open-source communities to invite users and contributors

**Milestone: Production-ready open-source prototype engine validated locally and prepared for controlled public deployment in Second Stage.**

---

## Second Stage – Phases 6–10 (the hosted public web service)

> **Status: Not yet selected — planned only.** Phases 1–5 above are the committed scope. Second Stage depends on a go/no-go decision after Phase 5 (v1.0.0-prototype), informed by the demand-validation signals described below (beta/developer signups, site traffic) and funding availability. Dates and phase breakdown here are a provisional plan, not a commitment.

| Phase                                            | Focus                                            | Period                        |
| ------------------------------------------------ | ------------------------------------------------ | ----------------------------- |
| Phase 6 – Deployment & Operational Setup         | Production deployment, monitoring, rate limiting | Weeks 27–29 (30 Nov – 20 Dec) |
| Phase 7 – Public Beta Preparation                | Documentation, tutorials                         | Weeks 30–32 (21 Dec – 10 Jan) |
| Phase 8 – Integrations & API Reuse               | API documentation, pilot integrations            | Weeks 33–35 (11 Jan – 31 Jan) |
| Phase 9 – Sustainability & Community Development | Community setup, hosting model, governance       | Weeks 36–39 (1 Feb – 28 Feb)  |
| Phase 10 – Stabilization & Finalization          | Improvements, issue resolution, final reporting  | Weeks 40–42 (1 Mar – 21 Mar)  |

The beta program (`beta.html`) and developer feedback form (`developer.html`) collect early
signups and integration interest ahead of Phase 6's production deployment. Publishing
`openinvoicexml.de` itself doubles as a demand-validation step — traffic and signup volume are a
lightweight signal for whether the hosted Second Stage service is worth the funded build-out.

[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-14]: https://www.gesetze-im-internet.de/ustg_1980/__14.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
