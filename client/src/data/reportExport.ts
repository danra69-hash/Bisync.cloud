import { triggerBlobDownload } from './generatePurchaseOrderPdf';

/** Escape a CSV cell (RFC-style quoting). */
export function csvEscape(value: unknown): string {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function rowsToCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
): string {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const body = rows.map(row => columns.map(c => csvEscape(row[c.key])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function downloadReportCsv(
  filenameBase: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
) {
  const csv = rowsToCsv(columns, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `${filenameBase}-${stamp}.csv`);
}
