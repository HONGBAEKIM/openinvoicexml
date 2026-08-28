// Output adapters transform a normalized Invoice into a specific format.
// Each adapter is independent — adding or replacing one never touches the others.
//
// Adapters:
//   XRechnungAdapter  → UBL 2.1 XML (Phase 2, implemented)
//   PdfAdapter        → PDF/A-3 invoice with associated XRechnung UBL XML (Phase 4, in
//                        progress — content/layout, PDF/A-3 conformance basics, and XML
//                        attachment done; remaining metadata scope TBD)

export { toXRechnung } from "./xrechnung.js";
export { toHybridPdf } from "./hybrid-pdf.js";

export { generateInvoice, generateHybridPdf } from "./generate-invoice.js";
export type { GenerateInvoiceResult, GenerateHybridPdfResult } from "./generate-invoice.js";
