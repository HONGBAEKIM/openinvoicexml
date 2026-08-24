# Fixtures

JSON invoice examples used for development, testing, and documentation.

Each fixture is a valid `Invoice` object (see `core/types/invoice.ts`) and has a corresponding
expected XRechnung XML output once Phase 2 is complete.

| File                               | Scenario                                 | Status      |
| ---------------------------------- | ---------------------------------------- | ----------- |
| `01.domestic-simple.invoice.json`     | Standard 19% VAT                         | Implemented |
| `02.domestic-multi-line.invoice.json` | Multiple lines, standard VAT, purchase order reference | Implemented |
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
| `19.down-payment.invoice.json`        | Down payment invoice (Anzahlungsrechnung)          | Implemented |
| `20.final-invoice.invoice.json`       | Final invoice (Schlussrechnung) deducting a down payment | Implemented |
| `21.partial-delivery.invoice.json`    | Partial delivery invoice (Teilrechnung) with contract reference | Implemented |
| `22.document-level-discount.invoice.json` | Document-level allowance (BG-20)         | Implemented |
| `23.line-level-discount.invoice.json` | Line-level allowance (BG-27)             | Implemented |
| `24.combined-line-and-document-discount.invoice.json` | Both a line-level and a document-level allowance together | Implemented |
| `25.document-level-surcharge.invoice.json` | Document-level charge (BG-21)          | Implemented |
| `26.line-level-surcharge.invoice.json` | Line-level charge (BG-28)               | Implemented |
| `27.reverse-charge-intra-eu-services.invoice.json` | §13b subcase: cross-border EU services (category AE) | Implemented |
| `28.multiple-vat-rates.invoice.json`  | Multiple VAT rates (19%/7%) on one invoice | Implemented |
| `29.reverse-charge-real-estate.invoice.json` | §13b subcase: real estate transfer (category AE) | Implemented |
| `30.reverse-charge-telecommunications.invoice.json` | §13b subcase: telecommunications (category AE) | Implemented |

Note: fixtures can't carry inline comments — they're loaded via `import ... with { type: "json" }` and
validated against `schemas/invoice.schema.json`, which sets `"additionalProperties": false` at every level,
so any extra `_comment`-style key would fail schema validation. Explanations live here instead.

## Notes

`01.domestic-simple.invoice.json` is the baseline most other fixtures are adapted from: one line item, category
`S` at 19%, no `exemptionReason`/`exemptionReasonCode` (full VAT applies, nothing to justify).

- **`02.domestic-multi-line.invoice.json`** — same baseline, but three line items (consulting, review, tools
  license) summed into one `vatBreakdowns` entry, to test line-aggregation rather than VAT-category logic.
  Also sets `purchaseOrderReference` (BT-13), to exercise `cac:OrderReference` alongside the multi-line case.
- **`03.reduced-rate.invoice.json`** — same shape as the baseline, but `vatRate: 7` / category `S` (reduced rate
  for books, per §12 Abs. 2 UStG ([ustg-12])), to test the reduced-rate math path.
- **`04.exempt.invoice.json`** — category `E`, `vatRate: 0`, with an `exemptionReason` ("Heilbehandlung", §4
  Nr. 14 UStG ([ustg-4])) and `exemptionReasonCode: "VATEX-EU-79-C"` ([en16931-artefacts]). Tests that
  category `E` requires a reason, unlike `S`.
- **`05.zero-rated.invoice.json`** — category `Z`, `vatRate: 0`, no `exemptionReason`/`exemptionReasonCode` —
  unlike `04.exempt.invoice.json`'s category `E`, `Z` doesn't require one.
- **`06.reverse-charge.invoice.json`** — category `AE`, `vatRate: 0`, generic §13b UStG ([ustg-13b]) `exemptionReason`
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
  Nr. 2 actually covers goods transferred as collateral, not security services — see [ustg-13b]). Remaining 7 subcases:
  see `docs/LIMITATIONS.md`. `mobile-devices` is priced at €6,000 to satisfy the (unenforced) €5,000
  threshold, also documented there.
- **`07.small-business.invoice.json`** — category `E`, no `vatId` on the seller (only `taxRegistrationId`), and
  `exemptionReason: "Gemäß § 19 UStG..."` ([ustg-19], Kleinunternehmer/small-business exemption, not a general §4
  exemption). Tests that a seller can be VAT-registered without an EU VAT ID.
- **`08.intra-eu-supply.invoice.json`** — category `K`, buyer is in France (`FR` VAT ID/address) instead of
  Germany, plus a `delivery` block with `deliverTo` in another EU country. Tests cross-border EU delivery
  and the `§6a UStG` ([ustg-6a]) intra-Community exemption wording/code (`VATEX-EU-IC`, [en16931-artefacts]).
- **`09.export.invoice.json`** — category `G`, buyer is in Switzerland (`CH`, non-EU, no `vatId`), plus a
  `delivery` block with `deliverTo` outside the EU. Tests the outside-EU export exemption
  (`§4 Nr. 1 Buchst. a UStG` ([ustg-4]), `VATEX-EU-G` [en16931-artefacts]), distinct from
  `08.intra-eu-supply.invoice.json`'s within-EU case.
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
- **`19.down-payment.invoice.json`** — typeCode `380`, an Anzahlungsrechnung billing 30% of a
  EUR 20,000 net project (`RE-2026-0050`, EUR 6,000 net / EUR 7,140 gross) up front. A down payment
  invoice needs no engine changes over a normal invoice — it's just a `380` for a partial amount,
  with its own VAT breakdown at the time of payment.
- **`20.final-invoice.invoice.json`** — typeCode `380`, the Schlussrechnung for the same project
  (`RE-2026-0055`): bills the full EUR 20,000 net contract value, sets `prepaidAmount: 7140.00`
  (BT-113, the down payment's gross total) and `precedingInvoiceReference` pointing back at
  `19.down-payment.invoice.json`'s id/issueDate, so `duePayableAmount` correctly nets down to
  `16660.00` (`taxInclusiveAmount − prepaidAmount`, BT-115 = BT-112 − BT-113 — see [en16931] for the
  BT field definitions and rule text). Tests `INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH` and
  `PRECEDING_INVOICE_REFERENCE_REQUIRED` (`validators/02.business-rules.ts`) together in a realistic
  scenario, not just isolated mutations.
- **`21.partial-delivery.invoice.json`** — typeCode `380`, a Teilrechnung (`RE-2026-0060`) billing
  Phase 1 of a 3-phase EUR 50,000 net framework contract. Sets `contractReference` (BT-12,
  `VERTRAG-2026-0200`) and states the overall contract value and remaining balance in free-text
  `note` (BT-22) rather than a dedicated schema field — EN 16931/XRechnung ([en16931]) has no BT for
  either, so inventing one would be unvalidatable by KoSIT and unrecognized by any receiving system
  (see `docs/LIMITATIONS.md`).
- **`22.document-level-discount.invoice.json`** — typeCode `380`, a EUR 1000 net line (8 HUR ×
  EUR 125) with a EUR 100 document-level allowance (BG-20, `Sammelrabatt`, category `S`/19%),
  bringing `taxExclusiveAmount` to EUR 900. Proves `taxExclusiveAmount = BT-106 − BT-107` (see
  `docs/DATA-MODEL.md`'s "Document totals" section) when the allowance sits at document level
  rather than on the line.
- **`23.line-level-discount.invoice.json`** — the same scenario as `22`, but the EUR 100 allowance
  (`Treuerabatt`) is attached to the line itself (BG-27) instead of the document, so
  `lines[0].lineAmount` is already net (EUR 900) and there's no top-level `allowancesCharges` at
  all. Same final totals as `22` (`taxExclusiveAmount` EUR 900), proving both paths reach the same
  math.
- **`24.combined-line-and-document-discount.invoice.json`** — combines `22` and `23`: the line has
  its own EUR 100 allowance (`Treuerabatt`, BG-27) bringing `lineAmount` to EUR 900, *and* the
  document has a separate EUR 50 allowance (`Sammelrabatt`, BG-20, category `S`/19%) applied on
  top, bringing `taxExclusiveAmount` to EUR 850. Exists specifically to prove the two allowance
  levels compose additively (`BT-109 = BT-106 − BT-107`, with `BT-106` already net of the line's
  own allowance) rather than one masking or double-subtracting the other.
- **`25.document-level-surcharge.invoice.json`** — mirrors `22`, but the EUR 50 document-level
  adjustment (`Expresszuschlag`, BG-21, category `S`/19%) is a charge (`isCharge: true`) rather
  than an allowance, bringing `taxExclusiveAmount` *up* to EUR 1050 instead of down.
- **`26.line-level-surcharge.invoice.json`** — mirrors `23`, but the EUR 50 line-level adjustment
  (`Eilzuschlag`, BG-28) is a charge, so `lines[0].lineAmount` is EUR 1050 (quantity × unitPrice
  plus the charge) rather than net of a discount.
- **`27.reverse-charge-intra-eu-services.invoice.json`** — category `AE`, buyer in Austria
  (`AT` VAT ID/address), a cross-border B2B consulting service taxable in Germany under §3a Abs. 2
  UStG. Tests the `eu-cross-border-service` §13b Abs. 1 UStG subcase
  (`checkReverseChargeSubcaseRequirements`, `validators/rules/15.reverse-charge.ts`) — distinct
  from both the domestic §13b Abs. 2 subcases (`10`–`15`, `29`, `30`) and `08`'s category `K`
  intra-EU goods supply, since this is a cross-border *service* reverse-charged to a German-taxable
  transaction rather than a tax-free intra-Community goods delivery.
- **`28.multiple-vat-rates.invoice.json`** — one invoice, two lines split across `S`/19%
  (consulting) and `S`/7% (technical books, reduced rate per §12 Abs. 2 UStG), each in its own
  `vatBreakdowns` entry. Tests that `VAT_TAXABLE_AMOUNT_MISMATCH` and the line-aggregation checks
  (`validators/02.business-rules.ts`) work correctly per category/rate pair on the same document,
  not just across single-rate fixtures.
- **`29.reverse-charge-real-estate.invoice.json`** — category `AE`, sale of a commercial property
  where the seller has opted into VAT liability under §9 UStG, making the transaction subject to
  reverse charge under §13b Abs. 2 Nr. 3 UStG. Tests the `real-estate` subcase, one of the 7
  §13b Abs. 2 subcases previously modeled in code but unfixtured (`docs/LIMITATIONS.md`).
- **`30.reverse-charge-telecommunications.invoice.json`** — category `AE`, wholesale
  telecommunications services sold to a reseller, reverse-charged under §13b Abs. 2 Nr. 12 UStG.
  Tests the `telecommunications` subcase, closing another of the previously-unfixtured 7.

## References

The scenarios and field references above are grounded in these sources, not a live dataset:

| Source                                              | Link                  | Notes                                                                 |
| ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| EN 16931 validation rules (GitHub)                  | [en16931]              | BT-xx field definitions and BR-xx rule text (e.g. `BT-113`, `BR-S-05`) |
| EN 16931 supporting-artefacts & code-list registry  | [en16931-artefacts]    | VATEX exemption reason codes                                          |
| German invoice-content law, §4 UStG                 | [ustg-4]               | VAT exemptions (category `E`, non-§19)                                 |
| German tax rates, §12 UStG                          | [ustg-12]              | 19%/7%/0% rate categories                                              |
| German reverse-charge law, §13b UStG                | [ustg-13b]             | `AE` category and its subcases                                        |
| German small-business law, §19 UStG                 | [ustg-19]              | Kleinunternehmerregelung exemption                                     |
| German intra-community supply law, §6a UStG         | [ustg-6a]              | `K` category (intra-EU supply)                                        |

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[en16931-artefacts]: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
