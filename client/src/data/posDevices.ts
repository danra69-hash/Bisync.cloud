/** POS Device Management — types & labels shared by UI. */

export type PosDeviceType =
  | 'posMain'
  | 'posOrderStation'
  | 'kitchenDisplay'
  | 'barDisplay'
  | 'kiosk'
  | 'printer';

export type PosConnectionType = 'ethernet' | 'wifi' | 'usb' | 'bluetooth' | 'cloud';

export const POS_DEVICE_TYPES: { value: PosDeviceType; label: string }[] = [
  { value: 'posMain', label: 'POS Main (with Cashier Feature)' },
  { value: 'posOrderStation', label: 'POS Order Station' },
  { value: 'kitchenDisplay', label: 'Kitchen Display Unit' },
  { value: 'barDisplay', label: 'Bar Display Unit' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'printer', label: 'Printer' },
];

export const POS_CONNECTION_TYPES: { value: PosConnectionType; label: string }[] = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'wifi', label: 'Wi‑Fi' },
  { value: 'usb', label: 'USB' },
  { value: 'bluetooth', label: 'Bluetooth' },
  { value: 'cloud', label: 'Cloud' },
];

export const PAPER_WIDTH_OPTIONS = [58, 80, 112] as const;

export type PosDeviceTypeOption = { value: string; label: string; active?: boolean };

export function deviceTypeLabel(type: string, catalog?: PosDeviceTypeOption[]): string {
  const fromCatalog = catalog?.find(t => t.value === type)?.label;
  if (fromCatalog) return fromCatalog;
  return POS_DEVICE_TYPES.find(t => t.value === type)?.label ?? type;
}

export function defaultPortForDeviceType(type: string): number {
  switch (type) {
    case 'printer':
      return 9100;
    case 'kitchenDisplay':
    case 'barDisplay':
      return 80;
    case 'kiosk':
      return 443;
    default:
      return 443;
  }
}

/** Merge company Device Types from POS Config with built-in fallbacks. */
export function mergePosDeviceTypeOptions(
  configured: { code: string; name: string; active?: boolean; sequence?: number }[],
  opts?: { activeOnly?: boolean },
): PosDeviceTypeOption[] {
  const activeOnly = opts?.activeOnly !== false;
  const rows = configured
    .filter(r => r.code.trim())
    .filter(r => (activeOnly ? r.active !== false : true))
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name))
    .map(r => ({
      value: r.code.trim(),
      label: r.name.trim() || r.code.trim(),
      active: r.active !== false,
    }));

  if (rows.length > 0) return rows;
  return POS_DEVICE_TYPES.map(t => ({ value: t.value, label: t.label, active: true }));
}

export function suggestDeviceTypeCode(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Prefer camelCase keys for new custom device types (matches built-in style).
  const parts = trimmed
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const [first, ...rest] = parts;
  const camel =
    first.charAt(0).toLowerCase()
    + first.slice(1).replace(/[^a-zA-Z0-9]/g, '')
    + rest.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace(/[^a-zA-Z0-9]/g, '')).join('');
  return camel.slice(0, 40);
}
