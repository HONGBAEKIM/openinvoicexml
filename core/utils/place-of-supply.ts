import type { Party } from "../types/party.js";

/**
 * Resolves place-of-supply per the basic rule: defaults to the seller's country;
 * for B2B services, overrides to the buyer's country when it differs from the seller's.
 * Goods supplies and the non-B2B-service place-of-supply rules are out of scope for now
 * (see LIMITATIONS.md) — this only covers the default + B2B-service-override case.
 * 
 * Why we have b2b and b2c?
 * business buyer can report VAT itself, but a private customer normally cannot.
 */
export function resolvePlaceOfSupply(seller: Party, buyer: Party, isB2BService: boolean): string {
  if (isB2BService && buyer.address.countryCode !== seller.address.countryCode) {
    return buyer.address.countryCode;
  }
  return seller.address.countryCode;
}
