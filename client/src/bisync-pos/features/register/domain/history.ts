import type { MoneyCents } from '../../../core/types/money'
import type { OrderCharges } from './types'

export type ClosedCheckLine = {
  productName: string
  quantity: number
  unitPriceCents: MoneyCents
  totalCents: MoneyCents
}

export type ClosedCheck = {
  id: string
  checkNumber: number
  closedAt: string
  dining: string
  table: string
  lines: ClosedCheckLine[]
  charges: OrderCharges
  grandTotalCents: MoneyCents
  paymentMethod: string
}

export const MOCK_CLOSED_CHECKS: ClosedCheck[] = [
  {
    id: 'chk-1042',
    checkNumber: 1042,
    closedAt: '2026-07-27T21:48:00+08:00',
    dining: 'Dine In',
    table: 'Table 5',
    lines: [
      {
        productName: 'Fresh Basil Salad',
        quantity: 2,
        unitPriceCents: 1000,
        totalCents: 2000,
      },
      {
        productName: 'Iced Latte',
        quantity: 1,
        unitPriceCents: 1200,
        totalCents: 1200,
      },
    ],
    charges: {
      discountCents: 0,
      serviceCents: 320,
      taxRegularCents: 224,
      taxAlcoholCents: 0,
    },
    grandTotalCents: 3744,
    paymentMethod: 'Card',
  },
  {
    id: 'chk-1041',
    checkNumber: 1041,
    closedAt: '2026-07-27T20:15:00+08:00',
    dining: 'Takeaway',
    table: '—',
    lines: [
      {
        productName: 'Margherita Pizza',
        quantity: 1,
        unitPriceCents: 1000,
        totalCents: 1000,
      },
      {
        productName: 'Cola',
        quantity: 2,
        unitPriceCents: 450,
        totalCents: 900,
      },
    ],
    charges: {
      discountCents: 100,
      serviceCents: 0,
      taxRegularCents: 126,
      taxAlcoholCents: 0,
    },
    grandTotalCents: 1926,
    paymentMethod: 'Cash',
  },
  {
    id: 'chk-1040',
    checkNumber: 1040,
    closedAt: '2026-07-27T19:02:00+08:00',
    dining: 'Dine In',
    table: 'Table 12',
    lines: [
      {
        productName: 'Nasi Lemak',
        quantity: 3,
        unitPriceCents: 1100,
        totalCents: 3300,
      },
      {
        productName: 'Orange Juice',
        quantity: 2,
        unitPriceCents: 1000,
        totalCents: 2000,
      },
      {
        productName: 'Tomato Bisque',
        quantity: 1,
        unitPriceCents: 850,
        totalCents: 850,
      },
    ],
    charges: {
      discountCents: 200,
      serviceCents: 595,
      taxRegularCents: 458,
      taxAlcoholCents: 0,
    },
    grandTotalCents: 7003,
    paymentMethod: 'Card',
  },
  {
    id: 'chk-1039',
    checkNumber: 1039,
    closedAt: '2026-07-27T18:41:00+08:00',
    dining: 'Dine In',
    table: 'Table 2',
    lines: [
      {
        productName: 'Espresso',
        quantity: 2,
        unitPriceCents: 550,
        totalCents: 1100,
      },
    ],
    charges: {
      discountCents: 0,
      serviceCents: 0,
      taxRegularCents: 77,
      taxAlcoholCents: 0,
    },
    grandTotalCents: 1177,
    paymentMethod: 'Cash',
  },
  {
    id: 'chk-1038',
    checkNumber: 1038,
    closedAt: '2026-07-26T22:05:00+08:00',
    dining: 'Delivery',
    table: '—',
    lines: [
      {
        productName: 'Pepperoni Slice',
        quantity: 4,
        unitPriceCents: 950,
        totalCents: 3800,
      },
      {
        productName: 'Soft Drinks · Cola',
        quantity: 4,
        unitPriceCents: 450,
        totalCents: 1800,
      },
    ],
    charges: {
      discountCents: 0,
      serviceCents: 0,
      taxRegularCents: 392,
      taxAlcoholCents: 0,
    },
    grandTotalCents: 5992,
    paymentMethod: 'Online',
  },
]

export function formatCheckClosedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}
