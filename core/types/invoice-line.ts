import type { VatCategoryCode } from "./vat-breakdown.js";
import type { AllowanceCharge } from "./allowance-charge.js";

/** BG-25: A single line item on an invoice. */
export interface InvoiceLine {
  /** BT-126: Line identifier — unique within this invoice. */
  id: string;
  /** BT-153: Item name. */
  name: string;
  /** BT-154: Item description. */
  description?: string;

  /** BT-129: Invoiced quantity. */
  quantity: number;
  /** BT-130: Unit of measure code (UN/ECE Recommendation 20). */
  unitCode: string;

  /** BT-146: Item net price (per unit, before discounts). */
  unitPrice: number;
  /** BT-131: Line net amount (quantity × unitPrice after line-level discounts). */
  lineAmount: number;

  /** BT-151: VAT category code for this line. */
  vatCategoryCode: VatCategoryCode;
  /** BT-152: VAT rate as a percentage (e.g. 19, 7, 0). */
  vatRate: number;

  /** BG-27/BG-28: Line-level allowances (discounts) and charges (surcharges). */
  allowancesCharges?: AllowanceCharge[];
}
