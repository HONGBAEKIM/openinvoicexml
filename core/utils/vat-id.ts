/**
 * Per-country VAT identifier body patterns (VIES local formats, prefix stripped).
 * @see https://ec.europa.eu/taxation_customs/vies/#/faq (format table)
 * 
 * /       starts the regular expression
 * ^       start of the text
 * *****   the required pattern
 * $       end of the text
 * /       ends the regular expression
 * 
 */
const VAT_ID_BODY_PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/, // Austria
  BE: /^[01]\d{9}$/, // Belgium
  BG: /^\d{9,10}$/, // Bulgaria
  HR: /^\d{11}$/, // Croatia
  CY: /^\d{8}[A-Z]$/, // Cyprus
  CZ: /^\d{8,10}$/, // Czechia
  DK: /^\d{8}$/, // Denmark
  EE: /^\d{9}$/, // Estonia
  FI: /^\d{8}$/, // Finland
  FR: /^[A-Z0-9]{2}\d{9}$/, // France
  DE: /^\d{9}$/, // Germany
  GR: /^\d{9}$/, // Greece, VAT prefix is EL
  HU: /^\d{8}$/, // Hungary
  IE: /^(?:\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/, // Ireland
  IT: /^\d{11}$/, // Italy
  LV: /^\d{11}$/, // Latvia
  LT: /^(?:\d{9}|\d{12})$/, // Lithuania
  LU: /^\d{8}$/, // Luxembourg
  MT: /^\d{8}$/, // Malta
  NL: /^\d{9}B\d{2}$/, // Netherlands
  PL: /^\d{10}$/, // Poland
  PT: /^\d{9}$/, // Portugal
  RO: /^\d{2,10}$/, // Romania
  SK: /^\d{10}$/, // Slovakia
  SI: /^\d{8}$/, // Slovenia
  ES: /^(?:[A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z])$/, // Spain
  SE: /^\d{12}$/, // Sweden
};

/** 
 * Greece uses two different country codes depending on the context. 
 * When the party country is GR, expect the VAT ID to start with EL
 * VAT ID prefixes that differ from the party's ISO 3166-1 country code. 
*/
const VAT_ID_PREFIX_OVERRIDES: Record<string, string> = {
  GR: "EL",
};

/**
 * Checks whether `vatId` matches the expected EU VAT identifier format (prefix + body
 * pattern) for `countryCode`. Unrecognized country codes are treated as unverifiable
 * and pass. Does not perform checksum or VIES-registry validation.
 */
export function isValidVatIdFormat(countryCode: string, vatId: string): boolean {
  const prefix = VAT_ID_PREFIX_OVERRIDES[countryCode] ?? countryCode;
  const bodyPattern = VAT_ID_BODY_PATTERNS[countryCode];
  if (!bodyPattern) return true;

  if (!vatId.startsWith(prefix)) return false;
  return bodyPattern.test(vatId.slice(prefix.length));
}
