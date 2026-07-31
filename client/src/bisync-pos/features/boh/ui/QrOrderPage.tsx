import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import {
  cancelQrOrder,
  fetchOpenQrOrders,
  formatQrOrderTime,
  markQrOrderSent,
  notifyQrOrderChanged,
  buildQrOrderUrl,
  qrOrderImageUrl,
  QR_ORDER_CHANGED_EVENT,
  type PosQrOrder,
} from '../../order/domain/qrOrder'
import { fireCartToStations } from '../domain/kitchenTickets'
import type { CartLine, Product } from '../../register/domain/types'
import './QrOrderPage.css'

export function QrOrderPage() {
  const session = usePosSessionOptional()
  const companyId = session?.companyId ?? 0
  const locationId = session?.locationId ?? ''
  const locationName =
    session?.locations.find(l => l.externalId === locationId)?.name || locationId || 'Location'

  const [orders, setOrders] = useState<PosQrOrder[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const joinUrl = useMemo(
    () => (companyId > 0 && locationId ? buildQrOrderUrl(companyId, locationId) : ''),
    [companyId, locationId],
  )
  const qrSrc = useMemo(
    () => (companyId > 0 && locationId ? qrOrderImageUrl(companyId, locationId, 240) : ''),
    [companyId, locationId],
  )

  const refresh = useCallback(async () => {
    if (companyId <= 0 || !locationId) {
      setOrders([])
      return
    }
    try {
      setError(null)
      setOrders(await fetchOpenQrOrders(companyId, locationId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load QR orders.')
    }
  }, [companyId, locationId])

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(QR_ORDER_CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    const poll = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.removeEventListener(QR_ORDER_CHANGED_EVENT, onChange)
      window.removeEventListener('storage', onChange)
      window.clearInterval(poll)
    }
  }, [refresh])

  async function copyLink() {
    if (!joinUrl) return
    try {
      await navigator.clipboard?.writeText(joinUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy QR order link', joinUrl)
    }
  }

  async function sendToStations(order: PosQrOrder) {
    if (busyId != null) return
    setBusyId(order.id)
    try {
      const products: Product[] = order.items.map(item => {
        const deptHint = `${item.name} ${item.detail || ''}`
        const department = /(beer|wine|drink|beverage|cocktail|coffee|juice|soft)/i.test(deptHint)
          ? 'Beverage'
          : 'Food'
        return {
          id: String(item.productId),
          sku: String(item.productId),
          name: item.name,
          priceCents: Math.round(item.unitPrice * 100),
          department,
          group: 'QR Order',
          emoji: '🍽️',
          accent: '#e0f2fe',
        }
      })
      const lines: CartLine[] = order.items.map(item => ({
        productId: String(item.productId),
        quantity: item.quantity,
      }))
      const tickets = fireCartToStations({
        lines,
        products,
        checkNumber: 9000 + (order.id % 900),
        tableLabel: order.tableLabel || 'QR',
        dining: 'dine-in',
      })
      if (tickets.length === 0) {
        setError('Nothing to send to Bar or Kitchen for this order.')
        return
      }
      await markQrOrderSent(order.id)
      notifyQrOrderChanged()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send order.')
    } finally {
      setBusyId(null)
    }
  }

  async function dismissOrder(order: PosQrOrder) {
    if (busyId != null) return
    setBusyId(order.id)
    try {
      await cancelQrOrder(order.id)
      notifyQrOrderChanged()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel order.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="qr-order-board">
      <header className="qr-order-board__head">
        <div>
          <p className="qr-order-board__code">QR Order</p>
          <h1>Guest e-menu</h1>
          <p className="qr-order-board__sub">
            Guests scan to order at <strong>{locationName}</strong>. Incoming orders appear below —
            send them to BDS / KDS.
          </p>
        </div>
        <div className="qr-order-board__count" aria-live="polite">
          <strong>{orders.length}</strong>
          <span>{orders.length === 1 ? 'open order' : 'open orders'}</span>
        </div>
      </header>

      <div className="qr-order-board__layout">
        <section className="qr-order-board__qr-card">
          {qrSrc ? (
            <img src={qrSrc} alt="Scan to open QR order menu" width={240} height={240} />
          ) : (
            <p className="qr-order-board__empty">Select a company and location to show the QR.</p>
          )}
          <div className="qr-order-board__qr-copy">
            <strong>Customer QR</strong>
            <p>Scan to open the guest menu for this location.</p>
            {joinUrl ? (
              <div className="qr-order-board__actions">
                <button type="button" className="qr-order-board__btn" onClick={() => void copyLink()}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
                <a
                  className="qr-order-board__btn qr-order-board__btn--primary"
                  href={joinUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open guest menu
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section className="qr-order-board__orders" aria-label="Incoming QR orders">
          {error ? <p className="qr-order-board__error">{error}</p> : null}
          {orders.length === 0 ? (
            <p className="qr-order-board__empty">No open QR orders yet. Waiting for guest scans…</p>
          ) : (
            <ul className="qr-order-board__list">
              {orders.map(order => (
                <li key={order.id} className="qr-order-board__order">
                  <header>
                    <strong>{order.tableLabel || 'QR'}</strong>
                    <span>{formatQrOrderTime(order.createdAt)}</span>
                  </header>
                  {order.guestName ? <p className="qr-order-board__guest">{order.guestName}</p> : null}
                  <ul>
                    {order.items.map((item, idx) => (
                      <li key={`${order.id}-${item.productId}-${idx}`}>
                        <span>{item.quantity}</span>
                        <span>
                          {item.name}
                          {item.detail ? <em> · {item.detail}</em> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="qr-order-board__order-actions">
                    <button
                      type="button"
                      className="qr-order-board__btn qr-order-board__btn--primary"
                      disabled={busyId === order.id}
                      onClick={() => void sendToStations(order)}
                    >
                      Send to Bar / Kitchen
                    </button>
                    <button
                      type="button"
                      className="qr-order-board__btn"
                      disabled={busyId === order.id}
                      onClick={() => void dismissOrder(order)}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
