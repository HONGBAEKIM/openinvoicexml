import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  PageSizes,
  rgb,
  breakTextIntoLines,
  AFRelationship,
  type PDFFont,
  type PDFPage,
} from "@cantoo/pdf-lib";
// fontkit has no default export under Node's ESM resolution — only named exports
// (create/open/etc.), so a namespace import is required here, not a default import.
import * as fontkit from "fontkit";

// import type { Invoice, VatBreakdown } from "../core/index.js";
import type { Invoice } from "../core/index.js";
import { formatDateDE, formatAmountDE } from "../core/utils/format-de.js";
import {
  mapInvoiceToPdfFields,
  type PdfDocumentFields,
  type PdfPartyFields,
  type PdfLineFields,
  type PdfVatSubtotalFields,
} from "./hybrid-pdf-mapping.js";
import { toXRechnung } from "./xrechnung.js";

/**
 * PDF layout — turns already-resolved field structures (see hybrid-pdf-mapping.ts) into a
 * one-page-or-more human-readable invoice using @cantoo/pdf-lib. German date/amount formatting
 * and all positioning/drawing decisions live here; no field defaulting or derivation belongs in
 * this file.
 *
 * Also applies PDF/A-3b conformance basics (subset-embedded fonts, ICC OutputIntent/XMP via
 * convertToPDFA()) and embeds the XRechnung UBL XML as a PDF/A-3 associated file, both at the end
 * of toHybridPdf() — see the seam noted there.
 *
 * Only opaque, solid-color fills are used anywhere in this file — no alpha/transparency — since
 * PDF/A-3 disallows transparency groups and it's cheap to avoid from the start.
 */

const FONT_DIR = fileURLToPath(new URL("./assets/fonts/", import.meta.url));

const PAGE_SIZE = PageSizes.A4;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.4, 0.4, 0.4);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);

// const VAT_CATEGORY_LABELS_DE: Record<VatBreakdown["categoryCode"], string> = {
//   S: "Regelbesteuerung",
//   Z: "Nullsatz",
//   E: "Steuerfrei",
//   AE: "Steuerschuldnerschaft des Leistungsempfängers (§13b UStG)",
//   K: "Innergemeinschaftliche Lieferung (steuerfrei)",
//   G: "Ausfuhrlieferung (steuerfrei)",
//   O: "Nicht steuerbar",
// };

const DOCUMENT_TITLES_DE: Record<PdfDocumentFields["typeCode"], string> = {
  "380": "RECHNUNG",
  "381": "GUTSCHRIFT",
  "384": "RECHNUNGSKORREKTUR",
};

/** Line-item table column widths, left to right, summing to less than CONTENT_WIDTH. */
const TABLE_COLUMNS = {
  description: 195,
  quantity: 65,
  unitPrice: 80,
  vatRate: 55,
  lineTotal: 90,
};

/** UN/CEFACT Recommendation 20 unit codes commonly seen on German invoices. */
const UNIT_LABELS_DE: Record<string, string> = {
  C62: "Stk.",
  H87: "Stk.",
  HUR: "Std.",
  DAY: "Tag",
  WEE: "Woche",
  MON: "Monat",
  ANN: "Jahr",
  KGM: "kg",
  GRM: "g",
  TNE: "t",
  MTR: "m",
  CMT: "cm",
  MMT: "mm",
  MTK: "m²",
  MTQ: "m³",
  LTR: "l",
  MLT: "ml",
  KWH: "kWh",
  MWH: "MWh",
  LS: "Pausch.",
  SET: "Satz",
  PR: "Paar",
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Layout {
  doc: PDFDocument;
  page: PDFPage;
  fonts: Fonts;
  y: number;
}

/** Starts a new page and resets the cursor to the top margin — used both for the first page and pagination overflow. */
function startPage(doc: PDFDocument): { page: PDFPage; y: number } {
  const page = doc.addPage(PAGE_SIZE);
  return { page, y: PAGE_SIZE[1] - MARGIN };
}

function ensureSpace(layout: Layout, needed: number): void {
  if (layout.y - needed < MARGIN) {
    const { page, y } = startPage(layout.doc);
    layout.page = page;
    layout.y = y;
  }
}

/** Draws `text` right-aligned so it ends at `rightEdge`. */
function drawTextRightAligned(
  layout: Layout,
  text: string,
  rightEdge: number,
  y: number,
  size: number,
  font: PDFFont,
): void {
  const width = font.widthOfTextAtSize(text, size);
  layout.page.drawText(text, { x: rightEdge - width, y, size, font, color: BLACK });
}

function drawAddressBlock(layout: Layout, x: number, y: number, party: PdfPartyFields): number {
  const lines = [
    party.name,
    party.addressLine1,
    ...(party.addressLine2 ? [party.addressLine2] : []),
    `${party.postalCode} ${party.city}`,
    ...(party.countryCode !== "DE" ? [party.countryCode] : []),
  ];
  let cursor = y;
  for (const line of lines) {
    layout.page.drawText(line, {
      x,
      y: cursor,
      size: 9,
      font: layout.fonts.regular,
      color: BLACK,
    });
    cursor -= 13;
  }
  return cursor;
}

function drawHeader(layout: Layout, fields: PdfDocumentFields): void {
  const { page, fonts } = layout;
  const topY = layout.y;

  // Small return-address line above the buyer block, per German business-letter convention.
  const returnAddress = `${fields.seller.name}`;
  page.drawText(returnAddress, { 
    x: MARGIN, 
    y: topY, 
    size: 8, 
    font: fonts.regular, 
    color: GRAY,
  });

  const returnAddress2 = `${fields.seller.addressLine1} · ${fields.seller.postalCode} ${fields.seller.city}`;
  page.drawText(returnAddress2, { 
    x: MARGIN, 
    y: topY - 10, 
    size: 8, 
    font: fonts.regular, 
    color: GRAY,
  });

  const buyerBottomY = drawAddressBlock(layout, MARGIN, topY - 30, fields.buyer);

  // Invoice metadata block, top right.
  const metaX = MARGIN + CONTENT_WIDTH - 200;
  const title = DOCUMENT_TITLES_DE[fields.typeCode];
  const titleMaxWidth = MARGIN + CONTENT_WIDTH - metaX;

  let titleSize = 18;

  while (
    fonts.bold.widthOfTextAtSize(title, titleSize) > titleMaxWidth &&
    titleSize > 12
  ) {
    titleSize -= 0.5;
  }

  page.drawText(title, { 
    x: metaX, 
    y: topY, 
    size: titleSize, 
    font: fonts.bold, color: BLACK 
  });

  const metaLines: [string, string][] = [
    ["Rechnungsnummer", fields.invoiceId],
    ["Rechnungsdatum", formatDateDE(fields.issueDate)],
    ...(fields.dueDate
      ? ([["Fällig am", formatDateDE(fields.dueDate)]] as [string, string][])
      : []),
  ];
  let metaY = topY - 28;
  for (const [label, value] of metaLines) {
    page.drawText(`${label}:`, { x: metaX, y: metaY, size: 9, font: fonts.regular, color: GRAY });
    page.drawText(value, {
      x: metaX + 95,
      y: metaY,
      size: 9,
      font: fonts.regular,
      color: BLACK,
    });
    metaY -= 13;
  }

  layout.y = Math.min(buyerBottomY, metaY) - 25;
}

function drawTableHeader(layout: Layout): void {
  const { page, fonts } = layout;
  const y = layout.y;
  let x = MARGIN;

  const cells: [string, number, boolean][] = [
    ["Beschreibung", TABLE_COLUMNS.description, false],
    ["Menge", TABLE_COLUMNS.quantity, false],
    ["Einzelpreis", TABLE_COLUMNS.unitPrice, true],
    ["USt-Satz", TABLE_COLUMNS.vatRate, true],
    ["Gesamt", TABLE_COLUMNS.lineTotal, true],
  ];
  for (const [label, width, rightAlign] of cells) {
    if (rightAlign) {
      drawTextRightAligned(layout, label, x + width, y, 9, fonts.bold);
    } else {
      page.drawText(label, { x, y, size: 9, font: fonts.bold, color: BLACK });
    }
    x += width;
  }

  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: MARGIN + CONTENT_WIDTH, y: y - 4 },
    thickness: 1,
    color: BLACK,
  });

  layout.y -= 18;
}

/** Number of lines `text` will wrap to at `size` within the description column's width. */
function wrappedLineCount(doc: PDFDocument, font: PDFFont, text: string, size: number): number {
  const maxWidth = TABLE_COLUMNS.description - 8;
  return breakTextIntoLines(text, doc.defaultWordBreaks, maxWidth, (t) =>
    font.widthOfTextAtSize(t, size),
  ).length;
}

function drawLineRow(layout: Layout, fields: PdfDocumentFields, line: PdfLineFields): void {
  ensureSpace(layout, 40);
  const { doc, page, fonts } = layout;
  const maxDescWidth = TABLE_COLUMNS.description - 8;

  const rowTop = layout.y;
  let x = MARGIN;

  page.drawText(line.name, {
    x,
    y: rowTop,
    size: 9,
    font: fonts.regular,
    color: BLACK,
    maxWidth: maxDescWidth,
    lineHeight: 11,
  });
  const nameLineCount = wrappedLineCount(doc, fonts.regular, line.name, 9);

  let descriptionLineCount = 0;
  if (line.description) {
    page.drawText(line.description, {
      x,
      y: rowTop - nameLineCount * 11,
      size: 8,
      font: fonts.regular,
      color: GRAY,
      maxWidth: maxDescWidth,
      lineHeight: 10,
    });
    descriptionLineCount = wrappedLineCount(doc, fonts.regular, line.description, 8);
  }
  x += TABLE_COLUMNS.description;

  const unitLabel = UNIT_LABELS_DE[line.unitCode] ?? line.unitCode;

  page.drawText(`${line.quantity} ${unitLabel}`, {
    x,
    y: rowTop,
    size: 9,
    font: fonts.regular,
    color: BLACK,
  });
  x += TABLE_COLUMNS.quantity;

  drawTextRightAligned(
    layout,
    formatAmountDE(line.unitPrice, fields.currencyCode),
    x + TABLE_COLUMNS.unitPrice,
    rowTop,
    9,
    fonts.regular,
  );
  x += TABLE_COLUMNS.unitPrice;

  drawTextRightAligned(
    layout,
    `${line.vatRate}%`,
    x + TABLE_COLUMNS.vatRate,
    rowTop,
    9,
    fonts.regular,
  );
  x += TABLE_COLUMNS.vatRate;

  drawTextRightAligned(
    layout,
    formatAmountDE(line.lineAmount, fields.currencyCode),
    x + TABLE_COLUMNS.lineTotal,
    rowTop,
    9,
    fonts.regular,
  );

  // Row height grows with wrapped description text so subsequent rows don't overlap.
  const rowHeight = 16 + (nameLineCount - 1) * 11 + descriptionLineCount * 10;
  layout.y = rowTop - rowHeight;
}

function drawLineItemsTable(layout: Layout, fields: PdfDocumentFields): void {
  ensureSpace(layout, 40);
  drawTableHeader(layout);
  for (const line of fields.lines) {
    drawLineRow(layout, fields, line);
  }
  layout.page.drawLine({
    start: { x: MARGIN, y: layout.y + 6 },
    end: { x: MARGIN + CONTENT_WIDTH, y: layout.y + 6 },
    thickness: 1,
    color: LIGHT_GRAY,
  });
  layout.y -= 15;
}

function vatSubtotalLabel(subtotal: PdfVatSubtotalFields): string {
  return `USt ${subtotal.rate}%`;
}

function drawTotalsRow(layout: Layout, label: string, value: string, bold = false): void {
  ensureSpace(layout, 16);
  const { page, fonts } = layout;
  const labelX = MARGIN + CONTENT_WIDTH - 220;
  const valueRightEdge = MARGIN + CONTENT_WIDTH;
  const font = bold ? fonts.bold : fonts.regular;
  page.drawText(label, { x: labelX, y: layout.y, size: 9, font, color: BLACK });
  drawTextRightAligned(layout, value, valueRightEdge, layout.y, 9, font);
  layout.y -= 14;
}

function drawTotalsBlock(layout: Layout, fields: PdfDocumentFields): void {
  const currency = fields.currencyCode;
  drawTotalsRow(
    layout,
    "Zwischensumme (netto)",
    formatAmountDE(fields.taxExclusiveAmount, currency),
  );

  for (const subtotal of fields.vatSubtotals) {
    drawTotalsRow(layout, vatSubtotalLabel(subtotal), formatAmountDE(subtotal.taxAmount, currency));
  }

  for (const ac of fields.allowancesCharges) {
    const label = `${ac.isCharge ? "Zuschlag" : "Abschlag"}${ac.reason ? ` (${ac.reason})` : ""}`;
    const signedAmount = ac.isCharge ? ac.amount : -ac.amount;
    drawTotalsRow(layout, label, formatAmountDE(signedAmount, currency));
  }

  drawTotalsRow(
    layout,
    "Gesamtbetrag (brutto)",
    formatAmountDE(fields.taxInclusiveAmount, currency),
    // true,
  );

  if (fields.prepaidAmount !== undefined) {
    drawTotalsRow(layout, "Bereits gezahlt", formatAmountDE(-fields.prepaidAmount, currency));
  }

  drawTotalsRow(
    layout, 
    "Fälliger Betrag", 
    formatAmountDE(fields.duePayableAmount, currency), 
    // true,
  );
}

function drawPaymentInfo(layout: Layout, fields: PdfDocumentFields): void {
  ensureSpace(layout, 82);
  const { page, fonts } = layout;
  layout.y -= 22;
  page.drawText("Zahlungsinformationen", {
    x: MARGIN,
    y: layout.y,
    size: 9,
    font: fonts.bold,
    color: BLACK,
  });
  layout.y -= 15;

  const pm = fields.paymentMeans;
  // No dedicated payment-reference field exists on Invoice — fall back to the invoice ID as the
  // printed Verwendungszweck. This is a display choice made here, not a claim about what German
  // invoices legally require.
  const rows: [string, string][] = [
    ...(pm?.accountName ? ([["Kontoinhaber", pm.accountName]] as [string, string][]) : []),
    ...(pm?.iban ? ([["IBAN", pm.iban]] as [string, string][]) : []),
    ...(pm?.bic ? ([["BIC", pm.bic]] as [string, string][]) : []),
    ["Verwendungszweck", fields.invoiceId],
  ];
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, {
      x: MARGIN,
      y: layout.y,
      size: 9,
      font: fonts.regular,
      color: GRAY,
    });
    page.drawText(value, {
      x: MARGIN + 100,
      y: layout.y,
      size: 9,
      font: fonts.regular,
      color: BLACK,
    });
    layout.y -= 13;
  }

  if (fields.note) {
    layout.y -= 8;
    page.drawText(fields.note, {
      x: MARGIN,
      y: layout.y,
      size: 9,
      font: fonts.regular,
      color: BLACK,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 12,
    });
    layout.y -= 14;
  }
}

/**
 * Displays the seller's tax identifiers and other business info. Placement here (bottom of the
 * page) is a layout convenience, not a legal mandate that this data sit in a "footer" — §14 UStG
 * only requires the info appear somewhere on the invoice, and requires one of Steuernummer or
 * USt-IdNr., not both.
 */
function drawFooter(layout: Layout, fields: PdfDocumentFields): void {
  const seller = fields.seller;
  const idParts = [
    seller.vatId ? `USt-IdNr.: ${seller.vatId}` : undefined,
    seller.taxRegistrationId ? `Steuernummer: ${seller.taxRegistrationId}` : undefined,
  ].filter((part): part is string => part !== undefined);

  if (idParts.length === 0) return;

  ensureSpace(layout, 20);
  layout.page.drawText(idParts.join(" · "), {
    x: MARGIN,
    y: MARGIN,
    size: 8,
    font: layout.fonts.regular,
    color: GRAY,
  });
}

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const regularBytes = readFileSync(`${FONT_DIR}DejaVuSans.ttf`);
  const boldBytes = readFileSync(`${FONT_DIR}DejaVuSans-Bold.ttf`);
  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });
  return { regular, bold };
}

/**
 * Which e-invoice conformance profile is selected for hybrid PDF generation.
 *
 * Currently supported profiles are limited to the UBL-based generation capabilities of this
 * project. A TS union is additive — this can grow later without a breaking change.
 */
export type EInvoiceProfile = "XRECHNUNG" | "EN16931";

export interface HybridPdfOptions {
  /** Defaults to "EN16931". No visible effect yet — see docs/API.md. */
  profile?: EInvoiceProfile;
}

/**
 * Generates a human-readable PDF/A-3 invoice from an Invoice, with PDF/A-3b conformance basics
 * applied and the XRechnung UBL XML embedded as an associated file (AFRelationship=Alternative).
 */
export async function toHybridPdf(
  invoice: Invoice,
  options: HybridPdfOptions = {},
): Promise<Uint8Array> {
  // Resolved but not yet consumed: which XMP field (if any) should carry this, without
  // implying Factur-X/ZUGFeRD conformance this UBL-only document can't claim, is still an
  // open question for a future task, not decided here.
  const profile = options.profile ?? "EN16931";
  void profile;

  const fields = mapInvoiceToPdfFields(invoice);

  const doc = await PDFDocument.create();
  const fonts = await embedFonts(doc);
  const { page, y } = startPage(doc);
  const layout: Layout = { doc, page, fonts, y };

  drawHeader(layout, fields);
  drawLineItemsTable(layout, fields);
  drawTotalsBlock(layout, fields);
  drawPaymentInfo(layout, fields);
  drawFooter(layout, fields);

  // PDF/A-3b conformance: OutputIntent (ICC profile) + XMP pdfaid metadata.
  doc.convertToPDFA({ conformance: "3B" });

  // Embed the XRechnung UBL XML as the PDF/A-3 alternative representation.
  // Do not use embedFacturX(): ZUGFeRD/Factur-X profiles require CII XML,
  // while toXRechnung() produces UBL.
  const xrechnungXml = toXRechnung(invoice);
  await doc.attach(new TextEncoder().encode(xrechnungXml), "xrechnung.xml", {
    mimeType: "text/xml",
    afRelationship: AFRelationship.Alternative,
    description: "XRechnung UBL invoice XML",
  });

  return doc.save();
}

/**
 * Extracts and decodes the xrechnung.xml attachment from a generated hybrid PDF on disk.
 * Throws if the PDF has no such attachment.
 */
export async function extractEmbeddedXml(pdfPath: string): Promise<string> {
  const bytes = readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes);
  const attachment = doc.getAttachments().find((a) => a.name === "xrechnung.xml");
  if (!attachment) {
    throw new Error(`No xrechnung.xml attachment found in ${pdfPath}`);
  }
  return Buffer.from(attachment.data).toString("utf8");
}
