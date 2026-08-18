export type DrawerEventType = 'drop' | 'pay-in' | 'blind-close' | 'shift-change'

export type DrawerEvent = {
  id: string
  type: DrawerEventType
  amountCents: number
  at: string
  note?: string
}

export const MOCK_DRAWER_EVENTS: DrawerEvent[] = [
  {
    id: 'd1',
    type: 'pay-in',
    amountCents: 20000,
    at: '09:00',
    note: 'Opening float',
  },
  {
    id: 'd2',
    type: 'drop',
    amountCents: 50000,
    at: '14:20',
    note: 'Safe drop',
  },
]

export const DRAWER_EVENT_LABEL: Record<DrawerEventType, string> = {
  drop: 'Cash drop',
  'pay-in': 'Pay in',
  'blind-close': 'Blind closeout',
  'shift-change': 'Shift change',
}
