/** Persisted user-adjusted table column widths (px) keyed by table id. */

const STORAGE_KEY = 'bisync.tableColumnWidths.v1';

export type TableColumnWidthMap = Record<string, number>;

type StoreShape = Record<string, TableColumnWidthMap>;

const MIN_WIDTH_PX = 48;
const MAX_WIDTH_PX = 960;

function readStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoreShape;
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clampTableColumnWidth(px: number): number {
  if (!Number.isFinite(px)) return MIN_WIDTH_PX;
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.round(px)));
}

export function loadTableColumnWidths(tableId: string): TableColumnWidthMap {
  if (!tableId) return {};
  const entry = readStore()[tableId];
  if (!entry || typeof entry !== 'object') return {};
  const out: TableColumnWidthMap = {};
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = clampTableColumnWidth(value);
    }
  }
  return out;
}

export function saveTableColumnWidths(tableId: string, widths: TableColumnWidthMap) {
  if (!tableId) return;
  const next: TableColumnWidthMap = {};
  for (const [key, value] of Object.entries(widths)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = clampTableColumnWidth(value);
    }
  }
  const store = readStore();
  if (Object.keys(next).length === 0) {
    delete store[tableId];
  } else {
    store[tableId] = next;
  }
  writeStore(store);
}

export function clearTableColumnWidths(tableId: string) {
  if (!tableId) return;
  const store = readStore();
  if (!(tableId in store)) return;
  delete store[tableId];
  writeStore(store);
}

export function mergeTableColumnWidth(
  tableId: string,
  columnKey: string,
  widthPx: number,
): TableColumnWidthMap {
  const current = loadTableColumnWidths(tableId);
  current[columnKey] = clampTableColumnWidth(widthPx);
  saveTableColumnWidths(tableId, current);
  return current;
}
