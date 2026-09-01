# Compliance sources

Index of authoritative external sources this project's validation rules are built against, plus
a map of which rule comes from which layer and where it's implemented. When in doubt about a
rule — or reviewing legal accuracy — start here instead of hunting through code comments.

## Layers

EN 16931 and XRechnung are **different layers**. The EN 16931 repository does not contain
CIUS-specific rules (XRechnung is a CIUS built on top of EN 16931) — a `BR-DE-*` code will never
be found there.

CIUS:   Core Invoice Usage Specification

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

| Source | URL | Use it for |
|---|---|---|
| XRechnung specification & KoSIT validation bundles | [xrechnung-spec] | Main page for German XRechnung requirements |
| EN 16931 validation rules (GitHub) | [en16931] | European rules (`BR-AE-01`, `BT-118`, etc.) — not XRechnung's `BR-DE-*` |
| EN 16931 supporting-artefacts & code-list registry | [en16931-artefacts] | VATEX codes and other EN 16931 code-list releases |
| §14 UStG | [ustg-14] | Mandatory invoice fields |
| §4 UStG | [ustg-4] | VAT exemptions (`E` category) |
| §6 UStG | [ustg-6] | Export outside EU (`G` category) |
| §6a UStG | [ustg-6a] | Intra-EU supply (`K` category) |
| §13b UStG | [ustg-13b] | Reverse-charge subcases (`AE` category) |
| §12 UStG | [ustg-12] | German VAT rates (19%/7%/0%) |
| §19 UStG | [ustg-19] | Small-business exemption (Kleinunternehmerregelung) |
| §3a UStG | [ustg-3a] | Place-of-supply default/B2B-override rule |
| Anlage 3 / Anlage 4 UStG | [ustg-anlage-3] / [ustg-anlage-4] | Goods lists behind specific §13b subcases |
| Umsatzsteuer-Anwendungserlass (UStAE) | [ustae] | Current BMF administrative guidance |
| PDF/A-3 (ISO 19005-3) conformance | [verapdf] | Reference validator used by this project to check PDF/A-3b conformance against ISO 19005-3 — the same role KoSIT plays for XRechnung XML |

## Versions currently targeted

- XRechnung specification: 3.0.2
- XRechnung validator configuration bundle: `xrechnung-3.0.2-validator-configuration-2026-01-31`
- KoSIT validator (`itplr-kosit/validator`): 1.6.2
- veraPDF validator (`veraPDF/veraPDF-apps`): 1.30.2
- Mustang Project CLI (`ZUGFeRD/mustangproject`, release tag `core-2.26.0`): 2.26.0
- German law (UStG §13b, §19): checked as of 2026-07-26

Pinned in `scripts/setup-kosit.sh` (KoSIT) / `scripts/setup-verapdf.sh` (veraPDF) /
`scripts/setup-mustang.sh` (Mustang) — bump there when a new version ships. Don't update EN 16931
artefacts/code lists independently of the XRechnung config bundle version above.

## Where this project uses each source

> The **Status** column describes OpenInvoiceXML's technical validation coverage only — it does
> not mean every statutory condition is fully determined by the software, especially for
> "Partial" rows.

| Reference | Meaning | Implemented in | Status |
|---|---|---|---|
| `§13b UStG` (Abs. 1 + Abs. 2 Nr. 1–12) | Reverse-charge groups | `validators/rules/15.reverse-charge.ts` | Partial — checks free-text wording, not subcase legal preconditions |
| `§19 UStG` | Small-business exemption (category `E`) | `validators/rules/16.small-business.ts` | Partial — requires a seller tax ID, doesn't verify turnover |
| `VATEX-EU-G`, `§4 Nr. 1 Buchst. a UStG` | Export (category `G`) | `validators/rules/12.export.ts` | Implemented |
| `VATEX-EU-IC`, `§6a UStG`, `BR-IC-11/12` | Intra-EU supply (category `K`) | `validators/rules/13.intra-eu.ts` | Implemented (BG-14 alternative to BT-72 not supported) |
| `BR-O-02` | Outside scope (category `O`) | `validators/rules/14.outside-scope.ts` | Implemented |
| `BR-57` | Deliver-to country (BT-80) | `validators/rules/11.delivery.ts` | Implemented |
| `BT-25`/`BT-26` | Credit note / corrective invoice reference | `validators/rules/10.credit-note.ts` | Partial — no diff against the original document |
| `BT-113`/`BT-25`/`BT-26` | Down-payment deduction reference | `validators/02.business-rules.ts` (inline) | Partial — single reference only |
| `BT-118`/`BT-119` | VAT rate rules | `validators/rules/17.vat-rate.ts` | Implemented |
| `BT-120`/`BT-121` | Exemption-reason presence | `validators/rules/17.vat-rate.ts` + `02.business-rules.ts` | Implemented |
| `BR-DE-10`/`BR-DE-11` | Deliver-to city/postal code | — | Not implemented — see [`LIMITATIONS.md`](LIMITATIONS.md) |
| Full BT → field mapping | — | [`DATA-MODEL.md`](DATA-MODEL.md) | Reference |

---

## Validating this project's output

Every output format this project generates is checked against an external reference validator,
not just this project's own adapter logic.

### XRechnung XML (KoSIT)

`adapters/xrechnung.ts` produces XML by construction, but the generated document must still be
checked against the official XRechnung XSD/Schematron rules. This project uses the **KoSIT
validator** as its reference toolchain, wired into `make` targets.

**Prerequisites:** Java 11+, or none — `make kosit-setup` downloads a portable JRE if no `java`
binary is found. Needs network access for the one-time download.

```bash
make kosit-setup      # one-time: downloads tools/kosit/validator.jar + XRechnung config bundle
make validate-kosit   # regenerates XML from all fixtures and runs each through KoSIT
```

Output looks like:

```
✓ dist/xml/domestic-simple.xml
✗ dist/xml/exempt.xml — 1 error(s)
    [BR-DE-2] Die Gruppe "SELLER CONTACT" (BG-6) muss übermittelt werden.
```

Exits non-zero on any `error`-severity finding. `warning`/`information`-level findings don't fail
the build; accepted ones are tracked in [`LIMITATIONS.md`](LIMITATIONS.md).

`runKosit()` (`validators/90.kosit.ts`) shells out to the KoSIT jar and parses its per-file XML
report into `{ file, valid, issues: [{ severity, message, location }] }` — see [`API.md`](API.md).

### Hybrid PDF/A-3 (veraPDF)

`adapters/hybrid-pdf.ts` produces a PDF/A-3b invoice with the XRechnung UBL XML embedded as an
associated file, but the generated PDF must still be checked against the official PDF/A-3
conformance rules (ISO 19005-3) — fonts, color spaces, XMP metadata. This project uses the
**veraPDF validator** as its reference toolchain, wired into the same `make` target convention as
KoSIT.

**Prerequisites:** No pre-installed Java is required. `make verapdf-setup` uses the project's
portable JRE if available, otherwise a compatible system Java, and downloads the portable JRE
when necessary. Network access is required for the initial setup.

```bash
make verapdf-setup      # one-time: downloads and installs the veraPDF CLI into tools/verapdf/
make validate-verapdf   # regenerates hybrid PDFs from all fixtures and runs each through veraPDF
```

Output looks like:

```
✓ dist/pdf/domestic-simple.pdf
✗ dist/pdf/exempt.pdf — 1 error(s)
    6.2.11.4.1: The font program is not embedded
```

Exits non-zero on any `error`-severity finding — veraPDF's PDF/A-3b conformance model is binary
(compliant/non-compliant), so every failed check is an error; there's no separate warning tier the
way KoSIT's Schematron severities have.

`runVeraPdf()` (`validators/91.vera-pdf.ts`) shells out to the installed veraPDF CLI and parses
its batch XML report into `{ file, valid, issues: [{ severity, message, location }] }` — see
[`API.md`](API.md).

**Not a Factur-X/ZUGFeRD hybrid.** The embedded XML is XRechnung UBL, not CII — every Factur-X/
ZUGFeRD conformance level (including the `XRECHNUNG` profile name) requires CII syntax, so this
PDF deliberately carries no `fx:` XMP metadata claiming ZUGFeRD/Factur-X conformance — see
[`LIMITATIONS.md`](LIMITATIONS.md). All 30 fixtures pass veraPDF's PDF/A-3b profile with zero
errors.

`make validate-hybrid` automates a round-trip check across all 30 fixtures: it runs veraPDF
against every generated hybrid PDF, then extracts each one's embedded XML
(`extractEmbeddedXml()`, `adapters/hybrid-pdf.ts`) and runs *that* through KoSIT — proving what a
real recipient would actually extract from the PDF is itself a conformant XRechnung document, not
just that the PDF passes PDF/A-3b on its own.

### Cross-tool corroboration (Mustang Project)

`make validate-mustang` runs the same kind of round-trip proof as `validate-hybrid`, but through
an independent, third-party tool instead of this project's own `extractEmbeddedXml()`: the
[Mustang Project][mustang-tool] CLI's own `--action extract` must recover XML byte-for-byte
identical to `toXRechnung()`'s direct output from every one of the 30 generated hybrid PDFs
(despite the PDF not being ZUGFeRD-branded), and Mustang's own `--action validate` — run against
that *extracted* XML, not the PDF — must independently corroborate this project's EN16931/
XRechnung UBL validation findings with zero error-severity findings.

Validating the extracted XML rather than the PDF directly is a deliberate choice: pointing
`--action validate` at the PDF itself pulls in Mustang's own Factur-X/PDF-profile interpretation
of that PDF (e.g. `[BR-DE-...]`-unrelated complaints about missing `fx:` XMP metadata, and
`Factur-X/ZUGFeRD and Order-X are always strictly CII only, no UBL allowed`) — true statements
about Factur-X/ZUGFeRD, but irrelevant to whether this project's XRechnung UBL output is itself
conformant. `runMustang()` can still validate a PDF directly (exercised as a capability check in
`validators/test/92.mustang.test.ts`, not as the gating Makefile check) for exactly that reason.

**Prerequisites:** same as KoSIT/veraPDF — `make mustang-setup` downloads the pinned Mustang CLI
jar (and a portable JRE if none is available) into `tools/mustang/`.

```bash
make mustang-setup      # one-time: downloads tools/mustang/mustang-cli.jar
make validate-mustang   # regenerates hybrid PDFs, extracts+diffs, then validates each via Mustang
```

`runMustang()`/`extractWithMustang()` (`validators/92.mustang.ts`) shell out to the Mustang CLI
jar. Unlike KoSIT/veraPDF, Mustang's process exit code is a deliberate, meaningful validity signal
(it exits non-zero exactly when its own report's status is `invalid`), so the wrapper cross-checks
the exit code against the parsed report rather than ignoring it — see [`API.md`](API.md) for the
`MustangResult`/`MustangIssue` shapes.

[en16931]: https://github.com/ConnectingEurope/eInvoicing-EN16931
[en16931-artefacts]: https://ec.europa.eu/digital-building-blocks/sites/display/DIGITAL/Registry+of+supporting+artefacts+to+implement+EN16931
[ustae]: https://www.bundesfinanzministerium.de/ustae
[ustg-12]: https://www.gesetze-im-internet.de/ustg_1980/__12.html
[ustg-13b]: https://www.gesetze-im-internet.de/ustg_1980/__13b.html
[ustg-14]: https://www.gesetze-im-internet.de/ustg_1980/__14.html
[ustg-19]: https://www.gesetze-im-internet.de/ustg_1980/__19.html
[ustg-3a]: https://www.gesetze-im-internet.de/ustg_1980/__3a.html
[ustg-4]: https://www.gesetze-im-internet.de/ustg_1980/__4.html
[ustg-6]: https://www.gesetze-im-internet.de/ustg_1980/__6.html
[ustg-6a]: https://www.gesetze-im-internet.de/ustg_1980/__6a.html
[ustg-anlage-3]: https://www.gesetze-im-internet.de/ustg_1980/anlage_3.html
[ustg-anlage-4]: https://www.gesetze-im-internet.de/ustg_1980/anlage_4.html
[verapdf]: https://verapdf.org/
[xrechnung-spec]: https://xeinkauf.de/xrechnung/
[mustang-tool]: https://github.com/ZUGFeRD/mustangproject
