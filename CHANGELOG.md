# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-08-24

### Added

- Allowances and charges (BG-20/21 document-level, BG-27/28 line-level), with corrected line/
  document-total rounding formulas
- BT-12, BT-13, BT-25/BT-26, BT-113 in XRechnung XML
- §13b reverse-charge subcases (construction, scrap metal, security, cleaning, mobile devices,
  gas/electricity, intra-EU services, real estate, telecommunications), intra-EU supply, export,
  §19 small business, and outside-scope (category O) VAT rules
- Credit notes and corrective invoices, rendered as proper UBL document types
- Fixture library grown from 6 to 30, each validated via KoSIT with zero errors

### Supported XRechnung Business Terms

Only BT-11 (project reference), BT-17 (tender/lot reference), and BG-24 (additional supporting
documents) remain unmapped — see [`DATA-MODEL.md`](docs/DATA-MODEL.md) for the full table and
[`fixtures/README.md`](fixtures/README.md) for the complete fixture index.

## [0.2.0] - 2026-07-20

### Added

- XRechnung UBL 2.1 XML generation (`toXRechnung`) validated locally via the official KoSIT
  validator (`runKosit`) — zero error-severity findings across all 6 current fixtures
- Structured VAT rule enforcement (`validateBusinessRules`): VAT category/rate consistency
  (category `S` restricted to Germany's 19%/7% standard/reduced rates), [§13b][ustg-13b] UStG reverse-charge
  buyer-VAT-ID requirement, exemption-reason requirements, and EN 16931 rounding/decimal-precision
  rules across line items, VAT breakdowns, and document-level totals
- `generateInvoice()` pipeline composing business-rule validation with XML generation — returns
  `{ xml: null, issues }` instead of producing XML for any invoice with an error-severity issue
- `docs/API.md`: usage reference for `generateInvoice`, `toXRechnung`, the `ValidationIssue`
  error-code contract, and `runKosit`
- CI (`.github/workflows/ci.yml`): `lint` + `typecheck` + `test` (including the full KoSIT-backed
  fixture regression) on every push/PR to `main`

### Changed

- `adapters/xrechnung.ts` refactored into a field-mapping step (`adapters/xrechnung-mapping.ts`,
  independently tested) and a serialization step, so BT-to-field resolution and UBL markup
  generation can be reasoned about and tested separately. Output is unchanged — verified
  byte-identical against the pre-refactor XML for all 6 fixtures.

### Supported XRechnung Business Terms

See [`DATA-MODEL.md`](docs/DATA-MODEL.md) for the full BT ↔ internal-field ↔ UBL-element table. In
summary: all core document-level (BG-2), seller/buyer (BG-4/BG-7), VAT breakdown (BG-23),
document totals (BG-22), payment means (BG-16), and invoice line (BG-25) terms are mapped and
emitted. The following are explicitly **deferred to Phase 3** (`docs/DATA-MODEL.md`'s "Not yet
mapped" section):

- BT-11 (project reference), BT-12 (contract reference), BT-13 (purchase order reference),
  BT-17 (tender/lot reference)
- BT-25 / BT-26 (preceding invoice reference — needed for credit notes/corrections)
- BG-24 (additional supporting documents)
- BG-20 / BG-21 (document-level allowances/charges), BG-27 / BG-28 (line-level allowances/charges)
- BT-113 (prepaid amount)

Legal scenarios beyond the current 6 fixtures ([§19][ustg-19] small business, [§13b][ustg-13b] subcases beyond the
single reverse-charge check above, intra-EU supply, export, credit notes, down payments) remain
Phase 3 scope — see [`LIMITATIONS.md`](docs/LIMITATIONS.md).

## [0.1.0] - 2026-06-28

### Added

- Core invoice schema and internal `Invoice` type
- JSON Schema validation via AJV (zero runtime dependencies)
- Business rule validators for XRechnung compliance
- XRechnung XML adapter
- Fixture suite covering standard invoice categories
- Architecture, Contributing, and Limitations documentation

[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
