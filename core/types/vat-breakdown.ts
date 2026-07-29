/**
 * VAT category codes allowed by EN 16931 / XRechnung
 * (subset of UNTDID 5305).
 *
 * Note: "AA" (reduced rate) exists in UNTDID 5305 but is not used by
 * EN 16931/XRechnung for German reduced VAT. Both the German standard
 * rate of 19% and reduced rate of 7% use category "S"; the percentage
 * is carried separately in BT-119 and BT-152.
 *
 * S  = Standard-rated VAT, including the German 19% and 7% rates
 * Z  = Zero-rated: the transaction is taxable, but the VAT rate is 0%
 * E  = Exempt from VAT
 * AE = Reverse charge: the customer accounts for VAT
 * K  = Intra-community supply
 * G  = Export outside the EU
 * O  = Outside the scope of VAT / not subject to VAT
 */
export type VatCategoryCode = "S" | "Z" | "E" | "AE" | "K" | "G" | "O";

/**
 * §13b UStG reverse-charge transaction-type identifier.
 *
 * Internal only and not emitted to XML. VATEX does not distinguish the German
 * §13b subcases, so KoSIT-facing output remains generic (`AE` /
 * `VATEX-EU-AE`).
 *
 * This value identifies the declared transaction type but does not by itself
 * establish that reverse charge legally applies. Recipient status,
 * certificates, thresholds, supplier establishment, options to tax and other
 * statutory conditions may also need to be verified.
 *
 * Covers all top-level transaction categories expressly listed in
 * §13b Abs. 1 and Abs. 2 Nr. 1–12 UStG.
 *
 * It does not determine whether reverse charge legally applies. It does not
 * model every statutory subcase, exclusion, recipient condition, supplier
 * establishment rule, customs classification, threshold, certificate
 * requirement, option to tax, differential-taxation treatment under §25a,
 * or other legal condition.
 *
 * The value is used only to classify the declared transaction type and to
 * validate the corresponding invoice reason text.
 *
 * In particular, `mobile-devices` and `industrial-metals` apply only when the
 * sum of the consideration to be invoiced for the relevant goods within one
 * economic transaction is at least €5,000. Subsequent reductions of the
 * consideration are disregarded. This field currently verifies neither the
 * €5,000 threshold nor the treatment of subsequent reductions.
 *
 * @see https://www.gesetze-im-internet.de/ustg_1980/__13b.html
 * @see docs/COMPLIANCE.md
 * @see docs/LIMITATIONS.md for the per-subcase eligibility conditions this type doesn't verify
 */
export type ReverseChargeSubcase =
  // Cross-border services (§13b Abs. 1 UStG)
  /**
   * Services taxable in Germany under §3a Abs. 2, supplied by an entrepreneur
   * established elsewhere in the EU (§13b Abs. 1 UStG).
   */
  | "eu-cross-border-service"

  // Transactions under §13b Abs. 2 Nr. 1–12 UStG
  /**
   * Work supplies and services not covered by Abs. 1,
   * supplied by an entrepreneur established abroad
   * (§13b Abs. 2 Nr. 1 UStG).
   */
  | "foreign-supplier"

  /** Delivery of goods transferred as security outside insolvency proceedings (§13b Abs. 2 Nr. 2 UStG). */
  | "security-transfer"

  /** Transactions falling under the Real Estate Transfer Tax Act (§13b Abs. 2 Nr. 3 UStG). */
  | "real-estate"

  /** Construction services (§13b Abs. 2 Nr. 4 UStG). */
  | "construction"

  /** Certain gas and electricity supplies (§13b Abs. 2 Nr. 5 UStG). */
  | "gas-and-electricity"

  /**
   * Transfers of emission allowances, emissions-reduction units,
   * certified emissions reductions, fuel-emissions certificates,
   * and gas or electricity certificates
   * (§13b Abs. 2 Nr. 6 UStG).
   */
  | "emission-certificates"

  /** Supplies of scrap, waste and other goods listed in Anlage 3 (§13b Abs. 2 Nr. 7 UStG). */
  | "scrap-and-waste"

  /** Cleaning of buildings and parts of buildings (§13b Abs. 2 Nr. 8 UStG). */
  | "cleaning"

  /**
   * Certain supplies of qualifying gold and gold plating
   * (§13b Abs. 2 Nr. 9 UStG).
   */
  | "qualifying-gold"

  /** Mobile phones, tablets, game consoles and certain integrated circuits (§13b Abs. 2 Nr. 10 UStG). */
  | "mobile-devices"

  /** Supplies of goods listed in Anlage 4 (§13b Abs. 2 Nr. 11 UStG). */
  | "industrial-metals"

  /** Certain telecommunications services (§13b Abs. 2 Nr. 12 UStG). */
  | "telecommunications";

/** BG-23: VAT breakdown for one VAT category on the invoice. */
export interface VatBreakdown {
  /** BT-118: VAT category code. */
  categoryCode: VatCategoryCode;
  /** BT-119: VAT category rate as a percentage. */
  rate: number;
  /** BT-116: Sum of taxable amounts for this VAT category. */
  taxableAmount: number;
  /** BT-117: VAT amount for this VAT category. */
  taxAmount: number;

  /**
   * BT-120: VAT exemption reason text.
   *
   * Required for categories E, AE, K, G and O unless BT-121 is supplied
   * instead. Must not be supplied for categories S or Z.
   */
  exemptionReason?: string;

  /**
   * BT-121: VAT exemption reason code from the VATEX code list.
   *
   * Alternative to BT-120 for categories E, AE, K, G and O.
   * Must not be supplied for categories S or Z.
   */
  exemptionReasonCode?: string;

  /**
   * Internal §13b UStG reverse-charge subcase.
   * Only applicable when categoryCode is "AE".
   */
  reverseChargeReason?: ReverseChargeSubcase;
}
