import { jsPDF } from 'jspdf';

export type PurchaseOrderPdfData = {
  poNumber: string;
  vendorName: string;
  companyName: string;
  locationNames: string[];
  orderDate: string;
  deliveryDate: string;
  items: {
    name: string;
    quantity: number;
    unit: string;
    deliveryPackage: string;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
};

function safePdfFilename(poNumber: string): string {
  return poNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function renderPurchaseOrderPage(doc: jsPDF, data: PurchaseOrderPdfData, yStart = 18): number {
  const margin = 14;
  let y = yStart;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Purchase Order', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 10;
  doc.text(`PO Number: ${data.poNumber}`, margin, y);
  y += 6;
  doc.text(`Order Date: ${data.orderDate}`, margin, y);
  y += 6;
  doc.text(`Delivery Date: ${data.deliveryDate}`, margin, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Vendor', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(data.vendorName, margin, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Ship To', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(data.companyName, margin, y);
  if (data.locationNames.length > 0) {
    y += 6;
    doc.text(data.locationNames.join(', '), margin, y);
  }

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const cols = [margin, 78, 108, 138, 162, 186];
  doc.text('Product', cols[0], y);
  doc.text('Qty', cols[1], y);
  doc.text('Unit', cols[2], y);
  doc.text('Delivery', cols[3], y);
  doc.text('Price', cols[4], y);
  doc.text('Total', cols[5], y);

  doc.setDrawColor(180);
  y += 2;
  doc.line(margin, y, 196, y);

  doc.setFont('helvetica', 'normal');
  y += 6;
  for (const item of data.items) {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    const productLines = doc.splitTextToSize(item.name, 58);
    doc.text(productLines, cols[0], y);
    doc.text(String(item.quantity), cols[1], y);
    doc.text(item.unit, cols[2], y);
    const deliveryLines = doc.splitTextToSize(item.deliveryPackage, 22);
    doc.text(deliveryLines, cols[3], y);
    doc.text(`RM ${item.unitPrice.toFixed(2)}`, cols[4], y);
    doc.text(`RM ${item.lineTotal.toFixed(2)}`, cols[5], y);
    y += Math.max(productLines.length, deliveryLines.length) * 5 + 2;
  }

  y += 4;
  doc.line(margin, y, 196, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total: RM ${data.subtotal.toFixed(2)}`, 130, y);

  return y;
}

export function createPurchaseOrderPdfBlob(data: PurchaseOrderPdfData): Blob {
  const doc = new jsPDF();
  renderPurchaseOrderPage(doc, data);
  return doc.output('blob');
}

export function createCombinedPurchaseOrderPdfBlob(orders: PurchaseOrderPdfData[]): Blob {
  const doc = new jsPDF();
  orders.forEach((order, index) => {
    if (index > 0) doc.addPage();
    renderPurchaseOrderPage(doc, order);
  });
  return doc.output('blob');
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPurchaseOrderPdf(data: PurchaseOrderPdfData): void {
  const blob = createPurchaseOrderPdfBlob(data);
  triggerBlobDownload(blob, `${safePdfFilename(data.poNumber)}.pdf`);
}

export function downloadCombinedPurchaseOrderPdfs(orders: PurchaseOrderPdfData[]): void {
  if (orders.length === 0) return;
  if (orders.length === 1) {
    downloadPurchaseOrderPdf(orders[0]);
    return;
  }
  const blob = createCombinedPurchaseOrderPdfBlob(orders);
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `Purchase-Orders-${stamp}.pdf`);
}
