export type PosMode = 'order' | 'cashier' | 'kiosk' | 'boh'

export type DeviceProfile =
  | 'handheld'
  | 'tableside'
  | 'waiter-terminal'
  | 'counter'
  | 'bar'
  | 'kiosk'
  | 'kds'
  | 'back-office'
  | 'manager-tablet'

export type ModeMeta = {
  id: PosMode
  label: string
  shortLabel: string
  goal: string
  devices: DeviceProfile[]
  homePath: string
}

export const MODE_META: Record<PosMode, ModeMeta> = {
  order: {
    id: 'order',
    label: 'Order Mode',
    shortLabel: 'Order',
    goal: 'Speed, accuracy, and kitchen communication',
    devices: ['handheld', 'tableside', 'waiter-terminal'],
    homePath: '/order/floor',
  },
  cashier: {
    id: 'cashier',
    label: 'Cashier Mode',
    shortLabel: 'Cashier',
    goal: 'Secure payments, check control, and shift cash',
    devices: ['counter', 'bar'],
    homePath: '/cashier',
  },
  kiosk: {
    id: 'kiosk',
    label: 'Kiosk Mode',
    shortLabel: 'Kiosk',
    goal: 'Guest self-order and pay at the counter kiosk',
    devices: ['kiosk'],
    homePath: '/kiosk',
  },
  boh: {
    id: 'boh',
    label: 'Back of House',
    shortLabel: 'BOH',
    goal: 'Fulfillment, labor, reporting, and permissions',
    devices: ['kds', 'back-office', 'manager-tablet'],
    homePath: '/boh/kds',
  },
}

export const MODE_STORAGE_KEY = 'bisync-pos-mode'
