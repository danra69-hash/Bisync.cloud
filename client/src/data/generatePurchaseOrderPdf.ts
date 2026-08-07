import { getPurchaseDocumentLabels } from './purchaseOrderSignatories';
import { formatCountryCurrency } from '../utils/numberFormat';
import { loadJsPDF } from './loadJsPdf';

export type PurchaseOrderPdfParty = {
  name: string;
  address: string;
  brn?: string;
  gstTin?: string;
  phone?: string;
  email?: string;
  contact?: string;
};

export type PurchaseOrderPdfLogo = {
  /** MIME type, e.g. image/png. */
  contentType?: string;
  /** Raw base64 (no data-URL prefix) or a data URL. */
  base64?: string;
};

export type PurchaseOrderPdfLocation = {
  name: string;
  address: string;
  logo?: PurchaseOrderPdfLogo | null;
};

export type PurchaseOrderPdfLine = {
  name: string;
  deliveryUnit: string;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
  lineTotal: number;
};

export type PurchaseOrderPdfData = {
  poNumber: string;
  documentKind: 'purchase_order' | 'purchase_request' | 'sales_order';
  /** When true, PDF title is PRE-COMMITTED ORDER and date block is commitment period. */
  isPreCommitted?: boolean;
  orderDate: string;
  deliveryDate: string;
  /** Override label next to delivery/commitment date (default: Preferred Delivery Date). */
  deliveryDateHeading?: string;
  countryCode?: string;
  company: PurchaseOrderPdfParty;
  /** Company logo for the PDF header (fallback when location has none / same logo). */
  companyLogo?: PurchaseOrderPdfLogo | null;
  deliveryLocations: PurchaseOrderPdfLocation[];
  vendor: PurchaseOrderPdfParty;
  items: PurchaseOrderPdfLine[];
  orderTotal: number;
  taxTotal: number;
  totalAmount: number;
  initiatedBy: string;
  approvedBy: string;
  termsAndConditions: string;
};

/** PDF header title — pre-committed masters are not regular purchase orders. */
export function resolvePurchaseOrderPdfTitle(
  data: Pick<PurchaseOrderPdfData, 'documentKind' | 'isPreCommitted'>,
): string {
  if (data.isPreCommitted) return 'PRE-COMMITTED ORDER';
  return getPurchaseDocumentLabels(data.documentKind).pdfTitle;
}

export function resolvePurchaseOrderPdfDateHeading(
  data: Pick<PurchaseOrderPdfData, 'isPreCommitted' | 'deliveryDateHeading'>,
): string {
  if (data.isPreCommitted) {
    return (data.deliveryDateHeading ?? 'Commitment Period').toUpperCase();
  }
  return (data.deliveryDateHeading ?? 'Preferred Delivery Date').toUpperCase();
}

type JsPDFDoc = import('jspdf').jsPDF;

const PAGE_CONTENT_BOTTOM = 268;
const FOOTER_Y = 287;

let cachedPoweredByLogoDataUrl: string | null | undefined;

function normalizeLogoBase64(raw?: string | null): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) {
    const comma = value.indexOf(',');
    return comma >= 0 ? value.slice(comma + 1).trim() : '';
  }
  return value;
}

function logoToDataUrl(logo?: PurchaseOrderPdfLogo | null): string | null {
  if (!logo) return null;
  const raw = (logo.base64 ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  const type = (logo.contentType ?? '').trim() || 'image/png';
  return `data:${type};base64,${raw}`;
}

function jsPdfImageFormat(contentType?: string, dataUrl?: string | null): 'PNG' | 'JPEG' | 'WEBP' {
  const type = (contentType ?? '').toLowerCase();
  const src = (dataUrl ?? '').toLowerCase();
  if (type.includes('jpeg') || type.includes('jpg') || src.startsWith('data:image/jpeg')) return 'JPEG';
  if (type.includes('webp') || src.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}

/** Prefer a delivery-location logo when it differs from the company logo; else company. */
function resolveHeaderLogo(data: PurchaseOrderPdfData): PurchaseOrderPdfLogo | null {
  const companyBase64 = normalizeLogoBase64(data.companyLogo?.base64);
  for (const loc of data.deliveryLocations) {
    const locationBase64 = normalizeLogoBase64(loc.logo?.base64);
    if (locationBase64 && locationBase64 !== companyBase64) {
      return loc.logo ?? null;
    }
  }
  if (companyBase64) return data.companyLogo ?? null;
  return null;
}

async function loadPoweredByLogoDataUrl(): Promise<string | null> {
  if (cachedPoweredByLogoDataUrl !== undefined) return cachedPoweredByLogoDataUrl;
  try {
    const response = await fetch('/bisync-logo.png');
    if (!response.ok) {
      cachedPoweredByLogoDataUrl = null;
      return null;
    }
    const blob = await response.blob();
    cachedPoweredByLogoDataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return cachedPoweredByLogoDataUrl;
  } catch {
    cachedPoweredByLogoDataUrl = null;
    return null;
  }
}

function safePdfFilename(poNumber: string): string {
  return poNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function formatRm(value: number, countryCode = 'MY'): string {
  return formatCountryCurrency(value, countryCode);
}

function drawMultilineBlock(
  doc: JsPDFDoc,
  x: number,
  y: number,
  lines: string[],
  maxWidth: number,
): number {
  let cursor = y;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    doc.text(wrapped, x, cursor);
    cursor += wrapped.length * 4.2;
  }
  return cursor;
}

function drawHeaderLogo(
  doc: JsPDFDoc,
  data: PurchaseOrderPdfData,
  margin: number,
  y: number,
): void {
  const logo = resolveHeaderLogo(data);
  const dataUrl = logoToDataUrl(logo);
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, jsPdfImageFormat(logo?.contentType, dataUrl), margin, y - 2, 18, 18);
      return;
    } catch {
      // Fall through to initials tile.
    }
  }

  doc.setFillColor(243, 112, 33);
  doc.roundedRect(margin, y - 2, 18, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const initials = data.company.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  doc.text(initials || 'CO', margin + 9, y + 9, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

async function drawPoweredByFooterOnAllPages(doc: JsPDFDoc): Promise<void> {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = 210;
  const poweredByLogo = await loadPoweredByLogoDataUrl();
  const label = 'Powered by';
  const logoW = 22;
  const logoH = 6.5;
  const gap = 2.5;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const labelWidth = doc.getTextWidth(label);
    const totalWidth = poweredByLogo ? labelWidth + gap + logoW : labelWidth;
    const startX = (pageWidth - totalWidth) / 2;
    const textY = FOOTER_Y;
    doc.text(label, startX, textY);
    if (poweredByLogo) {
      try {
        doc.addImage(poweredByLogo, 'PNG', startX + labelWidth + gap, textY - 5, logoW, logoH);
      } catch {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(243, 112, 33);
        doc.text('Bisync.cloud', startX + labelWidth + gap, textY);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(243, 112, 33);
      doc.text('Bisync.cloud', startX + labelWidth + gap, textY);
    }
    doc.setTextColor(0, 0, 0);
  }
}

async function renderPurchaseOrderPage(doc: JsPDFDoc, data: PurchaseOrderPdfData): Promise<void> {
  const margin = 14;
  const pageWidth = 210;
  const right = pageWidth - margin;
  const colLeft = margin;
  const colRight = 110;
  let y = 16;

  drawHeaderLogo(doc, data, margin, y);

  const labels = getPurchaseDocumentLabels(data.documentKind);
  const pdfTitle = resolvePurchaseOrderPdfTitle(data);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(data.isPreCommitted ? 14 : 16);
  doc.text(pdfTitle, right, y + 4, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`${labels.numberLabel} ${data.poNumber}`, right, y + 11, { align: 'right' });
  if (data.isPreCommitted) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('Blanket commitment — not a delivery shipment', right, y + 16, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  y += data.isPreCommitted ? 28 : 24;
  doc.setDrawColor(200);
  doc.line(margin, y, right, y);
  y += 8;

  const orderByLines = [
    data.company.name,
    data.company.address,
    data.company.brn ? `BRN: ${data.company.brn}` : '',
    data.company.gstTin ? `GST TIN: ${data.company.gstTin}` : '',
    data.company.phone ? `Tel: ${data.company.phone}` : '',
    data.company.email ? `Email: ${data.company.email}` : '',
  ].filter((line): line is string => Boolean(line));

  const vendorLines = [
    data.vendor.name,
    data.vendor.address,
    data.vendor.brn ? `BRN: ${data.vendor.brn}` : '',
    data.vendor.contact,
  ].filter((line): line is string => Boolean(line));

  const deliveryLines = data.deliveryLocations.length > 0
    ? data.deliveryLocations.flatMap(loc => {
        const lines = [loc.name];
        if (loc.address.trim()) lines.push(loc.address);
        return lines;
      })
    : ['—'];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ORDER BY', colLeft, y);
  doc.text(data.documentKind === 'sales_order' ? 'CUSTOMER' : 'VENDOR', colRight, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const leftEnd = drawMultilineBlock(doc, colLeft, y, orderByLines, 88);
  const rightEnd = drawMultilineBlock(doc, colRight, y, vendorLines, 88);
  y = Math.max(leftEnd, rightEnd) + 6;

  const metaStartY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DELIVERY LOCATION', colLeft, metaStartY);
  doc.text('ORDER DATE', colRight, metaStartY);
  y = metaStartY + 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const deliveryEnd = drawMultilineBlock(doc, colLeft, y, deliveryLines, 88);
  doc.text(data.orderDate, colRight, y);

  const deliveryDateLabelY = y + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(resolvePurchaseOrderPdfDateHeading(data), colRight, deliveryDateLabelY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dateLines = doc.splitTextToSize(data.deliveryDate || '—', 86);
  doc.text(dateLines, colRight, deliveryDateLabelY + 4.5);
  const dateBlockEnd = deliveryDateLabelY + 4.5 + Math.max(0, dateLines.length - 1) * 4;
  y = Math.max(deliveryEnd, dateBlockEnd + 4.5) + 4;
  doc.setDrawColor(120);
  doc.line(margin, y, right, y);
  y += 6;

  const cols = {
    product: margin,
    delivery: 72,
    qty: 118,
    price: 136,
    tax: 162,
    total: 182,
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Vendor Product', cols.product, y);
  doc.text('Delivery Unit', cols.delivery, y);
  doc.text('QTY', cols.qty, y, { align: 'right' });
  doc.text('Unit Price', cols.price, y, { align: 'right' });
  doc.text('Tax', cols.tax, y, { align: 'right' });
  doc.text('Total', cols.total, y, { align: 'right' });
  y += 2;
  doc.line(margin, y, right, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const item of data.items) {
    if (y > PAGE_CONTENT_BOTTOM) {
      doc.addPage();
      y = 18;
    }
    const productLines = doc.splitTextToSize(item.name, 54);
    const deliveryLinesWrapped = doc.splitTextToSize(item.deliveryUnit, 42);
    const rowHeight = Math.max(productLines.length, deliveryLinesWrapped.length) * 4.2 + 1.5;

    doc.text(productLines, cols.product, y);
    doc.text(deliveryLinesWrapped, cols.delivery, y);
    doc.text(String(item.quantity), cols.qty, y, { align: 'right' });
    doc.text(formatRm(item.unitPrice, data.countryCode), cols.price, y, { align: 'right' });
    doc.text(formatRm(item.taxAmount, data.countryCode), cols.tax, y, { align: 'right' });
    doc.text(formatRm(item.lineTotal, data.countryCode), cols.total, y, { align: 'right' });
    y += rowHeight;
  }

  if (y > PAGE_CONTENT_BOTTOM - 60) {
    doc.addPage();
    y = 18;
  }

  y += 2;
  doc.line(margin, y, right, y);
  y += 8;

  const totalsX = 138;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Order Total:', totalsX, y);
  doc.text(formatRm(data.orderTotal, data.countryCode), right, y, { align: 'right' });
  y += 6;
  doc.text('Tax Total:', totalsX, y);
  doc.text(formatRm(data.taxTotal, data.countryCode), right, y, { align: 'right' });
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount:', totalsX, y);
  doc.text(formatRm(data.totalAmount, data.countryCode), right, y, { align: 'right' });
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Terms & Conditions', margin, y);
  y += 4;
  doc.setDrawColor(180);
  doc.roundedRect(margin, y, right - margin, 22, 2, 2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const terms = data.termsAndConditions.trim() || 'To be configured.';
  doc.text(doc.splitTextToSize(terms, right - margin - 6), margin + 3, y + 6);
  doc.setTextColor(0, 0, 0);
  y += 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Initiated by:', margin, y);
  doc.text('Approved by:', colRight, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.initiatedBy.trim() || '____________________________', margin, y);
  doc.text(data.approvedBy.trim() || '____________________________', colRight, y);
}

export async function createPurchaseOrderPdfBlob(data: PurchaseOrderPdfData): Promise<Blob> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  await renderPurchaseOrderPage(doc, data);
  await drawPoweredByFooterOnAllPages(doc);
  return doc.output('blob');
}

export async function createCombinedPurchaseOrderPdfBlob(orders: PurchaseOrderPdfData[]): Promise<Blob> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  for (let index = 0; index < orders.length; index++) {
    if (index > 0) doc.addPage();
    await renderPurchaseOrderPage(doc, orders[index]);
  }
  await drawPoweredByFooterOnAllPages(doc);
  return doc.output('blob');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function downloadPurchaseOrderPdf(data: PurchaseOrderPdfData): Promise<void> {
  const blob = await createPurchaseOrderPdfBlob(data);
  const prefix = data.isPreCommitted
    ? 'Pre-committed-PO'
    : data.documentKind === 'purchase_request'
      ? 'PR'
      : data.documentKind === 'sales_order'
        ? 'SO'
        : 'PO';
  triggerBlobDownload(blob, `${prefix}-${safePdfFilename(data.poNumber)}.pdf`);
}

export async function downloadCombinedPurchaseOrderPdfs(orders: PurchaseOrderPdfData[]): Promise<void> {
  if (orders.length === 0) return;
  if (orders.length === 1) {
    await downloadPurchaseOrderPdf(orders[0]);
    return;
  }
  const blob = await createCombinedPurchaseOrderPdfBlob(orders);
  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = getPurchaseDocumentLabels(orders[0].documentKind).combinedPdfName;
  triggerBlobDownload(blob, `${baseName}-${stamp}.pdf`);
}

export async function openPurchaseOrderPdfInTab(data: PurchaseOrderPdfData): Promise<void> {
  const blob = await createPurchaseOrderPdfBlob(data);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
