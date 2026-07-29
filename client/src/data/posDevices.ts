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

export function deviceTypeLabel(type: string): string {
  return POS_DEVICE_TYPES.find(t => t.value === type)?.label ?? type;
}

export function defaultPortForDeviceType(type: PosDeviceType): number {
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
