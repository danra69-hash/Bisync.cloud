import type { ProductComponentItem } from '../api';
import {
  formatNutritionValue,
  type NutritionalFactorRow,
  type ProductionMethodImage,
} from './productProductionMethod';
import { triggerBlobDownload } from './generatePurchaseOrderPdf';
import { loadJsPDF } from './loadJsPdf';

export type RecipeCardPdfData = {
  companyName: string;
  locationNames: string[];
  productId: string;
  category: string;
  group: string;
  productName: string;
  productType: string;
  methodText: string;
  presentationDataUrl: string | null;
  images: ProductionMethodImage[];
  components: ProductComponentItem[];
  nutritionRows: NutritionalFactorRow[];
  yieldQuantity?: number;
  countryCode?: string;
};

type JsPDFDoc = import('jspdf').jsPDF;

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return cleaned || 'recipe-card';
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

function drawWrappedText(doc: JsPDFDoc, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.2): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: JsPDFDoc, y: number, needed: number): number {
  if (y + needed <= 285) return y;
  doc.addPage();
  return 16;
}

function drawImageSlot(
  doc: JsPDFDoc,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  emptyLabel: string,
): void {
  doc.setDrawColor(200);
  doc.setFillColor(248, 248, 248);
  doc.rect(x, y, width, height, 'FD');
  if (dataUrl) {
    try {
      doc.addImage(
        dataUrl,
        imageFormatFromDataUrl(dataUrl),
        x + 0.5,
        y + 0.5,
        width - 1,
        height - 1,
        undefined,
        'FAST',
      );
      return;
    } catch {
      /* fall through */
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(emptyLabel, x + width / 2, y + height / 2, { align: 'center' });
  doc.setTextColor(0);
}

async function renderRecipeCardPage(doc: JsPDFDoc, data: RecipeCardPdfData): Promise<void> {
  const countryCode = data.countryCode;
  const margin = 14;
  const pageWidth = 210;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Recipe Card', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Company: ${data.companyName || '—'}`, margin, y);
  y += 5;
  const locations = data.locationNames.filter(Boolean);
  doc.text(`Location: ${locations.length > 0 ? locations.join(', ') : '—'}`, margin, y);
  y += 5;
  doc.text(`Product ID: ${data.productId || '—'}`, margin, y);
  y += 5;
  doc.text(`Category: ${data.category || '—'}`, margin, y);
  y += 5;
  doc.text(`Group: ${data.group || '—'}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Product: ${data.productName || '—'}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Product Type: ${data.productType || '—'}`, margin, y);
  y += 8;

  // Presentation photo (left) + step photos strip
  const presentationW = 42;
  const presentationH = 42;
  y = ensureSpace(doc, y, presentationH + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Product Presentation', margin, y);
  y += 3;
  drawImageSlot(doc, data.presentationDataUrl, margin, y, presentationW, presentationH, 'No photo');
  const stepsX = margin + presentationW + 4;
  const stepsWidth = contentWidth - presentationW - 4;
  const imageCount = 7;
  const gap = 1.5;
  const slotWidth = (stepsWidth - gap * (imageCount - 1)) / imageCount;
  const imageHeight = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Production steps', stepsX, y - 3);

  for (let index = 0; index < imageCount; index++) {
    const image = data.images[index];
    const x = stepsX + index * (slotWidth + gap);
    drawImageSlot(doc, image?.dataUrl, x, y, slotWidth, imageHeight, `${index + 1}`);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const label = image?.label?.trim() || `Step ${index + 1}`;
    const wrappedLabel = doc.splitTextToSize(label, slotWidth);
    doc.text(wrappedLabel.slice(0, 2), x + slotWidth / 2, y + imageHeight + 2.5, {
      align: 'center',
      maxWidth: slotWidth,
    });
  }

  y += Math.max(presentationH, imageHeight + 8) + 6;

  // Components table
  y = ensureSpace(doc, y, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Smart Components', margin, y);
  y += 5;

  const colWidths = [90, 40, 30];
  const headers = ['Smart Component', 'Smart Component UOM', 'QTY'];
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
    doc.text('No smart components added yet.', margin, y);
    y += 6;
  } else {
    for (const item of components) {
      y = ensureSpace(doc, y, 8);
      const row = [
        item.componentName || item.componentId || '—',
        item.componentUom || '—',
        String(item.quantity),
      ];
      colX = tableX;
      let rowHeight = 5;
      row.forEach((cell, cellIndex) => {
        const wrapped = doc.splitTextToSize(cell, colWidths[cellIndex] - 2);
        doc.text(wrapped.slice(0, 2), colX + 1, y);
        rowHeight = Math.max(rowHeight, Math.min(wrapped.length, 2) * 4);
        colX += colWidths[cellIndex];
      });
      y += rowHeight;
    }
  }

  y += 4;
  y = ensureSpace(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Method', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const methodText = data.methodText.trim() || '—';
  y = drawWrappedText(doc, methodText, margin, y, contentWidth, 4.4);
  y += 6;

  y = ensureSpace(doc, y, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Estimated Nutrient Value', margin, y);
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
  if (data.nutritionRows.length === 0) {
    doc.text('No nutrient estimate available.', margin, y);
  } else {
    for (const row of data.nutritionRows) {
      y = ensureSpace(doc, y, 6);
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
}

export async function createRecipeCardPdfBlob(data: RecipeCardPdfData): Promise<Blob> {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await renderRecipeCardPage(doc, data);
  return doc.output('blob');
}

export async function downloadRecipeCardPdf(data: RecipeCardPdfData): Promise<void> {
  const blob = await createRecipeCardPdfBlob(data);
  triggerBlobDownload(blob, `Recipe-Card-${safeFilename(data.productName)}.pdf`);
}
