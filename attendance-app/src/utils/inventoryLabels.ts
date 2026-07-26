import type { InventoryAdjustment } from '../api/inventory'

export function roleLabel(role?: string | null) {
  switch ((role || '').toLowerCase()) {
    case 'master':
      return 'MS'
    case 'locationadmin':
      return 'LA'
    case 'operation':
      return 'OP'
    case 'regionaladmin':
      return 'RA'
    default:
      return ''
  }
}

export function roleClass(role?: string | null) {
  switch ((role || '').toLowerCase()) {
    case 'master':
      return 'role-ms'
    case 'locationadmin':
      return 'role-la'
    case 'operation':
      return 'role-op'
    case 'regionaladmin':
      return 'role-ra'
    default:
      return ''
  }
}

export function statusClass(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'autocompleted':
      return 'status-auto'
    case 'completed':
      return 'status-completed'
    case 'pending':
    case 'draft':
      return 'status-pending'
    default:
      return ''
  }
}

export function inventoryDateLabel(item: Pick<InventoryAdjustment, 'stockTakeDate' | 'createdDate'>) {
  return item.stockTakeDate || item.createdDate || '—'
}

export function formatDateRangeDisplay(fromDate?: string | null, toDate?: string | null) {
  if (!fromDate || !toDate) return null
  const from = fromDate.split('T')[0]
  const to = toDate.split('T')[0]
  return `${from} - ${to}`
}
