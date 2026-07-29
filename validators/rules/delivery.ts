import type { Invoice } from "../../core/types/invoice.js";
import type { ValidationIssue } from "../types.js";

/**
 * Checks EN 16931's BR-57: whenever a deliver-to address (BG-15) is supplied,
 * it must carry a country code (BT-80) — regardless of VAT category.
 *
 * @see ../../docs/COMPLIANCE.md for the BR-57 source.
 */
export function checkDeliveryAddressRequirements(
  delivery: Invoice["delivery"],
  issues: ValidationIssue[],
): void {
  if (delivery?.deliverTo === undefined) return;

  if (!delivery.deliverTo.countryCode) {
    issues.push({
      code: "DELIVERY_COUNTRY_REQUIRED",
      severity: "error",
      message:
        "delivery.deliverTo.countryCode: BT-80 deliver-to country code is required whenever a deliver-to address (BG-15) is supplied, per BR-57.",
      path: "delivery.deliverTo.countryCode",
    });
  }
}
