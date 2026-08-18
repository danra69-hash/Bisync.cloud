import type { StockCardLedgerEntry } from '../../api'

export function stockCardEntryTypeLabel(
  entryType: StockCardLedgerEntry['entryType'] | string,
  reason?: string,
): string {
  if (reason && /prepaid/i.test(reason)) return 'Pre-paid consumption'
  switch (entryType) {
    case 'balance_forward':
      return 'Opening Stock'
    case 'purchase':
      return 'Purchase'
    case 'cash_purchase':
      return 'Cash purchase'
    case 'transfer_in':
      return 'Transfer in'
    case 'transfer_out':
      return 'Transfer out'
    case 'pos_sale':
      return 'QTY Sold'
    case 'online_order':
      return 'Online order'
    case 'offline_order':
      return 'Offline order'
    case 'wastage':
      return 'Wastage'
    case 'production':
      return 'Production'
    case 'adjustment_in':
      return 'Stock Debit Adjustment'
    case 'adjustment_out':
      return 'Stock Credit Adjustment'
    case 'adjustment':
      return 'Adjustment'
    case 'inbound':
      return 'Inbound'
    case 'outbound':
      return 'Outbound'
    case 'split_use':
      return 'Split use'
    case 'split_use_in':
      return 'Split use in'
    case 'credit_note':
      return 'Credit note'
    case 'store_issue':
      return 'Store issue'
    default:
      return entryType.replace(/_/g, ' ')
  }
}

export function isInboundLedgerEntry(entry: StockCardLedgerEntry): boolean {
  if (entry.entryType === 'balance_forward') return entry.signedQty > 0
  if (entry.signedQty > 0) return true
  return (
    entry.entryType === 'purchase'
    || entry.entryType === 'cash_purchase'
    || entry.entryType === 'transfer_in'
    || entry.entryType === 'adjustment_in'
    || entry.entryType === 'inbound'
    || entry.entryType === 'split_use_in'
  )
}

export function isOutboundLedgerEntry(entry: StockCardLedgerEntry): boolean {
  if (entry.entryType === 'balance_forward') return false
  if (entry.signedQty < 0) return true
  return (
    entry.entryType === 'pos_sale'
    || entry.entryType === 'online_order'
    || entry.entryType === 'offline_order'
    || entry.entryType === 'wastage'
    || entry.entryType === 'transfer_out'
    || entry.entryType === 'production'
    || entry.entryType === 'adjustment_out'
    || entry.entryType === 'outbound'
    || entry.entryType === 'split_use'
    || entry.entryType === 'credit_note'
    || entry.entryType === 'store_issue'
  )
}

export function formatInboundSequence(entry: StockCardLedgerEntry): string {
  if (entry.entryType === 'balance_forward') return 'OPEN'
  if (entry.inboundSequenceNo && entry.inboundSequenceNo > 0) return `IN#${entry.inboundSequenceNo}`
  return entry.referenceNumber?.trim() || '—'
}

export function formatSourceInboundSequence(entry: StockCardLedgerEntry): string {
  if (entry.sourceInboundSequenceNo && entry.sourceInboundSequenceNo > 0) {
    return `IN#${entry.sourceInboundSequenceNo}`
  }
  const match = entry.fifoDetail?.match(/IN#(\d+)/)
  if (match) return `IN#${match[1]}`
  return '—'
}
