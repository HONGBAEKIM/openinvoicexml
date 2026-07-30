# Fixtures

JSON invoice examples used for development, testing, and documentation.

Each fixture is a valid `Invoice` object (see `core/types/invoice.ts`) and has a corresponding
expected XRechnung XML output once Phase 2 is complete.

| File                               | Scenario                                 | Status      |
| ---------------------------------- | ---------------------------------------- | ----------- |
| `domestic-simple.invoice.json`     | Standard 19% VAT                         | Implemented |
| `domestic-multi-line.invoice.json` | Multiple lines, standard VAT             | Implemented |
| `reduced-rate.invoice.json`        | Reduced 7% VAT (category S)              | Implemented |
| `exempt.invoice.json`              | VAT-exempt (category E, §4 UStG)         | Implemented |
| `zero-rated.invoice.json`          | Zero-rated (category Z)                  | Implemented |
| `reverse-charge.invoice.json`      | Reverse charge / §13b UStG (category AE) | Implemented |
| `small-business.invoice.json`      | §19 UStG small business (category E)     | Implemented |
| `intra-eu-supply.invoice.json`     | Intra-EU supply (category K)             | Implemented |
| `export.invoice.json`              | Export outside EU (category G)           | Implemented |
| `reverse-charge-construction.invoice.json` | §13b subcase: construction (category AE) | Implemented |
| `reverse-charge-scrap-metal.invoice.json`  | §13b subcase: scrap metal (category AE)  | Implemented |
| `reverse-charge-security-transfer.invoice.json` | §13b subcase: security transfer (category AE) | Implemented |
| `reverse-charge-cleaning.invoice.json`     | §13b subcase: building cleaning (category AE) | Implemented |
| `reverse-charge-mobile-devices.invoice.json` | §13b subcase: mobile devices (category AE) | Implemented |
| `reverse-charge-gas-and-electricity.invoice.json` | §13b subcase: gas/electricity (category AE) | Implemented |

Note: fixtures can't carry inline comments — they're loaded via `import ... with { type: "json" }` and
validated against `schemas/invoice.schema.json`, which sets `"additionalProperties": false` at every level,
so any extra `_comment`-style key would fail schema validation. Explanations live here instead.

## Notes

`domestic-simple.invoice.json` is the baseline most other fixtures are adapted from: one line item, category
`S` at 19%, no `exemptionReason`/`exemptionReasonCode` (full VAT applies, nothing to justify).

- **`domestic-multi-line.invoice.json`** — same baseline, but three line items (consulting, review, tools
  license) summed into one `vatBreakdowns` entry, to test line-aggregation rather than VAT-category logic.
- **`reduced-rate.invoice.json`** — same shape as the baseline, but `vatRate: 7` / category `S` (reduced rate
  for books, per §12 Abs. 2 UStG), to test the reduced-rate math path.
- **`exempt.invoice.json`** — category `E`, `vatRate: 0`, with an `exemptionReason` ("Heilbehandlung", §4
  Nr. 14 UStG) and `exemptionReasonCode: "VATEX-EU-79-C"`. Tests that category `E` requires a reason, unlike
  `S`.
- **`zero-rated.invoice.json`** — category `Z`, `vatRate: 0`, no `exemptionReason`/`exemptionReasonCode` —
  unlike `exempt.invoice.json`'s category `E`, `Z` doesn't require one.
- **`reverse-charge.invoice.json`** — category `AE`, `vatRate: 0`, generic §13b UStG `exemptionReason`
  ("Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG") and `exemptionReasonCode:
  "VATEX-EU-AE"`. No `reverseChargeReason` field — this predates the subcase feature and acts as the
  "no subcase declared" baseline in `validators/test/reverse-charge.test.ts`.
- **`reverse-charge-construction.invoice.json`**, **`reverse-charge-scrap-metal.invoice.json`**,
  **`reverse-charge-security-transfer.invoice.json`**, **`reverse-charge-cleaning.invoice.json`**,
  **`reverse-charge-mobile-devices.invoice.json`**, **`reverse-charge-gas-and-electricity.invoice.json`** —
  each sets `vatBreakdowns[].reverseChargeReason` to its subcase and matches the `exemptionReason` text to
  it, since `checkReverseChargeSubcaseRequirements` (`validators/rules/reverse-charge.ts`) requires the two
  to agree. Together with `construction`/`scrap-and-waste`, these six satisfy `ROADMAP.md` Week 9's "5+"
  subcase target (its "security services" item is modeled as `security-transfer` instead — §13b Abs. 2
  Nr. 2 actually covers goods transferred as collateral, not security services). Remaining 7 subcases:
  see `docs/LIMITATIONS.md`. `mobile-devices` is priced at €6,000 to satisfy the (unenforced) €5,000
  threshold, also documented there.
- **`small-business.invoice.json`** — category `E`, no `vatId` on the seller (only `taxRegistrationId`), and
  `exemptionReason: "Gemäß § 19 UStG..."` (Kleinunternehmer/small-business exemption, not a general §4
  exemption). Tests that a seller can be VAT-registered without an EU VAT ID.
- **`intra-eu-supply.invoice.json`** — category `K`, buyer is in France (`FR` VAT ID/address) instead of
  Germany, plus a `delivery` block with `deliverTo` in another EU country. Tests cross-border EU delivery
  and the `§6a UStG` intra-Community exemption wording/code (`VATEX-EU-IC`).
- **`export.invoice.json`** — category `G`, buyer is in Switzerland (`CH`, non-EU, no `vatId`), plus a
  `delivery` block with `deliverTo` outside the EU. Tests the outside-EU export exemption
  (`§4 Nr. 1 Buchst. a UStG`, `VATEX-EU-G`), distinct from `intra-eu-supply.invoice.json`'s within-EU case.
