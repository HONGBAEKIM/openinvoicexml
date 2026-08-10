# Compliance sources

This page is the index of authoritative external sources this project's validation rules are
built against, plus a map of which rule comes from which layer and where it's implemented in
this codebase. When in doubt about a rule — or reviewing legal accuracy — start here instead
of hunting through code comments.

## Layers

EN 16931 and XRechnung are **different layers**. The EN 16931 repository does not contain
CIUS-specific rules (XRechnung is a CIUS — a Core Invoice Usage Specification built on top of
EN 16931) — so a `BR-DE-*` code will never be found there.

```
German VAT law (UStG)
    ↓
EN 16931 — European semantic data model & validation rules (BR-*, BT-*, BG-*)
    ↓
XRechnung — German CIUS, adds BR-DE-* rules on top of EN 16931
    ↓
OpenInvoiceXML — this project's TypeScript business-rule validation
```

## Sources

Check in this order:

| Source | URL | Use it for |
|---|---|---|
| XRechnung specification & KoSIT validation bundles | [xrechnung-spec] | Main page for German XRechnung requirements — start here |
| EN 16931 validation rules (GitHub) | [en16931] | Search for European rules, e.g. `BR-AE-01`, `BR-S-05`, `BT-118`. Does not contain XRechnung's `BR-DE-*` CIUS rules — those live in the KoSIT bundle above. |
| Latest EN 16931 validation releases | [en16931-releases] | Download the Schematron and XSLT validation files |
| EN 16931 supporting-artefacts & code-list registry | [en16931-artefacts] | VATEX codes and other EN 16931 code-list releases — the canonical registry linked from the EN 16931 repo itself |
| German invoice-content requirements, §14 UStG | [ustg-14] | Statutory text behind the mandatory invoice fields (Nr. 1–8) cited throughout `DATA-MODEL.md` |
| German VAT exemptions, §4 UStG | [ustg-4] | Statutory text behind the `E` VAT category's non-§19 exemptions |
| German export law, §6 UStG | [ustg-6] | Statutory text behind the `G` VAT category (third-country export) |
| German intra-community supply law, §6a UStG | [ustg-6a] | Statutory text behind the `K` VAT category (intra-EU supply) |
| German reverse-charge law, §13b UStG | [ustg-13b] | Statutory text behind the `AE` VAT category subcases |
| German tax rates, §12 UStG | [ustg-12] | Statutory text behind the 19%/7%/0% rates, including the §12 Abs. 3 photovoltaic 0% rate |
| German small-business law, §19 UStG | [ustg-19] | Statutory text behind the `E` VAT category (Kleinunternehmerregelung) |
| German place-of-supply law, §3a UStG | [ustg-3a] | Statutory text behind the place-of-supply default/B2B-service-override rule |
| German cross-border-supplier law, §3g UStG | [ustg-3g] | Statutory text behind the `gas-and-electricity` §13b subcase's Nr. 5(a) branch (supplier established abroad) |
| German differential-taxation law, §25a UStG | [ustg-25a] | Statutory text behind the `qualifying-gold`/`mobile-devices`/`industrial-metals` §13b subcase exclusions (margin-scheme goods) |
| Anlage 3 UStG | [ustg-anlage-3] | Goods list behind §13b Abs. 2 Nr. 7 (scrap/waste reverse charge) |
| Anlage 4 UStG | [ustg-anlage-4] | Goods list behind §13b Abs. 2 Nr. 11 (industrial-metals reverse charge) |
| Umsatzsteuer-Anwendungserlass (UStAE) | [ustae] | Current BMF administrative guidance interpreting the UStG sections above |

See ["Validating XRechnung output"](#validating-xrechnung-output) below for the KoSIT tooling
([kosit-validator], [xrechnung-config]) that runs against these bundles.

## Versions currently targeted

Values verified directly against `scripts/setup-kosit.sh`:

- XRechnung specification: 3.0.2
- XRechnung validator configuration bundle: `xrechnung-3.0.2-validator-configuration-2026-01-31`
  (tag `v2026-01-31`) — officially released with KoSIT Validator 1.6.0
- KoSIT validator (`itplr-kosit/validator`) used by this repository: 1.6.2 — a later release
  (17 Feb 2026) independently pinned in `scripts/setup-kosit.sh`, not the version the
  configuration bundle above originally shipped with
- EN 16931 validation artefacts / VATEX / code lists: whatever version is bundled inside the
  configuration package above — not tracked as a separate number in this repo
- German law (UStG §13b, §19): checked as of 2026-07-26

This repository uses KoSIT Validator 1.6.2 with the 2026-01-31 XRechnung configuration bundle.
The configuration release itself was originally published using Validator 1.6.0; nothing about
that pairing implies 1.6.2 came bundled with that XRechnung release.

Do not update the EN 16931 validation artefacts or code lists independently — check which
versions are used by the targeted XRechnung validator configuration bundle first.
`scripts/setup-kosit.sh` is where this project's pin lives; bump it there when a new
XRechnung version ships, per the existing note under ["Versions currently
targeted"](#versions-currently-targeted) below.

## Where this project uses each source

> The **Status** column describes OpenInvoiceXML's technical validation coverage only. It
> does not mean every statutory condition or real-world tax scenario is fully determined by
> the software — this is especially true for the "Partial" rows below.

| Reference | Meaning | Implemented in | Status |
|---|---|---|---|
| `§13b UStG` (Abs. 1 + Abs. 2 Nr. 1–12) | Reverse-charge groups | `validators/rules/15.reverse-charge.ts` | Partial — checks that free-text wording matches the declared subcase; does not verify subcase legal preconditions (e.g. the mobile-devices/industrial-metals €5,000 threshold) |
| `§19 UStG` | Kleinunternehmer tax exemption represented by this project using category `E` | `validators/rules/16.small-business.ts` | Partial — requires a seller tax ID once `§19 UStG` appears in the exemption reason; does not verify the underlying turnover conditions |
| `VATEX-EU-G`, `§4 Nr. 1 Buchst. a UStG` (export) | Category `G` | `validators/rules/12.export.ts` | Implemented |
| `VATEX-EU-IC`, `§6a UStG`, `BR-IC-11`, `BR-IC-12` | Intra-EU supply (category `K`) | `validators/rules/13.intra-eu.ts` | Implemented (BR-IC-11's BG-14 invoicing-period alternative to BT-72 is not supported). Also includes two checks beyond the formal EN 16931/XRechnung rules, as a §6a UStG plausibility safeguard: `INTRA_EU_SUPPLY_DELIVERY_COUNTRY_MATCHES_SELLER` (goods must leave the seller's own country) and `INTRA_EU_SUPPLY_SELLER_VAT_ID_INVALID_FORMAT`/`INTRA_EU_SUPPLY_BUYER_VAT_ID_INVALID_FORMAT` (per-country VAT ID format check, `core/utils/vat-id.ts` — pattern only, no checksum or VIES lookup) |
| `BR-O-02` | Outside scope (category `O`) | `validators/rules/14.outside-scope.ts` | Implemented |
| `BR-57` | Deliver-to country (BT-80) | `validators/rules/11.delivery.ts` | Implemented |
| `BT-25`/`BT-26` (EN 16931 §6.2.3) | Credit notes (`381`) and corrective invoices (`384`) must reference the invoice they correct; credit notes must not have a positive amount due | `validators/rules/10.credit-note.ts` | Partial — checks `duePayableAmount <= 0` for `381` and requires `precedingInvoiceReference` for `381`/`384`; does not verify a corrective invoice's amended lines against the original document (no schema concept of "the original document" to diff against — see [`LIMITATIONS.md`](LIMITATIONS.md)) |
| `BT-113`/`BT-25`/`BT-26` | A final invoice deducting a down payment (`prepaidAmount`) must reference the down payment invoice it deducts | `validators/02.business-rules.ts` (inline) | Partial — `precedingInvoiceReference` is a single reference, not a list, so only one prior down payment invoice can be pointed to per final invoice (see [`LIMITATIONS.md`](LIMITATIONS.md)) |
| `BT-118`/`BT-119` VAT rate rules | Category ↔ rate consistency | `validators/rules/17.vat-rate.ts` | Implemented |
| `BT-120`/`BT-121` exemption-reason presence | Exemption reason required/forbidden per category | `validators/rules/17.vat-rate.ts` (constant) + `validators/02.business-rules.ts` (enforcement) | Implemented |
| `BR-DE-10`/`BR-DE-11` | Deliver-to city/postal code | — | Not implemented — see [`LIMITATIONS.md`](LIMITATIONS.md) |
| Full BT → field mapping | — | [`DATA-MODEL.md`](DATA-MODEL.md) | Reference |

---

## Validating XRechnung output

`adapters/xrechnung.ts` produces XML by construction, but the generated document
must still be checked against the official XRechnung XSD and Schematron rules.
This project uses the **KoSIT validator** (`itplr-kosit/validator`) and the official
XRechnung validator configuration as its reference validation toolchain, wired into
a local `make` target so "passes KoSIT with zero errors" is a repeatable check, not
a manual read of the spec.

### Prerequisites

- Java 11+ **or** none at all — `make kosit-setup` downloads a portable JRE (Eclipse
  Temurin 17) into `tools/jre/` if no `java` binary is found on `PATH`. No root/sudo
  required either way.
- Network access, for the one-time download in `make kosit-setup`.

### One-time setup

```bash
make kosit-setup
```

This downloads, into the git-ignored `tools/` directory:

- `tools/kosit/validator.jar` — the KoSIT validator CLI ([itplr-kosit/validator][kosit-validator])
- `tools/kosit/config/` — the XRechnung 3.0.x scenario/Schematron/XSD bundle ([itplr-kosit/validator-configuration-xrechnung][xrechnung-config])
- `tools/jre/` — a portable JRE, only if `java` wasn't already available

Versions are pinned in `scripts/setup-kosit.sh` so results are reproducible across
machines and CI; bump them there when a new XRechnung version ships.

### Running validation

```bash
make validate-kosit
```

This regenerates XML from all fixtures (`make generate`) and runs each file through
KoSIT via `validators/90.kosit.ts`'s `runKosit()`. Output looks like:

```
✓ dist/xml/domestic-simple.xml
✓ dist/xml/domestic-multi-line.xml
✗ dist/xml/exempt.xml — 1 error(s)
    [BR-DE-2] Die Gruppe "SELLER CONTACT" (BG-6) muss übermittelt werden.
```

The command exits non-zero if any file has an `error`-severity finding — safe to wire
into CI once a pipeline exists. `warning` and `information`-level findings are printed
by inspecting the `KositResult.issues` array directly (see `validators/90.kosit.ts`); they
don't fail the build. Accepted findings of that kind are tracked in
[`LIMITATIONS.md`](LIMITATIONS.md).

### How it works

`runKosit()` shells out to `java -jar tools/kosit/validator.jar -s
tools/kosit/config/scenarios.xml -o <reportDir> <xmlFiles...>` and parses the
`<name>-report.xml` KoSIT writes per input file into a structured
`{ file, valid, issues: [{ severity, message, location }] }` result — no XML-parsing
dependency is added; a small hand-rolled tag scan is enough for the two things this
project needs (severity + message).

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[en16931-artefacts]: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931
[en16931-releases]: https://github.com/ConnectingEurope/eInvoicing-EN16931/releases
[kosit-validator]: https://github.com/itplr-kosit/validator
[ustae]: https://www.bundesfinanzministerium.de/ustae
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-14]: https://www.gesetze-im-internet.de/ustg_1980/__14.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-25a]: https://www.gesetze-im-internet.de/ustg_1980/__25a.html
[ustg-3a]: https://www.gesetze-im-internet.de/ustg_1980/__3a.html
[ustg-3g]: https://www.gesetze-im-internet.de/ustg_1980/__3g.html
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-6]: https://www.gesetze-im-internet.de/ustg_1980/__6.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
[ustg-anlage-3]: https://www.gesetze-im-internet.de/ustg_1980/anlage_3.html
[ustg-anlage-4]: https://www.gesetze-im-internet.de/ustg_1980/anlage_4.html
[xrechnung-config]: https://github.com/itplr-kosit/validator-configuration-xrechnung
[xrechnung-spec]: https://xeinkauf.de/xrechnung/
