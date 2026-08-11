# Limitations

This document records what is explicitly **not supported** in the current version, and why.
It is updated as scope decisions are made — not just at release time.

---

## VAT Category Codes

### `L` (Canary Islands IGIC) and `M` (Ceuta/Melilla IPSI) — not supported

Both codes are part of the [EN 16931 VAT category code list][en16931-artefacts] (UNTDID 5305) but are **out of scope** for this project.

- `L` — IGIC (Impuesto General Indirecto Canario): applies when the place of supply is the Canary Islands
- `M` — IPSI (Impuesto sobre la Producción, los Servicios y la Importación): applies when the place of supply is Ceuta or Melilla

These are Spanish special-territory taxes. A German freelancer or business would only encounter them in the rare case of supplying goods/services with a place of supply in those territories. They are generally outside the scope of Germany-focused invoicing software.

If this project ever expands toward a generic EN 16931 library (rather than a Germany-focused XRechnung engine), adding `L` and `M` to `VatCategoryCode` is a small change — but it would require corresponding test fixtures and KoSIT validation confirmation before being considered supported.

**Workaround:** Not applicable. If you need to issue an invoice with IGIC or IPSI, use general-purpose EN 16931 tooling.

### Category `S` rate is restricted to 19%/7% — historical and non-German rates not supported

Source for current German VAT rates: [§12 UStG][ustg-12].

`checkVatRateForCategory` (`validators/rules/17.vat-rate.ts`) only accepts `19` or `7` for category `S` (`STANDARD_VAT_RATES`). Germany's COVID-era rates (16%/5%, July–December 2020) and other EU member states' EN 16931 standard/reduced rates are rejected as `VAT_RATE_INVALID_FOR_CATEGORY`.

**Workaround:** Not applicable today. Adding support means widening `STANDARD_VAT_RATES` plus a corresponding test fixture and KoSIT validation confirmation — tracked as a future extension, not current behavior.

---

### §13b UStG reverse-charge subcases — 13 of 14 named subcases modeled; 6 have fixtures; subcase-tag alone doesn't prove reverse charge applies

German law recognizes 14 distinct §13b UStG reverse-charge transaction types (§13b Abs. 1 plus
Abs. 2 Nr. 1–12). `validators/rules/15.reverse-charge.ts` models an
optional `reverseChargeReason` identifier (`VatBreakdown.reverseChargeReason`) covering 13 of them,
each with its own free-text keyword check against the exemption reason (VATEX has no per-subcase
code, so category `AE` and `VATEX-EU-AE` stay generic across all of them).

Primary sources for this section: [§13b UStG][ustg-13b] (statutory reverse-charge categories),
[current UStAE][ustae] (BMF administrative guidance, especially section 13b), [Anlage 3
UStG][ustg-anlage-3] (scrap and waste goods), [Anlage 4 UStG][ustg-anlage-4] (industrial metals).

| `reverseChargeReason` value | Legal basis                                                                                                              | Fixture?                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `eu-cross-border-service`   | [§13b Abs. 1 UStG][ustg-13b]                                                                                                         | No                                                                   |
| `foreign-supplier`          | [§13b Abs. 2 Nr. 1 UStG][ustg-13b]                                                                                                   | No                                                                   |
| `security-transfer`         | [§13b Abs. 2 Nr. 2 UStG][ustg-13b]                                                                                                   | **Yes** — `fixtures/12.reverse-charge-security-transfer.invoice.json`   |
| `real-estate`               | [§13b Abs. 2 Nr. 3 UStG][ustg-13b]                                                                                                   | No                                                                   |
| `construction`              | [§13b Abs. 2 Nr. 4 UStG][ustg-13b]                                                                                                   | **Yes** — `fixtures/10.reverse-charge-construction.invoice.json`        |
| `gas-and-electricity`       | [§13b Abs. 2 Nr. 5 UStG][ustg-13b]                                                                                                   | **Yes** — `fixtures/15.reverse-charge-gas-and-electricity.invoice.json` |
| `emission-certificates`     | [§13b Abs. 2 Nr. 6 UStG][ustg-13b]                                                                                                   | No                                                                   |
| `scrap-and-waste`           | [§13b Abs. 2 Nr. 7 UStG][ustg-13b], [Anlage 3][ustg-anlage-3]                                                                                         | **Yes** — `fixtures/11.reverse-charge-scrap-metal.invoice.json`         |
| `cleaning`                  | [§13b Abs. 2 Nr. 8 UStG][ustg-13b]                                                                                                   | **Yes** — `fixtures/13.reverse-charge-cleaning.invoice.json`            |
| `qualifying-gold`           | [§13b Abs. 2 Nr. 9 UStG][ustg-13b]                                                                                                   | No                                                                   |
| `mobile-devices`            | [§13b Abs. 2 Nr. 10 UStG][ustg-13b], [Anlage 4][ustg-anlage-4]                                                                                        | **Yes** — `fixtures/14.reverse-charge-mobile-devices.invoice.json`      |
| `industrial-metals`         | [§13b Abs. 2 Nr. 11 UStG][ustg-13b], [Anlage 4][ustg-anlage-4] (broader than `scrap-and-waste` — raw silver, platinum, copper, aluminium, zinc, etc.) | No                                                                   |
| `telecommunications`        | [§13b Abs. 2 Nr. 12 UStG][ustg-13b]                                                                                                  | No                                                                   |

**construction**, **scrap-and-waste**, **security-transfer**, **cleaning**, **mobile-devices**, and
**gas-and-electricity** have end-to-end fixtures verified against KoSIT (satisfying `ROADMAP.md`'s
Week 9 "5+" subcase target). The other 7 have the `reverseChargeReason` enum value and keyword-check
logic implemented, but no fixture exercises them yet. The 1 remaining real-world subcase not covered by any identifier here
is a narrower carve-out within Abs. 2 Nr. 2 (security-asset transfers specifically in insolvency
proceedings) — an invoice for it would only get the subcase-agnostic generic `AE` checks (buyer
VAT ID, some exemption reason present), not a subcase-specific one.

**Important:** a matching `reverseChargeReason` + keyword check is necessary but **not sufficient**
proof that reverse charge actually applies. In particular, `mobile-devices` and `industrial-metals`
additionally require the total net consideration within one economic transaction to be at least
€5,000 — this precondition is not encoded or verified here. Setting the tag correctly documents
intent; it does not substitute for confirming the underlying legal preconditions actually hold.

**Workaround:** For the 7 modeled-but-unfixtured subcases, the validation logic exists and can be
exercised directly (set the relevant `reverseChargeReason` value) without a fixture. For the
insolvency-specific carve-out or any subcase outside this list, use the generic `AE` category with
a manually-verified free-text exemption reason — no subcase-specific validation is available.

#### Per-subcase eligibility conditions not verified

Beyond the €5,000 threshold noted above, each subcase carries its own statutory preconditions
that the keyword check does not verify. Summarized from the BMF §13b UStG application guidance:

- **`eu-cross-border-service`** — requires the service to be governed by §3a Abs. 2, taxable in
  Germany, and the supplier established elsewhere in the EU. Excluded under §13b Abs. 6: certain
  passenger transport, admission to German fairs/exhibitions, related exhibition services, some
  onboard restaurant services.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`foreign-supplier`** — supplier-establishment status can turn on residence, registered office,
  management, permanent establishments, and whether a German establishment participated in the
  transaction.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`security-transfer`** — requires the delivery to be of goods previously transferred as
  security, from the security provider to the security recipient, outside insolvency
  proceedings; these relationships are not verified.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`real-estate`** — not automatic merely because real estate is involved; must fall under the
  Real Estate Transfer Tax Act and be VAT-taxable, which normally requires an effective option to
  tax (real estate is otherwise exempt).
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`construction`** — must be a construction service affecting the substance of a structure
  (planning/supervisory services excluded); recipient generally must sustainably provide
  construction services themselves (a tax-office certificate can establish this); mixed contracts
  require determining the principal service; small repairs (≤€500) may not qualify.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`gas-and-electricity`** — combines two legally distinct branches: Nr. 5(a) energy supplied by
  a supplier established abroad under [§3g][ustg-3g], and Nr. 5(b) gas via the natural-gas network /
  electricity not covered by (a). Recipient conditions differ: gas supplies require a
  gas-reseller recipient; electricity supplies require both supplier and recipient to be
  electricity resellers.
  Sources: [§13b UStG][ustg-13b], [§3g UStG][ustg-3g], and [current UStAE][ustae].
- **`emission-certificates`** — recipient must be an entrepreneur; also requires confirming the
  transferred instrument is actually one of the covered instrument types (allowances,
  emission-reduction units, certified emission reductions, fuel-emissions certificates,
  gas/electricity certificates).
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`scrap-and-waste`** — applies only to goods listed in Anlage 3 by customs classification
  (slag/residues, plastic/rubber waste, broken glass, precious-metal waste, iron/steel/metal
  scrap, battery waste, certain e-waste); a generic description like "scrap metal" isn't
  sufficient on its own.
  Sources: [§13b UStG][ustg-13b], [Anlage 3 UStG][ustg-anlage-3], [current UStAE][ustae].
- **`cleaning`** — must be cleaning of buildings/parts of buildings; recipient generally must
  sustainably provide building-cleaning services themselves (a certificate can establish this).
  Excludes: separate chimney cleaning, pest control, winter services, inventory cleaning,
  employee leasing.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].
- **`qualifying-gold`** — applies only to gold of at least 325 thousandths fineness in
  raw/semi-manufactured form under the relevant customs heading, plus qualifying gold plating —
  not every gold product or item commonly called "investment gold". [§25a][ustg-25a] differential taxation
  can also exclude the transaction.
  Sources: [§13b UStG][ustg-13b], [§25a UStG][ustg-25a], and [current UStAE][ustae].
- **`mobile-devices`** — requires qualifying phones/tablets/game consoles/specified integrated
  circuits (circuits only before incorporation into a retail-level product), plus the €5,000
  threshold noted above; [§25a][ustg-25a] differential taxation may also exclude it.
  Sources: [§13b UStG][ustg-13b], [§25a UStG][ustg-25a], and [current UStAE][ustae].
- **`industrial-metals`** — applies only to Anlage 4 goods/customs classifications (silver,
  platinum, iron, steel, copper, nickel, aluminium, lead, zinc, tin, other base metals, cermets),
  plus the €5,000 threshold; [§25a][ustg-25a] may exclude it.
  Sources: [§13b UStG][ustg-13b], [Anlage 4 UStG][ustg-anlage-4], [§25a UStG][ustg-25a], [current UStAE][ustae].
- **`telecommunications`** — recipient generally must be a telecommunications reseller (more than
  half of acquired services resold, no more than 5% for own use); a certificate can support this
  status. Exclusions exist for public-law entities, condominium-owner communities, and certain
  landlord arrangements.
  Sources: [§13b UStG][ustg-13b] and [current UStAE][ustae].

None of these are separate transaction categories — they're eligibility conditions layered on top
of the category already selected by `reverseChargeReason`. A full eligibility engine (recipient
entrepreneur/reseller status, supplier establishment, certificate validity, §13b Abs. 6 / [§25a][ustg-25a]
exclusions, public-law recipient exceptions, mixed-supply principal-service classification, the
"agreed treatment without tax loss" simplification, etc.) is out of scope here — see
`ReverseChargeSubcase` in `core/types/vat-breakdown.ts` for the corresponding code-level
disclaimer.

### §19 UStG small-business exemption (category `E`) — turnover conditions not verified

Source: [§19 UStG][ustg-19].

`validators/rules/16.small-business.ts` only checks that a seller tax registration ID (BT-32) or
VAT ID (BT-31) is present whenever a VAT breakdown's free-text exemption reason references §19
UStG (see `SMALL_BUSINESS_REFERENCE_PATTERN`). It does not verify the actual §19 Abs. 1 turnover
conditions — previous-calendar-year turnover not exceeding €25,000 and current-calendar-year
turnover not exceeding €100,000 — nor whether the seller has irrevocably waived the exemption under §19 Abs. 3 (which
binds them for a minimum of five calendar years). Setting the exemption reason to reference §19
UStG documents intent; it does not substitute for confirming these conditions actually hold.

**Workaround:** Confirm the seller's actual §19 UStG eligibility (turnover history/forecast, and
absence of a standing Abs. 3 waiver) separately — e.g. against the seller's own accounting
records or Finanzamt correspondence — before issuing a small-business invoice.

### Export outside EU (category `G`) — no customs reference field

`ROADMAP.md`'s Week 9 scope mentions "optional customs reference support" for export
invoices. No field for this was added: neither `contractReference` (BT-12, added since Week 11
but it is actually a contract reference, not a customs one) nor `purchaseOrderReference` (BT-13,
still not added — see "Not yet mapped" in [`DATA-MODEL.md`](DATA-MODEL.md)) is a fit.
Adding an unbacked `customsReference` field with no confirmed XRechnung BT behind it was judged
worse than deferring.

**Workaround:** Use `note` (BT-22) for a customs reference in the interim if needed.

### Place of supply — only the default + B2B-service-override rule is checked; warning only, never blocks

Primary source: [§3a UStG][ustg-3a].

`core/utils/place-of-supply.ts` (`resolvePlaceOfSupply`) implements just one rule: the place of
supply defaults to the seller's country, and is overridden to the buyer's country for B2B
services when the two differ (EN 16931 / German VAT law's basic §3a rule). `validators/02.business-rules.ts`
wires this in as a single cross-border check: whenever seller and buyer countries differ, it
emits a `warning`-severity `PLACE_OF_SUPPLY_CROSS_BORDER` issue naming which place of supply
would apply if the transaction is a B2B service, so it can be verified by hand. This never blocks
`generateInvoice()` — it is informational only, unlike the `error`-severity checks elsewhere in
`02.business-rules.ts`.

Not covered at all:

- **Goods vs. services** — the internal `Invoice`/`InvoiceLine` schema has no field
  distinguishing a supply of goods from a supply of services, so `resolvePlaceOfSupply` can't
  pick the correct rule automatically; the warning message states both possibilities and leaves
  the choice to the caller.
- **B2C supplies** — no B2C place-of-supply rules (e.g. B2C digital/electronic services taxed at
  the customer's location under the EU One-Stop-Shop scheme, or the general B2C default-to-seller
  rule's own exceptions) are modeled; the function only branches on `isB2BService`, which callers
  must supply themselves.
- **Special place-of-supply categories** — real estate/immovable-property services (place = where
  the property is located), passenger transport, admission to events, restaurant/catering
  services, and short-term means-of-transport hire all have their own place-of-supply rules under
  §3a UStG that override both the default and the B2B-service rule; none of these are checked.

**Workaround:** Treat `PLACE_OF_SUPPLY_CROSS_BORDER` as a prompt to verify place of supply
manually for any cross-border invoice, not as confirmation that the invoice's VAT treatment is
correct. For goods, B2C, or the special categories above, this project provides no automated
signal at all.

### Deliver-to address (BG-15) — city/postal code not enforced by the TS validator (BR-DE-10/BR-DE-11)

Sources: [official XRechnung validator configuration][xrechnung-config] and [EN 16931 validation
artefacts][en16931].

This validator enforces BT-80 deliver-to country code whenever a `deliverTo` address is
supplied (EN 16931's `BR-57`, any VAT category — enforced both by JSON Schema and by
`validators/rules/11.delivery.ts`) and independently for category `K` (`BR-IC-12`). It does
**not** enforce Germany's `BR-DE-10`/`BR-DE-11` (published elsewhere as `DE-R-010`/`DE-R-011`),
which require BT-77 city and BT-78 postal code alongside the country code.

The custom TypeScript business-rule validator will currently accept a `deliverTo` address with
only a country code. Confirmed against the real KoSIT validator (`make validate-kosit`): a
`deliverTo` address missing city/postal code is rejected with `error`-severity `BR-DE-10`/
`BR-DE-11` findings on the generated XML — so this is a real, live gap for any invoice that
supplies a `deliverTo` group without city/postal code, not just a theoretical one. These are
unconditional XRechnung rules, not scoped to a "German supplier/customer" precondition — the
Schematron rule context is simply `cac:Delivery/cac:DeliveryLocation/cac:Address`
(`tools/kosit/config/resources/xrechnung/3.0.2/xsl/XRechnung-UBL-validation.xsl`), firing whenever
a `deliverTo` group (BG-15) is present at all, regardless of either party's country. So this gap
applies to every XRechnung-profile invoice with a `deliverTo` group, not just German-seller ones.

**Workaround:** populate `deliverTo.city`/`deliverTo.postalCode` whenever `deliverTo` is used —
required in practice even though the TypeScript validator won't catch its absence before
generation.

## Output Formats

### XML (XRechnung UBL 2.1) — implemented, tested against KoSIT

`adapters/xrechnung.ts` (Week 5) generates UBL 2.1 XML for all 21 current fixtures, and
`validators/test/90.kosit.test.ts` (run via `npm test`) confirms zero KoSIT `error`-severity
findings for each. Passing fixtures demonstrate coverage of those specific examples, not
that every document the adapter can produce will pass KoSIT; see
[`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output). §13b subcase-specific business-rule
enforcement (beyond the generic VAT category/rate checks) landed incrementally through Week 9 —
see the §13b section above for exactly which subcases have fixtures. Credit notes (`381`) and
corrective invoices (`384`) landed in Week 10, down payment/final/partial-delivery invoices in
Week 11 — see below. Legal scenarios beyond the current 21 fixtures (mixed VAT rates, etc.)
remain **Phase 3**.

### Hybrid PDF/A-3 (Factur-X / ZUGFeRD) — not yet implemented

Hybrid export is the deliverable of **Phase 4** (Weeks 13–16).

---

## Legal Scenarios

### Credit notes (document type 381) — implemented Week 10

`typeCode: "381"` is fully supported: `checkCreditNoteAndCorrectionRequirements`
(`validators/rules/10.credit-note.ts`) enforces `duePayableAmount <= 0` and requires
`precedingInvoiceReference` (BT-25/BT-26); `adapters/xrechnung.ts` renders a proper UBL
**`CreditNote`** document (`CreditNote-2` namespace, `cbc:CreditNoteTypeCode`,
`cac:CreditNoteLine`/`cbc:CreditedQuantity`) rather than an `Invoice` with type code `381` —
`381` isn't a legal `InvoiceTypeCode` value per `BR-CL-01`, it's a distinct UBL document type.
See `docs/DATA-MODEL.md`'s "Other invoice-level fields" section for the schema differences
(no `cbc:DueDate` on `CreditNoteType`, etc.). Two fixtures cover this: `16.credit-note-full` (full
reversal of an invoice) and `17.credit-note-partial` (only some line items credited); both pass
KoSIT with zero errors.

**Deferred:** no tooling validates a credit note's amounts against the invoice it references —
`precedingInvoiceReference` is just an `{id, issueDate}` pointer, not a live link to the original
`Invoice` object, so nothing catches e.g. a credit note crediting more than the original invoice's
total. This would need cross-document validation, out of scope for the current single-document
`generateInvoice()` pipeline.

### Corrective invoices (document type 384) — implemented Week 10

`typeCode: "384"` requires `precedingInvoiceReference` (same rule as `381`, but without the
non-positive-amount constraint, since a correction can add to, reduce, or leave unchanged what's
owed). Unlike `381`, `384` remains a UBL `Invoice` document — it's a legal `InvoiceTypeCode` value,
so no separate document-type rendering was needed. Fixture: `18.corrective-invoice`, which bills
only the changed line item (hours mistakenly omitted from the original invoice), not a full copy
of it.

**Deferred:** as with credit notes, "only the changed lines are present" is a fixture-authoring
convention, not something the schema or a validator enforces — the internal `Invoice` type has no
concept of "the original document" to diff against.

### Down payment / final invoices — implemented Week 11, single preceding-invoice reference only

A down payment invoice (Anzahlungsrechnung) needs no engine changes over a normal invoice — it's
just typeCode `380` for a partial amount, with its own VAT breakdown at the time of payment.
Fixture: `19.down-payment` (30% of a project billed up front).

A final invoice (Schlussrechnung) deducting a prior down payment sets `prepaidAmount` (BT-113); a
business rule in `validators/02.business-rules.ts` (`PRECEDING_INVOICE_REFERENCE_REQUIRED`)
requires it to also set `precedingInvoiceReference` (BT-25/BT-26) pointing at the down payment
invoice, mirroring the same reference-required pattern credit notes and corrective invoices already
use — a deduction with no pointer to what it deducts is as incomplete as a credit note with no
pointer to what it credits. `duePayableAmount` (BT-115) is checked against
`taxInclusiveAmount − prepaidAmount` (BT-112 − BT-113), per `INVOICE_DUE_PAYABLE_AMOUNT_MISMATCH`.
Fixture: `20.final-invoice`, referencing `19.down-payment` back and netting its gross amount out of
the full contract value.

**Limitation:** `precedingInvoiceReference` is a single `{id, issueDate}` object, not a list. A
final invoice can reference exactly one prior down payment invoice. This was a deliberate choice,
not an oversight: `precedingInvoiceReference` was introduced in Week 10 for credit notes/corrective
invoices, and broadening it to an array after one week of use — on a guess that multiple down
payments per final invoice will matter — would be premature generalization. If a real
multi-down-payment scenario comes up, that fixture should drive the field's redesign rather than
speculating now.

**Workaround:** for a final invoice deducting more than one down payment, sum the down payments
into a single `prepaidAmount` and reference the most recent (or otherwise most relevant) down
payment invoice; note the other down payment invoice IDs in the free-text `note` (BT-22) field.

### Partial delivery (Teilrechnung) — implemented Week 11, no dedicated fields for contract value / remaining balance

A partial delivery invoice bills one phase of a larger contract. `contractReference` (BT-12) is now
emitted as `cac:ContractDocumentReference/cbc:ID` (see [`DATA-MODEL.md`](DATA-MODEL.md)). Fixture:
`21.partial-delivery` (phase 1 of a 3-phase framework contract).

**Deferred:** "overall contract value" and "remaining balance" have no EN 16931/XRechnung Business
Term at all — not a gap in this project's mapping, but an absence in the standard itself. Inventing
a non-standard schema field for either would be unvalidatable by KoSIT and unrecognized by any
receiving system. `21.partial-delivery` states both in the free-text `note` (BT-22) field instead,
as a fixture-authoring convention — the same approach `18.corrective-invoice` used for "amended
lines only."

The following scenarios are known and planned but not yet implemented:

| Scenario                                                                                                                                       | Planned phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| §13b UStG reverse charge subcases beyond construction/scrap-and-waste/security-transfer/cleaning/mobile-devices/gas-and-electricity (fixtures) | Phase 3       |
| Mixed VAT rates on a single invoice                                                                                                            | Phase 3       |

---

## Validator Integration

KoSIT validator integration landed in **Phase 2, Week 6** (`validators/90.kosit.ts`, `make
validate-kosit`) — see [`COMPLIANCE.md`](COMPLIANCE.md#validating-xrechnung-output) for setup and usage. All 21 current
fixtures pass with zero `error`-severity findings, verified via `validators/test/90.kosit.test.ts`
as part of `npm test`.

The `BusinessRuleValidator` (`validators/02.business-rules.ts`, added in Week 3) checks VAT
category/rate consistency, §13b reverse-charge requirements, exemption reasons, and EN 16931
rounding/amount consistency directly on the internal `Invoice` model. This is independent of and
does not replace KoSIT: it catches business-rule violations before XML generation runs, while
KoSIT confirms full XRechnung Schematron/XSD conformance of the generated XML itself.

As of Week 7, `generateInvoice()` (`adapters/generate-invoice.ts`) composes business-rule
validation and XML generation: it runs `validateBusinessRules()` and only calls `toXRechnung()`
when there are no error-severity issues, returning `{ xml, issues }` rather than throwing.

KoSIT validation remains a separate external step and is not run automatically by
`generateInvoice()`. `toXRechnung()` remains available standalone — unchecked, always produces
XML — for callers who validate separately or via their own pipeline.

### Accepted KoSIT notices

- **`BR-DE-TMP-32`** (severity: `information`, not blocking) — 19 of the 21 current fixtures
  omit a delivery/service date (`export` and `intra-eu-supply` populate `actualDeliveryDate`;
  `intra-eu-supply` needs it regardless, per `BR-IC-11` below), even though BT-72 "Actual
  delivery date" is supported by this implementation; the other fixtures simply don't populate
  it. The rule's other two
  alternatives, BG-14 "Invoicing period" and per-line BG-26 "Invoice line period", are
  not currently supported. This is a national-extension recommendation, not a hard
  requirement, and is informational only for the fixtures that trigger it; the 2 fixtures
  that do populate `actualDeliveryDate` don't trigger this notice. Fixtures
  generated so far are still accepted by KoSIT despite this notice.

  For VAT category `K` (intra-EU supply), `BR-IC-11` makes BT-72 or BG-14 mandatory
  rather than merely recommended. Since BG-14 isn't supported, this implementation
  requires BT-72 for category `K` invoices — see `validators/rules/13.intra-eu.ts`.

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[en16931-artefacts]: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931
[ustae]: https://www.bundesfinanzministerium.de/ustae
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-25a]: https://www.gesetze-im-internet.de/ustg_1980/__25a.html
[ustg-3a]: https://www.gesetze-im-internet.de/ustg_1980/__3a.html
[ustg-3g]: https://www.gesetze-im-internet.de/ustg_1980/__3g.html
[ustg-anlage-3]: https://www.gesetze-im-internet.de/ustg_1980/anlage_3.html
[ustg-anlage-4]: https://www.gesetze-im-internet.de/ustg_1980/anlage_4.html
[xrechnung-config]: https://github.com/itplr-kosit/validator-configuration-xrechnung
