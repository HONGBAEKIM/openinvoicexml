import type { VatCategoryCode } from "./vat-breakdown.js";

/**
 * BG-20/BG-21 (document level) or BG-27/BG-28 (line level): an allowance (discount)
 * or charge (surcharge).
 */
export interface AllowanceCharge {
  /** BT-92/BT-99 (document) or BT-136/BT-141 (line): allowance or charge amount. */
  amount: number;
  /** UBL cbc:ChargeIndicator — false = allowance/discount, true = charge/surcharge. */
  isCharge: boolean;
  /** BT-97/BT-104 (document) or BT-139/BT-144 (line): reason text. */
  reason?: string;
  /** BT-98/BT-105 (document) or BT-140/BT-145 (line): reason code. */
  reasonCode?: string;
  /**
   * BT-95/BT-102: VAT category code. Document-level only — line-level entries
   * inherit the line's own vatCategoryCode/vatRate and must omit this.
   */
  vatCategoryCode?: VatCategoryCode;
  /** BT-96/BT-103: VAT rate. Document-level only. */
  vatRate?: number;
}