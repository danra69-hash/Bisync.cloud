import type { ProductComponentItem } from '../api';
import { formatRm } from './createOrder';
import {
  formatNutritionValue,
  type NutritionalFactorRow,
  type ProductionMethodImage,
} from './productProductionMethod';
import { triggerBlobDownload } from './generatePurchaseOrderPdf';

export type ProductionMethodPdfData = {
  category: string;
  group: string;
  productName: string;
  methodText: string;
  images: ProductionMethodImage[];
  components: ProductComponentItem[];
  nutritionRows: NutritionalFactorRow[];
  yieldQuantity?: number;
  countryCode?: string;
};

type JsPDFDoc = import('jspdf').jsPDF;

async function loadJsPDF() {
  const { jsPDF } = await import('jspdf');
  return jsPDF;
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return cleaned || 'production-method';
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function drawWrappedText(doc: JsPDFDoc, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.2): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function renderProductionMethodPage(doc: JsPDFDoc, data: ProductionMethodPdfData): Promise<void> {
  const countryCode = data.countryCode;
  const margin = 14;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Production Method', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Category: ${data.category || '—'}`, margin, y);
  y += 5;
  doc.text(`Group: ${data.group || '—'}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Product: ${data.productName || '—'}`, margin, y);
  y += 8;

  const imageCount = 7;
  const gap = 2;
  const slotWidth = (contentWidth - gap * (imageCount - 1)) / imageCount;
  const imageHeight = 22;
  const labelHeight = 4;

  for (let index = 0; index < imageCount; index++) {
    const image = data.images[index];
    const x = margin + index * (slotWidth + gap);

    doc.setDrawColor(200);
    doc.setFillColor(248, 248, 248);
    doc.rect(x, y, slotWidth, imageHeight, 'FD');

    if (image?.dataUrl) {
      try {
        doc.addImage(
          image.dataUrl,
          imageFormatFromDataUrl(image.dataUrl),
          x + 0.5,
          y + 0.5,
          slotWidth - 1,
          imageHeight - 1,
          undefined,
          'FAST',
        );
      } catch {
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text('Image', x + slotWidth / 2, y + imageHeight / 2, { align: 'center' });
        doc.setTextColor(0);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const label = image?.label?.trim() || `Step ${index + 1}`;
    const wrappedLabel = doc.splitTextToSize(label, slotWidth);
    doc.text(wrappedLabel.slice(0, 2), x + slotWidth / 2, y + imageHeight + 3, { align: 'center', maxWidth: slotWidth });
  }

  y += imageHeight + labelHeight + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Product Component Detail', margin, y);
  y += 5;

  const colWidths = [10, 58, 18, 16, 28, 28];
  const headers = ['Seq', 'Smart component', 'UOM', 'Qty', 'UOM price', 'Subtotal'];
  const tableX = margin;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  let colX = tableX;
  headers.forEach((header, index) => {
    doc.text(header, colX + 1, y);
    colX += colWidths[index];
  });
  y += 4;
  doc.setDrawColor(180);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  const components = data.components.filter(item => item.componentId || item.componentName);
  if (components.length === 0) {
    doc.text('No product components added yet.', margin, y);
    y += 6;
  } else {
    for (let index = 0; index < components.length; index++) {
      const item = components[index];
      if (y > 250) {
        doc.addPage();
        y = 16;
      }
      const row = [
        String(index + 1),
        item.componentName || item.componentId || '—',
        item.componentUom || '—',
        String(item.quantity),
        formatRm(item.componentUomPrice, countryCode),
        formatRm(item.subtotal ?? item.componentUomPrice * item.quantity, countryCode),
      ];
      colX = tableX;
      row.forEach((cell, cellIndex) => {
        const wrapped = doc.splitTextToSize(cell, colWidths[cellIndex] - 2);
        doc.text(wrapped.slice(0, 2), colX + 1, y);
        colX += colWidths[cellIndex];
      });
      y += 5;
    }
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Production method', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const methodText = data.methodText.trim() || '—';
  y = drawWrappedText(doc, methodText, margin, y, contentWidth, 4.4);
  y += 4;

  if (y > 235) {
    doc.addPage();
    y = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Nutritional factors', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (data.yieldQuantity && data.yieldQuantity > 0) {
    doc.text(`Estimated per serving (yield ${data.yieldQuantity}).`, margin, y);
    y += 4;
  }

  const nutritionHeaders = ['Factor', 'Per serving', 'Unit'];
  const nutritionWidths = [50, 35, 20];
  colX = tableX;
  doc.setFont('helvetica', 'bold');
  nutritionHeaders.forEach((header, index) => {
    doc.text(header, colX + 1, y);
    colX += nutritionWidths[index];
  });
  y += 4;
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  for (const row of data.nutritionRows) {
    if (y > 285) {
      doc.addPage();
      y = 16;
    }
    const cells = [
      row.factor,
      formatNutritionValue(row.perRecipe, row.unit, countryCode),
      row.unit,
    ];
    colX = tableX;
    cells.forEach((cell, index) => {
      doc.text(cell, colX + 1, y);
      colX += nutritionWidths[index];
    });
    y += 4.5;
  }
}

export async function createProductionMethodPdfBlob(data: ProductionMethodPdfData): Promise<Blob> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await renderProductionMethodPage(doc, data);
  return doc.output('blob');
}

export async function downloadProductionMethodPdf(data: ProductionMethodPdfData): Promise<void> {
  const blob = await createProductionMethodPdfBlob(data);
  triggerBlobDownload(blob, `Production-Method-${safeFilename(data.productName)}.pdf`);
}
