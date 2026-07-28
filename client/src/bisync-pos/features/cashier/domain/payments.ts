export type TenderType =
  | 'card-emv'
  | 'tap'
  | 'qr'
  | 'cash'
  | 'gift-card'

export type SplitMethod = 'even' | 'by-seat' | 'by-item'

export type PaymentLine = {
  tender: TenderType
  amountCents: number
}

export const TENDER_LABEL: Record<TenderType, string> = {
  'card-emv': 'EMV Chip',
  tap: 'Tap to Pay',
  qr: 'QR Pay',
  cash: 'Cash',
  'gift-card': 'Gift Card',
}
