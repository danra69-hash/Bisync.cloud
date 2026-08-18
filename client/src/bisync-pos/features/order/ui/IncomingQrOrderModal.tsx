import { formatQrOrderTime, type PosQrOrder } from '../domain/qrOrder'
import './IncomingQrOrderModal.css'

type Props = {
  order: PosQrOrder
  queueCount: number
  busy: boolean
  error: string | null
  onAccept: () => void
  onReject: () => void
}

/** Staff must Accept before a guest QR order is sent to Bar / Kitchen. */
export function IncomingQrOrderModal({
  order,
  queueCount,
  busy,
  error,
  onAccept,
  onReject,
}: Props) {
  const total = order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return (
    <div
      className="incoming-qr-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-qr-title"
    >
      <div className="incoming-qr-modal__backdrop" aria-hidden />
      <div className="incoming-qr-modal__card">
        <header className="incoming-qr-modal__head">
          <div>
            <p className="incoming-qr-modal__eyebrow">Guest QR order</p>
            <h2 id="incoming-qr-title">
              {order.tableLabel || 'QR'} · review &amp; accept
            </h2>
            <p>
              {formatQrOrderTime(order.createdAt)}
              {order.guestName ? ` · ${order.guestName}` : ''}
              {queueCount > 1 ? ` · ${queueCount} waiting` : ''}
            </p>
          </div>
        </header>

        <ul className="incoming-qr-modal__lines">
          {order.items.map((item, idx) => (
            <li key={`${order.id}-${item.productId}-${idx}`}>
              <span className="incoming-qr-modal__qty">{item.quantity}×</span>
              <span className="incoming-qr-modal__name">
                {item.name}
                {item.detail ? (
                  <em>{item.detail}</em>
                ) : null}
              </span>
              <span className="incoming-qr-modal__price">
                {(item.unitPrice * item.quantity).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
          ))}
        </ul>

        <div className="incoming-qr-modal__total">
          <span>Total</span>
          <strong>
            {(order.totalValue || total).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>

        {error ? (
          <p className="incoming-qr-modal__error" role="alert">{error}</p>
        ) : null}

        <div className="incoming-qr-modal__actions">
          <button
            type="button"
            className="chip-btn"
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </button>
          <button
            type="button"
            className="chip-btn chip-btn--primary"
            disabled={busy}
            onClick={onAccept}
          >
            {busy ? 'Sending…' : 'Accept → Bar / Kitchen'}
          </button>
        </div>
      </div>
    </div>
  )
}
