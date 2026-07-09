import { fromApiUom, getConversionFactor, type AltUnitEntry } from './componentForm';
import { formatCountryNumber } from '../utils/numberFormat';

export const MAX_BATCH_ADDITIONAL_UOMS = 5;

export function isBatchPackStyleUnit(unit: string, batchUom: string): boolean {
  if (!unit.trim() || !batchUom.trim()) return false;
  if (unit === batchUom) return false;
  return getConversionFactor(batchUom, unit) === null;
}

export function formatBatchAdditionalQty(value: number, countryCode = 'MY'): string {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  if (Number.isInteger(value) && value !== 0) return String(value);
  return formatCountryNumber(value, countryCode);
}

export function resolveBatchAdditionalEntry(
  entry: AltUnitEntry,
  batchQty: number,
  batchUom: string,
): {
  fromQty: string;
  qty: string;
  autoFilled: boolean;
  packStyle: boolean;
  perPackLabel: string | null;
} {
  const packStyle = isBatchPackStyleUnit(entry.unit, batchUom);
  if (packStyle) {
    const packs = parseFloat(entry.fromQty) || 0;
    const perPack = packs > 0 && batchQty > 0 ? batchQty / packs : null;
    return {
      fromQty: entry.fromQty,
      qty: perPack !== null ? formatBatchAdditionalQty(perPack) : entry.qty,
      autoFilled: false,
      packStyle: true,
      perPackLabel: perPack !== null && batchUom
        ? `${formatBatchAdditionalQty(perPack)} ${batchUom} per ${entry.unit}`
        : null,
    };
  }

  const effectiveBatchQty = batchQty > 0 ? batchQty : 1;
  const factor = getConversionFactor(batchUom, entry.unit);
  const converted = factor !== null ? effectiveBatchQty * factor : null;
  return {
    fromQty: effectiveBatchQty > 0 ? String(effectiveBatchQty) : '1',
    qty: converted !== null ? formatBatchAdditionalQty(converted) : entry.qty,
    autoFilled: converted !== null,
    packStyle: false,
    perPackLabel: null,
  };
}

export function refreshBatchAdditionalUoms(
  entries: AltUnitEntry[],
  batchQty: number,
  batchUom: string,
): AltUnitEntry[] {
  if (!batchUom.trim()) return entries;
  return entries.map(entry => {
    const resolved = resolveBatchAdditionalEntry(entry, batchQty, batchUom);
    if (resolved.packStyle) {
      return {
        ...entry,
        qty: resolved.qty,
      };
    }
    return {
      ...entry,
      fromQty: resolved.fromQty,
      qty: resolved.qty,
    };
  });
}

export function parseYieldAltUnitsJson(json: string | null | undefined): AltUnitEntry[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as AltUnitEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => ({
        unit: item.unit?.trim() ?? '',
        fromQty: item.fromQty?.trim() ?? '1',
        qty: item.qty?.trim() ?? '',
      }))
      .filter(item => item.unit)
      .slice(0, MAX_BATCH_ADDITIONAL_UOMS);
  } catch {
    return [];
  }
}

export function serializeYieldAltUnits(entries: AltUnitEntry[]): string {
  const cleaned = entries
    .filter(entry => entry.unit.trim())
    .slice(0, MAX_BATCH_ADDITIONAL_UOMS)
    .map(entry => ({
      unit: entry.unit.trim(),
      fromQty: entry.fromQty?.trim() || '1',
      qty: entry.qty?.trim() || '',
    }));
  return JSON.stringify(cleaned);
}

export function formatYieldAltUnitsForDisplay(
  entries: AltUnitEntry[],
  batchQty: number,
  batchUom: string,
): string[] {
  return entries.map(entry => {
    const resolved = resolveBatchAdditionalEntry(entry, batchQty, batchUom);
    if (resolved.packStyle) {
      const packs = entry.fromQty || '—';
      return resolved.perPackLabel
        ? `${entry.unit}: ${packs} pack(s) · ${resolved.perPackLabel}`
        : `${entry.unit}: ${packs} pack(s)`;
    }
    return `${entry.unit}: ${resolved.qty || '—'} (= ${resolved.fromQty} ${batchUom})`;
  });
}

export function loadYieldAltUnitsFromProduct(json: string | null | undefined, batchUom: string): AltUnitEntry[] {
  const entries = parseYieldAltUnitsJson(json).map(entry => ({
    ...entry,
    unit: fromApiUom(entry.unit) || entry.unit,
  }));
  if (!batchUom.trim()) return entries;
  return refreshBatchAdditionalUoms(entries, 0, batchUom);
}

/** Compare/save helper: normalize alt units with the actual batch size. */
export function normalizedYieldAltUnitsJson(
  json: string | null | undefined,
  batchQty: number,
  batchUom: string,
): string {
  const entries = parseYieldAltUnitsJson(json).map(entry => ({
    ...entry,
    unit: fromApiUom(entry.unit) || entry.unit,
  }));
  if (!batchUom.trim()) return serializeYieldAltUnits(entries);
  return serializeYieldAltUnits(refreshBatchAdditionalUoms(entries, batchQty, batchUom));
}

export function normalizedYieldAltUnitsFromEntries(
  entries: AltUnitEntry[],
  batchQty: number,
  batchUom: string,
): string {
  if (!batchUom.trim()) return serializeYieldAltUnits(entries);
  return serializeYieldAltUnits(refreshBatchAdditionalUoms(entries, batchQty, batchUom));
}
