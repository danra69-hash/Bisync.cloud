import { fromApiUom, getConversionFactor, type AltUnitEntry } from './componentForm';
import { formatCountryNumber } from '../utils/numberFormat';
import {
  formatDeliveryUnitPath,
  type DeliveryUnitBreakdown,
} from './vendorProductCatalog';

export const MAX_BATCH_ADDITIONAL_UOMS = 5;

/** Primary / Secondary Packaging levels for Sub-Product Delivery Unit (Production unit). */
export type YieldPackagingLevels = {
  primaryQty: string;
  primaryUnit: string;
  secondaryQty: string;
  secondaryUnit: string;
};

type YieldAltUnitsPayloadV2 = {
  v: 2;
  packaging: YieldPackagingLevels;
  altUnits: AltUnitEntry[];
};

export function emptyYieldPackaging(): YieldPackagingLevels {
  return {
    primaryQty: '',
    primaryUnit: '',
    secondaryQty: '',
    secondaryUnit: '',
  };
}

export function hasYieldPackaging(packaging: YieldPackagingLevels): boolean {
  return Boolean(
    packaging.primaryUnit.trim()
    || packaging.secondaryUnit.trim()
    || packaging.primaryQty.trim()
    || packaging.secondaryQty.trim(),
  );
}

function normalizeAltUnitEntries(raw: unknown): AltUnitEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: AltUnitEntry) => ({
      unit: item?.unit?.trim() ?? '',
      fromQty: item?.fromQty?.trim() ?? '1',
      qty: item?.qty?.trim() ?? '',
    }))
    .filter(item => item.unit)
    .slice(0, MAX_BATCH_ADDITIONAL_UOMS);
}

function normalizePackaging(raw: Partial<YieldPackagingLevels> | null | undefined): YieldPackagingLevels {
  return {
    primaryQty: String(raw?.primaryQty ?? '').trim(),
    primaryUnit: fromApiUom(String(raw?.primaryUnit ?? '').trim()) || String(raw?.primaryUnit ?? '').trim(),
    secondaryQty: String(raw?.secondaryQty ?? '').trim(),
    secondaryUnit: fromApiUom(String(raw?.secondaryUnit ?? '').trim()) || String(raw?.secondaryUnit ?? '').trim(),
  };
}

export function parseYieldAltUnitsPayload(json: string | null | undefined): {
  packaging: YieldPackagingLevels;
  altUnits: AltUnitEntry[];
} {
  if (!json?.trim()) return { packaging: emptyYieldPackaging(), altUnits: [] };
  try {
    const parsed = JSON.parse(json) as AltUnitEntry[] | YieldAltUnitsPayloadV2;
    if (Array.isArray(parsed)) {
      return {
        packaging: emptyYieldPackaging(),
        altUnits: normalizeAltUnitEntries(parsed).map(entry => ({
          ...entry,
          unit: fromApiUom(entry.unit) || entry.unit,
        })),
      };
    }
    if (parsed && typeof parsed === 'object' && (parsed as YieldAltUnitsPayloadV2).v === 2) {
      const v2 = parsed as YieldAltUnitsPayloadV2;
      return {
        packaging: normalizePackaging(v2.packaging),
        altUnits: normalizeAltUnitEntries(v2.altUnits).map(entry => ({
          ...entry,
          unit: fromApiUom(entry.unit) || entry.unit,
        })),
      };
    }
  } catch {
    // ignore invalid JSON
  }
  return { packaging: emptyYieldPackaging(), altUnits: [] };
}

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
  return parseYieldAltUnitsPayload(json).altUnits;
}

export function loadYieldPackagingFromProduct(json: string | null | undefined): YieldPackagingLevels {
  return parseYieldAltUnitsPayload(json).packaging;
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

export function serializeYieldAltUnitsPayload(
  packaging: YieldPackagingLevels,
  altUnits: AltUnitEntry[],
): string {
  const cleanedAlt = altUnits
    .filter(entry => entry.unit.trim())
    .slice(0, MAX_BATCH_ADDITIONAL_UOMS)
    .map(entry => ({
      unit: entry.unit.trim(),
      fromQty: entry.fromQty?.trim() || '1',
      qty: entry.qty?.trim() || '',
    }));

  if (!hasYieldPackaging(packaging)) {
    return JSON.stringify(cleanedAlt);
  }

  const payload: YieldAltUnitsPayloadV2 = {
    v: 2,
    packaging: {
      primaryQty: packaging.primaryQty.trim(),
      primaryUnit: packaging.primaryUnit.trim(),
      secondaryQty: packaging.secondaryQty.trim(),
      secondaryUnit: packaging.secondaryUnit.trim(),
    },
    altUnits: cleanedAlt,
  };
  return JSON.stringify(payload);
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
  const entries = parseYieldAltUnitsJson(json);
  if (!batchUom.trim()) return entries;
  return refreshBatchAdditionalUoms(entries, 0, batchUom);
}

/** Compare/save helper: normalize alt units (+ packaging) with the actual batch size. */
export function normalizedYieldAltUnitsJson(
  json: string | null | undefined,
  batchQty: number,
  batchUom: string,
): string {
  const { packaging, altUnits } = parseYieldAltUnitsPayload(json);
  const refreshed = batchUom.trim()
    ? refreshBatchAdditionalUoms(altUnits, batchQty, batchUom)
    : altUnits;
  return serializeYieldAltUnitsPayload(packaging, refreshed);
}

export function normalizedYieldAltUnitsFromEntries(
  entries: AltUnitEntry[],
  batchQty: number,
  batchUom: string,
  packaging: YieldPackagingLevels = emptyYieldPackaging(),
): string {
  const refreshed = batchUom.trim()
    ? refreshBatchAdditionalUoms(entries, batchQty, batchUom)
    : entries;
  return serializeYieldAltUnitsPayload(packaging, refreshed);
}

/** Build vendor-style delivery breakdown from sub-product Order + packaging levels. */
export function subProductDeliveryBreakdown(
  orderQty: string | number,
  orderUnit: string,
  packaging: YieldPackagingLevels,
): DeliveryUnitBreakdown {
  const qty = typeof orderQty === 'number' ? orderQty : (parseFloat(orderQty) || 0);
  const unit = orderUnit.trim();
  const primaryUnit = packaging.primaryUnit.trim() || unit;
  const primaryQty = parseFloat(packaging.primaryQty) || (packaging.primaryUnit.trim() ? 1 : 1);
  const secondaryUnit = packaging.secondaryUnit.trim() || primaryUnit;
  const secondaryQty = parseFloat(packaging.secondaryQty) || (packaging.secondaryUnit.trim() ? 1 : 1);
  return {
    orderQty: qty > 0 ? qty : 1,
    orderUnit: unit,
    packQty: primaryQty > 0 ? primaryQty : 1,
    packUnit: primaryUnit || unit,
    unitQty: secondaryQty > 0 ? secondaryQty : 1,
    unitUnit: secondaryUnit || primaryUnit || unit,
  };
}

export function formatSubProductDeliveryUnitPath(
  orderQty: string | number,
  orderUnit: string,
  packaging: YieldPackagingLevels,
): string {
  if (!orderUnit.trim()) return '—';
  return formatDeliveryUnitPath(subProductDeliveryBreakdown(orderQty, orderUnit, packaging));
}
