import type { Invoice } from "../../core/types/invoice.js";
import type { Party } from "../../core/types/party.js";
import type { VatBreakdown } from "../../core/types/vat-breakdown.js";
import type { ValidationIssue } from "../types.js";
import { isEuCountry } from "../../core/utils/eu-countries.js";
import { isValidVatIdFormat } from "../../core/utils/vat-id.js";

/** §6a UStG (intra-community supply) reference expected in category 'K' exemption reasons. */
const INTRA_EU_REFERENCE_PATTERN = /§\s?6a\s?UStG/i;

/**
 * Checks intra-EU supply (VAT category 'K') requirements: both seller and buyer must
 * have a present, correctly-formatted VAT ID and be in (different) EU member states,
 * the goods must be delivered outside the seller's own country, the exemption reason
 * must reference §6a UStG / intra-community supply specifically, and delivery
 * information must be present per BR-IC-11 (BT-72 — this implementation doesn't support
 * the BG-14 invoicing-period alternative, so BT-72 is required in practice) and
 * BR-IC-12 (BT-80 deliver-to country code).
 *
 * VAT ID format checking is a local pattern check only (no checksum or VIES-registry
 * lookup) — see `core/utils/vat-id.ts`.
 *
 * @see ../../docs/COMPLIANCE.md for the VATEX-EU-IC / §6a UStG source and the BG-14 limitation.
 */
export function checkIntraEuSupplyRequirements(
  seller: Party,
  buyer: Party,
  vatBreakdowns: VatBreakdown[],
  delivery: Invoice["delivery"],
  issues: ValidationIssue[],
): void {
  const intraEuBreakdowns = vatBreakdowns
    .map((vb, index) => ({ vb, index }))
    .filter(({ vb }) => vb.categoryCode === "K");

  if (intraEuBreakdowns.length === 0) return;

  if (!seller.vatId) {
    issues.push({
      code: "INTRA_EU_SUPPLY_SELLER_VAT_ID_REQUIRED",
      severity: "error",
      message:
        "seller.vatId: BT-31 seller VAT identifier is required for VAT category 'K' (intra-EU supply, §6a UStG).",
      path: "seller.vatId",
    });
  } else if (!isValidVatIdFormat(seller.address.countryCode, seller.vatId)) {
    issues.push({
      code: "INTRA_EU_SUPPLY_SELLER_VAT_ID_INVALID_FORMAT",
      severity: "error",
      message: `seller.vatId: BT-31 seller VAT identifier '${seller.vatId}' does not match the expected format for country '${seller.address.countryCode}'.`,
      path: "seller.vatId",
    });
  }
  if (!buyer.vatId) {
    issues.push({
      code: "INTRA_EU_SUPPLY_BUYER_VAT_ID_REQUIRED",
      severity: "error",
      message:
        "buyer.vatId: BT-48 buyer VAT identifier is required for VAT category 'K' (intra-EU supply, §6a UStG).",
      path: "buyer.vatId",
    });
  } else if (!isValidVatIdFormat(buyer.address.countryCode, buyer.vatId)) {
    issues.push({
      code: "INTRA_EU_SUPPLY_BUYER_VAT_ID_INVALID_FORMAT",
      severity: "error",
      message: `buyer.vatId: BT-48 buyer VAT identifier '${buyer.vatId}' does not match the expected format for country '${buyer.address.countryCode}'.`,
      path: "buyer.vatId",
    });
  }

  if (!isEuCountry(seller.address.countryCode)) {
    issues.push({
      code: "INTRA_EU_SUPPLY_SELLER_COUNTRY_NOT_EU",
      severity: "error",
      message: `seller.address.countryCode: VAT category 'K' (intra-EU supply) requires the seller to be in an EU member state, found '${seller.address.countryCode}'.`,
      path: "seller.address.countryCode",
    });
  }
  if (!isEuCountry(buyer.address.countryCode)) {
    issues.push({
      code: "INTRA_EU_SUPPLY_BUYER_COUNTRY_NOT_EU",
      severity: "error",
      message: `buyer.address.countryCode: VAT category 'K' (intra-EU supply) requires the buyer to be in an EU member state, found '${buyer.address.countryCode}'.`,
      path: "buyer.address.countryCode",
    });
  }
  if (seller.address.countryCode === buyer.address.countryCode) {
    issues.push({
      code: "INTRA_EU_SUPPLY_COUNTRY_MISMATCH",
      severity: "error",
      message:
        "VAT category 'K' (intra-EU supply) requires the seller and buyer to be in different EU member states.",
      path: "buyer.address.countryCode",
    });
  }

  if (!delivery?.actualDeliveryDate) {
    issues.push({
      code: "INTRA_EU_SUPPLY_DELIVERY_DATE_REQUIRED",
      severity: "error",
      message:
        "delivery.actualDeliveryDate: BT-72 actual delivery date is required for VAT category 'K' (intra-EU supply) per BR-IC-11. (BR-IC-11 also allows a BG-14 invoicing period instead, which this implementation doesn't support.)",
      path: "delivery.actualDeliveryDate",
    });
  }
  // Only flag a missing deliver-to address group here; a deliverTo group that's present
  // but missing countryCode is caught by the general BR-57 check in rules/11.delivery.ts,
  // to avoid reporting the same missing value twice.
  if (!delivery?.deliverTo) {
    issues.push({
      code: "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_REQUIRED",
      severity: "error",
      message:
        "delivery.deliverTo.countryCode: BT-80 deliver-to country code is required for VAT category 'K' (intra-EU supply) per BR-IC-12.",
      path: "delivery.deliverTo.countryCode",
    });
  } else if (
    delivery.deliverTo.countryCode &&
    delivery.deliverTo.countryCode === seller.address.countryCode
  ) {
    issues.push({
      code: "INTRA_EU_SUPPLY_DELIVERY_COUNTRY_MATCHES_SELLER",
      severity: "error",
      message: `delivery.deliverTo.countryCode: VAT category 'K' (intra-EU supply) requires the goods to leave the seller's country ('${seller.address.countryCode}'), but they were delivered there.`,
      path: "delivery.deliverTo.countryCode",
    });
  }

  intraEuBreakdowns.forEach(({ vb, index }) => {
    const hasSomeReason = Boolean(vb.exemptionReason) || Boolean(vb.exemptionReasonCode);
    const referencesIntraEu =
      INTRA_EU_REFERENCE_PATTERN.test(vb.exemptionReason ?? "") ||
      vb.exemptionReasonCode === "VATEX-EU-IC";

    if (hasSomeReason && !referencesIntraEu) {
      issues.push({
        code: "INTRA_EU_SUPPLY_EXEMPTION_REASON_INVALID",
        severity: "error",
        message: `vatBreakdowns[${index}]: BT-120/BT-121 exemption reason for VAT category 'K' must reference §6a UStG / intra-community supply (e.g. exemption reason code 'VATEX-EU-IC').`,
        path: `vatBreakdowns[${index}]`,
      });
    }
  });
}
