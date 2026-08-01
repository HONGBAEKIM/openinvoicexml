# Fixtures

JSON invoice examples used for development, testing, and documentation.

Each fixture is a valid `Invoice` object (see `core/types/invoice.ts`) and has a corresponding
expected XRechnung XML output once Phase 2 is complete.

| File                               | Scenario                                 | Status      |
| ---------------------------------- | ---------------------------------------- | ----------- |
| `01.domestic-simple.invoice.json`     | Standard 19% VAT                         | Implemented |
| `02.domestic-multi-line.invoice.json` | Multiple lines, standard VAT             | Implemented |
| `03.reduced-rate.invoice.json`        | Reduced 7% VAT (category S)              | Implemented |
| `04.exempt.invoice.json`              | VAT-exempt (category E, §4 UStG)         | Implemented |
| `05.zero-rated.invoice.json`          | Zero-rated (category Z)                  | Implemented |
| `06.reverse-charge.invoice.json`      | Reverse charge / §13b UStG (category AE) | Implemented |
| `07.small-business.invoice.json`      | §19 UStG small business (category E)     | Implemented |
| `08.intra-eu-supply.invoice.json`     | Intra-EU supply (category K)             | Implemented |
| `09.export.invoice.json`              | Export outside EU (category G)           | Implemented |
| `10.reverse-charge-construction.invoice.json` | §13b subcase: construction (category AE) | Implemented |
| `11.reverse-charge-scrap-metal.invoice.json`  | §13b subcase: scrap metal (category AE)  | Implemented |
| `12.reverse-charge-security-transfer.invoice.json` | §13b subcase: security transfer (category AE) | Implemented |
| `13.reverse-charge-cleaning.invoice.json`     | §13b subcase: building cleaning (category AE) | Implemented |
| `14.reverse-charge-mobile-devices.invoice.json` | §13b subcase: mobile devices (category AE) | Implemented |
| `15.reverse-charge-gas-and-electricity.invoice.json` | §13b subcase: gas/electricity (category AE) | Implemented |
| `16.credit-note-full.invoice.json`    | Credit note (typeCode 381), full reversal          | Implemented |
| `17.credit-note-partial.invoice.json` | Credit note (typeCode 381), partial line-item credit | Implemented |
| `18.corrective-invoice.invoice.json`  | Corrective invoice (typeCode 384), partial line-item correction | Implemented |

Note: fixtures can't carry inline comments — they're loaded via `import ... with { type: "json" }` and
validated against `schemas/invoice.schema.json`, which sets `"additionalProperties": false` at every level,
so any extra `_comment`-style key would fail schema validation. Explanations live here instead.

## Notes

`01.domestic-simple.invoice.json` is the baseline most other fixtures are adapted from: one line item, category
`S` at 19%, no `exemptionReason`/`exemptionReasonCode` (full VAT applies, nothing to justify).

- **`02.domestic-multi-line.invoice.json`** — same baseline, but three line items (consulting, review, tools
  license) summed into one `vatBreakdowns` entry, to test line-aggregation rather than VAT-category logic.
- **`03.reduced-rate.invoice.json`** — same shape as the baseline, but `vatRate: 7` / category `S` (reduced rate
  for books, per §12 Abs. 2 UStG), to test the reduced-rate math path.
- **`04.exempt.invoice.json`** — category `E`, `vatRate: 0`, with an `exemptionReason` ("Heilbehandlung", §4
  Nr. 14 UStG) and `exemptionReasonCode: "VATEX-EU-79-C"`. Tests that category `E` requires a reason, unlike
  `S`.
- **`05.zero-rated.invoice.json`** — category `Z`, `vatRate: 0`, no `exemptionReason`/`exemptionReasonCode` —
  unlike `04.exempt.invoice.json`'s category `E`, `Z` doesn't require one.
- **`06.reverse-charge.invoice.json`** — category `AE`, `vatRate: 0`, generic §13b UStG `exemptionReason`
  ("Steuerschuldnerschaft des Leistungsempfängers gem. §13b UStG") and `exemptionReasonCode:
  "VATEX-EU-AE"`. No `reverseChargeReason` field — this predates the subcase feature and acts as the
  "no subcase declared" baseline in `validators/test/15.reverse-charge.test.ts`.
- **`10.reverse-charge-construction.invoice.json`**, **`11.reverse-charge-scrap-metal.invoice.json`**,
  **`12.reverse-charge-security-transfer.invoice.json`**, **`13.reverse-charge-cleaning.invoice.json`**,
  **`14.reverse-charge-mobile-devices.invoice.json`**, **`15.reverse-charge-gas-and-electricity.invoice.json`** —
  each sets `vatBreakdowns[].reverseChargeReason` to its subcase and matches the `exemptionReason` text to
  it, since `checkReverseChargeSubcaseRequirements` (`validators/rules/15.reverse-charge.ts`) requires the two
  to agree. Together with `construction`/`scrap-and-waste`, these six satisfy `ROADMAP.md` Week 9's "5+"
  subcase target (its "security services" item is modeled as `security-transfer` instead — §13b Abs. 2
  Nr. 2 actually covers goods transferred as collateral, not security services). Remaining 7 subcases:
  see `docs/LIMITATIONS.md`. `mobile-devices` is priced at €6,000 to satisfy the (unenforced) €5,000
  threshold, also documented there.
- **`07.small-business.invoice.json`** — category `E`, no `vatId` on the seller (only `taxRegistrationId`), and
  `exemptionReason: "Gemäß § 19 UStG..."` (Kleinunternehmer/small-business exemption, not a general §4
  exemption). Tests that a seller can be VAT-registered without an EU VAT ID.
- **`08.intra-eu-supply.invoice.json`** — category `K`, buyer is in France (`FR` VAT ID/address) instead of
  Germany, plus a `delivery` block with `deliverTo` in another EU country. Tests cross-border EU delivery
  and the `§6a UStG` intra-Community exemption wording/code (`VATEX-EU-IC`).
- **`09.export.invoice.json`** — category `G`, buyer is in Switzerland (`CH`, non-EU, no `vatId`), plus a
  `delivery` block with `deliverTo` outside the EU. Tests the outside-EU export exemption
  (`§4 Nr. 1 Buchst. a UStG`, `VATEX-EU-G`), distinct from `08.intra-eu-supply.invoice.json`'s within-EU case.
- **`16.credit-note-full.invoice.json`** — typeCode `381`, full reversal of `01.domestic-simple.invoice.json`
  (`RE-2026-0042`): negated quantity/lineAmount/VAT breakdown/totals, `precedingInvoiceReference` pointing
  back at the original invoice's id/issueDate. Tests `CREDIT_NOTE_POSITIVE_AMOUNT` and
  `PRECEDING_INVOICE_REFERENCE_REQUIRED` (`validators/rules/10.credit-note.ts`) on the fully-negative case.
- **`17.credit-note-partial.invoice.json`** — typeCode `381`, partial credit against
  `02.domestic-multi-line.invoice.json` (`RE-2026-0043`): only 2 of the original 3 lines are credited
  (negated), the third (consulting) stays untouched on the original invoice. Tests that VAT breakdown
  arithmetic checks work correctly against a subset of lines, not just a full reversal.
- **`18.corrective-invoice.invoice.json`** — typeCode `384`, models a seller who already sent invoice
  `RE-2026-0044` (2026-06-12) but forgot to bill 3 consulting hours, so they issue a *new* document,
  `RE-2026-0045`, that only bills the missing hours (`precedingInvoiceReference` points back at
  `RE-2026-0044`). Unlike `16`/`17`'s credit notes, a corrective invoice adds to what's owed rather
  than reducing it, so `duePayableAmount` is positive (`446.25`) — `CREDIT_NOTE_POSITIVE_AMOUNT`
  doesn't apply here since that check is `381`-only, but `PRECEDING_INVOICE_REFERENCE_REQUIRED` still
  does, since both `381` and `384` must say what they reference (`validators/rules/10.credit-note.ts`).
  As with `17`, only the amended line is present, not a full copy of the original invoice — that's a
  fixture-authoring convention, not something the schema enforces, since the internal `Invoice` type
  has no concept of "the original document" to diff against.
