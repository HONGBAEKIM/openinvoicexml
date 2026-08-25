/**
 * German-locale display formatting for the hybrid PDF adapter. Not XML/machine formats
 * (see xml.ts's amt() for that) — these produce human-readable German text.
 */

/**
 * Formats a YYYY-MM-DD calendar date as German DD.MM.YYYY.
 *
 * Deliberately a plain string transform, not `new Date(isoDate)` + `Intl.DateTimeFormat`:
 * Invoice dates are calendar dates, not timestamps, and parsing them through `Date` risks a
 * timezone-dependent off-by-one-day shift depending on the runtime's local timezone.
 */
export function formatDateDE(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Formats a monetary amount as German-locale currency text, e.g. formatAmountDE(1190, "EUR")
 * -> "1.190,00 €". Uses Intl.NumberFormat since the input is a plain number with no
 * parsing/timezone hazard (unlike formatDateDE's string input).
 */
export function formatAmountDE(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: currencyCode }).format(
    value,
  );
}
