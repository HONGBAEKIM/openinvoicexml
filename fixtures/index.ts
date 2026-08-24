import domesticSimple from "./01.domestic-simple.invoice.json" with { type: "json" };
import domesticMultiLine from "./02.domestic-multi-line.invoice.json" with { type: "json" };
import reducedRate from "./03.reduced-rate.invoice.json" with { type: "json" };
import exempt from "./04.exempt.invoice.json" with { type: "json" };
import zeroRated from "./05.zero-rated.invoice.json" with { type: "json" };
import reverseCharge from "./06.reverse-charge.invoice.json" with { type: "json" };
import smallBusiness from "./07.small-business.invoice.json" with { type: "json" };
import intraEuSupply from "./08.intra-eu-supply.invoice.json" with { type: "json" };
import exportInvoice from "./09.export.invoice.json" with { type: "json" };
import reverseChargeConstruction from "./10.reverse-charge-construction.invoice.json" with { type: "json" };
import reverseChargeScrapMetal from "./11.reverse-charge-scrap-metal.invoice.json" with { type: "json" };
import reverseChargeSecurityTransfer from "./12.reverse-charge-security-transfer.invoice.json" with { type: "json" };
import reverseChargeCleaning from "./13.reverse-charge-cleaning.invoice.json" with { type: "json" };
import reverseChargeMobileDevices from "./14.reverse-charge-mobile-devices.invoice.json" with { type: "json" };
import reverseChargeGasAndElectricity from "./15.reverse-charge-gas-and-electricity.invoice.json" with { type: "json" };
import creditNoteFull from "./16.credit-note-full.invoice.json" with { type: "json" };
import creditNotePartial from "./17.credit-note-partial.invoice.json" with { type: "json" };
import correctiveInvoice from "./18.corrective-invoice.invoice.json" with { type: "json" };
import downPayment from "./19.down-payment.invoice.json" with { type: "json" };
import finalInvoice from "./20.final-invoice.invoice.json" with { type: "json" };
import partialDelivery from "./21.partial-delivery.invoice.json" with { type: "json" };
import documentLevelDiscount from "./22.document-level-discount.invoice.json" with { type: "json" };
import lineLevelDiscount from "./23.line-level-discount.invoice.json" with { type: "json" };
import combinedLineAndDocumentDiscount from "./24.combined-line-and-document-discount.invoice.json" with { type: "json" };
import documentLevelSurcharge from "./25.document-level-surcharge.invoice.json" with { type: "json" };
import lineLevelSurcharge from "./26.line-level-surcharge.invoice.json" with { type: "json" };
import reverseChargeIntraEuServices from "./27.reverse-charge-intra-eu-services.invoice.json" with { type: "json" };
import multipleVatRates from "./28.multiple-vat-rates.invoice.json" with { type: "json" };
import reverseChargeRealEstate from "./29.reverse-charge-real-estate.invoice.json" with { type: "json" };
import reverseChargeTelecommunications from "./30.reverse-charge-telecommunications.invoice.json" with { type: "json" };

export {
  domesticSimple,
  domesticMultiLine,
  reducedRate,
  exempt,
  zeroRated,
  reverseCharge,
  smallBusiness,
  intraEuSupply,
  exportInvoice,
  reverseChargeConstruction,
  reverseChargeScrapMetal,
  reverseChargeSecurityTransfer,
  reverseChargeCleaning,
  reverseChargeMobileDevices,
  reverseChargeGasAndElectricity,
  creditNoteFull,
  creditNotePartial,
  correctiveInvoice,
  downPayment,
  finalInvoice,
  partialDelivery,
  documentLevelDiscount,
  lineLevelDiscount,
  combinedLineAndDocumentDiscount,
  documentLevelSurcharge,
  lineLevelSurcharge,
  reverseChargeIntraEuServices,
  multipleVatRates,
  reverseChargeRealEstate,
  reverseChargeTelecommunications,
};

/**
 * All 30 fixtures as [label, data] pairs, in fixture-number order. Each label is numbered
 * (matching the fixture's filename prefix) and annotated with its VAT category, so it shows
 * up that way in every test runner's output, wherever this list is consumed.
 */
export const allFixtures: [string, unknown][] = [
  ["1. domestic-simple (19% S)", domesticSimple],
  ["2. domestic-multi-line (19% S)", domesticMultiLine],
  ["3. reduced-rate (7% S)", reducedRate],
  ["4. exempt (E)", exempt],
  ["5. zero-rated (Z)", zeroRated],
  ["6. reverse-charge (AE)", reverseCharge],
  ["7. small-business (E)", smallBusiness],
  ["8. intra-eu-supply (K)", intraEuSupply],
  ["9. export (G)", exportInvoice],
  ["10. reverse-charge-construction (AE)", reverseChargeConstruction],
  ["11. reverse-charge-scrap-metal (AE)", reverseChargeScrapMetal],
  ["12. reverse-charge-security-transfer (AE)", reverseChargeSecurityTransfer],
  ["13. reverse-charge-cleaning (AE)", reverseChargeCleaning],
  ["14. reverse-charge-mobile-devices (AE)", reverseChargeMobileDevices],
  ["15. reverse-charge-gas-and-electricity (AE)", reverseChargeGasAndElectricity],
  ["16. credit-note-full (381)", creditNoteFull],
  ["17. credit-note-partial (381)", creditNotePartial],
  ["18. corrective-invoice (384)", correctiveInvoice],
  ["19. down-payment (19% S)", downPayment],
  ["20. final-invoice (19% S)", finalInvoice],
  ["21. partial-delivery (19% S)", partialDelivery],
  ["22. document-level-discount (19% S)", documentLevelDiscount],
  ["23. line-level-discount (19% S)", lineLevelDiscount],
  ["24. combined-line-and-document-discount (19% S)", combinedLineAndDocumentDiscount],
  ["25. document-level-surcharge (19% S)", documentLevelSurcharge],
  ["26. line-level-surcharge (19% S)", lineLevelSurcharge],
  ["27. reverse-charge-intra-eu-services (AE)", reverseChargeIntraEuServices],
  ["28. multiple-vat-rates (19%/7% S)", multipleVatRates],
  ["29. reverse-charge-real-estate (AE)", reverseChargeRealEstate],
  ["30. reverse-charge-telecommunications (AE)", reverseChargeTelecommunications],
];
