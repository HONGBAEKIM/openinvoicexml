// Output adapters transform a normalized Invoice into a specific format.
// Each adapter is independent — adding or replacing one never touches the others.
//
// Adapters:
//   XRechnungAdapter  → UBL 2.1 XML (Phase 2, implemented)
//   PdfAdapter        → PDF/A-3 hybrid with embedded XML (Phase 4, in progress — content/layout
//                        done; PDF/A-3 conformance and XML embedding land in later Week 13 tasks)

export { toXRechnung } from "./xrechnung.js";
export { toHybridPdf } from "./hybrid-pdf.js";

export { generateInvoice, generateHybridPdf } from "./generate-invoice.js";
export type { GenerateInvoiceResult, GenerateHybridPdfResult } from "./generate-invoice.js";
