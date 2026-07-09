import { getPurchaseDocumentLabels } from './purchaseOrderSignatories';
import { formatCountryCurrency } from '../utils/numberFormat';

export type PurchaseOrderPdfParty = {
  name: string;
  address: string;
  brn?: string;
  gstTin?: string;
  phone?: string;
  email?: string;
  contact?: string;
};

export type PurchaseOrderPdfLocation = {
  name: string;
  address: string;
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
  documentKind: 'purchase_order' | 'purchase_request';
  orderDate: string;
  deliveryDate: string;
  countryCode?: string;
  company: PurchaseOrderPdfParty;
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

type JsPDFDoc = import('jspdf').jsPDF;

let cachedLogoDataUrl: string | null | undefined;

async function loadJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

async function loadLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const response = await fetch('/favicon.svg');
    if (!response.ok) {
      cachedLogoDataUrl = null;
      return null;
    }
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cachedLogoDataUrl = null;
      return null;
    }
    ctx.drawImage(img, 0, 0, 96, 96);
    URL.revokeObjectURL(url);
    cachedLogoDataUrl = canvas.toDataURL('image/png');
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
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

async function renderPurchaseOrderPage(doc: JsPDFDoc, data: PurchaseOrderPdfData): Promise<void> {
  const margin = 14;
  const pageWidth = 210;
  const right = pageWidth - margin;
  const colLeft = margin;
  const colRight = 110;
  let y = 16;

  const logo = await loadLogoDataUrl();
  if (logo) {
    doc.addImage(logo, 'PNG', margin, y - 2, 18, 18);
  } else {
    doc.setFillColor(134, 59, 255);
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

  const labels = getPurchaseDocumentLabels(data.documentKind);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(labels.pdfTitle, right, y + 4, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`${labels.numberLabel} ${data.poNumber}`, right, y + 11, { align: 'right' });

  y += 24;
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
  doc.text('VENDOR', colRight, y);
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
  doc.text('PREFERRED DELIVERY DATE', colRight, deliveryDateLabelY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.deliveryDate, colRight, deliveryDateLabelY + 4.5);
  y = Math.max(deliveryEnd, deliveryDateLabelY + 9) + 4;
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
    if (y > 248) {
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
  return doc.output('blob');
}

export async function createCombinedPurchaseOrderPdfBlob(orders: PurchaseOrderPdfData[]): Promise<Blob> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF();
  for (let index = 0; index < orders.length; index++) {
    if (index > 0) doc.addPage();
    await renderPurchaseOrderPage(doc, orders[index]);
  }
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
  const prefix = data.documentKind === 'purchase_request' ? 'PR' : 'PO';
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
