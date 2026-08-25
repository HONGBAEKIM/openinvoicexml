import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  PageSizes,
  rgb,
  breakTextIntoLines,
  type PDFFont,
  type PDFPage,
} from "@cantoo/pdf-lib";
// fontkit has no default export under Node's ESM resolution — only named exports
// (create/open/etc.), so a namespace import is required here, not a default import.
import * as fontkit from "fontkit";

import type { Invoice, VatBreakdown } from "../core/index.js";
import { formatDateDE, formatAmountDE } from "../core/utils/format-de.js";
import {
  mapInvoiceToPdfFields,
  type PdfDocumentFields,
  type PdfPartyFields,
  type PdfLineFields,
  type PdfVatSubtotalFields,
} from "./hybrid-pdf-mapping.js";

/**
 * PDF layout — turns already-resolved field structures (see hybrid-pdf-mapping.ts) into a
 * one-page-or-more human-readable invoice using @cantoo/pdf-lib. German date/amount formatting
 * and all positioning/drawing decisions live here; no field defaulting or derivation belongs in
 * this file.
 *
 * Scope for now: content and layout only. No PDF/A-3 OutputIntent/XMP, no embedded
 * XRechnung XML attachment — see the seam noted at the bottom of toHybridPdf().
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

const VAT_CATEGORY_LABELS_DE: Record<VatBreakdown["categoryCode"], string> = {
  S: "Regelbesteuerung",
  Z: "Nullsatz",
  E: "Steuerfrei",
  AE: "Steuerschuldnerschaft des Leistungsempfängers (§13b UStG)",
  K: "Innergemeinschaftliche Lieferung (steuerfrei)",
  G: "Ausfuhrlieferung (steuerfrei)",
  O: "Nicht steuerbar",
};

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
  for (const [i, line] of lines.entries()) {
    layout.page.drawText(line, {
      x,
      y: cursor,
      size: 10,
      font: i === 0 ? layout.fonts.bold : layout.fonts.regular,
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
  const returnAddress = `${fields.seller.name} · ${fields.seller.addressLine1} · ${fields.seller.postalCode} ${fields.seller.city}`;
  page.drawText(returnAddress, { x: MARGIN, y: topY, size: 8, font: fonts.regular, color: GRAY });

  const buyerBottomY = drawAddressBlock(layout, MARGIN, topY - 20, fields.buyer);

  // Invoice metadata block, top right.
  const metaX = MARGIN + CONTENT_WIDTH - 200;
  const title = DOCUMENT_TITLES_DE[fields.typeCode];
  page.drawText(title, { x: metaX, y: topY, size: 18, font: fonts.bold, color: BLACK });

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
      x: metaX + 90,
      y: metaY,
      size: 9,
      font: fonts.bold,
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

  page.drawText(`${line.quantity} ${line.unitCode}`, {
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
  return `USt ${subtotal.rate}% (${VAT_CATEGORY_LABELS_DE[subtotal.categoryCode]})`;
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
    true,
  );

  if (fields.prepaidAmount !== undefined) {
    drawTotalsRow(layout, "Bereits gezahlt", formatAmountDE(-fields.prepaidAmount, currency));
  }

  drawTotalsRow(layout, "Fälliger Betrag", formatAmountDE(fields.duePayableAmount, currency), true);
}

function drawPaymentInfo(layout: Layout, fields: PdfDocumentFields): void {
  ensureSpace(layout, 70);
  const { page, fonts } = layout;
  layout.y -= 10;
  page.drawText("Zahlungsinformationen", {
    x: MARGIN,
    y: layout.y,
    size: 10,
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
 * Generates a human-readable hybrid invoice PDF from an Invoice. Content and layout only — no
 * PDF/A-3 OutputIntent/XMP and no embedded XRechnung XML attachment yet.
 * Those tasks insert their work between this function's layout step and the final doc.save()
 * call below.
 */
export async function toHybridPdf(invoice: Invoice): Promise<Uint8Array> {
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

  // (PDF/A-3 OutputIntent/XMP) and (doc.attach() for the XRechnung XML) insert
  // their work here, before the final save.
  return doc.save();
}
