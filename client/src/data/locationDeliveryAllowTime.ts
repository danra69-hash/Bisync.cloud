/** Allowed delivery time windows for a location (HH:mm, :00 or :30). */

import { normalizeTime } from './locationOpeningHours';

export type DeliveryAllowPeriod = {
  from: string;
  to: string;
};

export function blankDeliveryPeriod(): DeliveryAllowPeriod {
  return { from: '', to: '' };
}

export function parseDeliveryAllowPeriodsJson(json: string | null | undefined): DeliveryAllowPeriod[] {
  if (!json?.trim() || json === '[]') return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(row => {
        if (!row || typeof row !== 'object') return null;
        const obj = row as Record<string, unknown>;
        const from = normalizeTime(obj.from ?? obj.openFrom ?? obj.start);
        const to = normalizeTime(obj.to ?? obj.openTo ?? obj.end);
        if (!from && !to) return null;
        return { from, to };
      })
      .filter((row): row is DeliveryAllowPeriod => row != null);
  } catch {
    return [];
  }
}

export function serializeDeliveryAllowPeriods(periods: DeliveryAllowPeriod[]): string {
  const payload = periods
    .map(p => ({
      from: normalizeTime(p.from),
      to: normalizeTime(p.to),
    }))
    .filter(p => p.from || p.to);
  return JSON.stringify(payload);
}

/** When enabled, at least one complete from/to window is required. */
export function validateDeliveryAllowPeriods(
  enabled: boolean,
  periods: DeliveryAllowPeriod[],
): string | null {
  if (!enabled) return null;
  if (periods.length === 0) {
    return 'Add at least one delivery allow time period (From / To).';
  }
  for (let i = 0; i < periods.length; i += 1) {
    const from = normalizeTime(periods[i].from);
    const to = normalizeTime(periods[i].to);
    if (!from || !to) {
      return `Delivery period ${i + 1}: both From and To are required.`;
    }
    if (from === to) {
      return `Delivery period ${i + 1}: From and To must be different.`;
    }
  }
  return null;
}
