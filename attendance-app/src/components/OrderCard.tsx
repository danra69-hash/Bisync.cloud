import type { OrderSummary } from '../types'
import { formatOrderStatus, orderStatusHint } from '../utils/statusLabels'
import { useAuth } from '../auth/AuthProvider'

function money(value?: number) {
  if (value == null || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(value)
}

function statusOf(order: OrderSummary) {
  return order.status || order.orderStatus || '—'
}

export function OrderCard({
  order,
  onClick,
  subtitle,
}: {
  order: OrderSummary
  onClick: () => void
  subtitle?: string
}) {
  const { usageRole } = useAuth()
  const rawStatus = statusOf(order)
  const role = usageRole === 'vendor' ? 'vendor' : 'operator'
  const hint = orderStatusHint(rawStatus, role)

  return (
    <article className="card order-card" onClick={onClick}>
      <div className="order-card-row">
        <strong>{order.purchaseOrderNumber || `#${order.id}`}</strong>
        <span className="badge" title={hint || undefined}>
          {formatOrderStatus(rawStatus, role)}
        </span>
      </div>
      {hint && (
        <div className="muted" style={{ fontSize: '11px', marginTop: 2 }}>
          {hint}
        </div>
      )}
      <div className="order-card-row muted">
        <span>
          {order.outletName || order.operatorOutletName || order.operatorCompanyName || '—'}
        </span>
        <span>{order.vendorName || ''}</span>
      </div>
      <div className="order-card-row">
        <span className="muted">{order.createdOn || ''}</span>
        <strong>{money(order.grandTotal ?? order.total)}</strong>
      </div>
      {subtitle && (
        <div className="muted" style={{ marginTop: 4, fontSize: '11px' }}>
          {subtitle}
        </div>
      )}
    </article>
  )
}