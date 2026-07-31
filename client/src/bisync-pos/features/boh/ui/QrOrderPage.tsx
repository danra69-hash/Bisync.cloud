import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function orderToStationPayload(order: PosQrOrder): { products: Product[]; lines: CartLine[] } {
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
  return { products, lines }
}

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
  const [demoTable, setDemoTable] = useState('T5')
  const [autoSentIds, setAutoSentIds] = useState<Set<number>>(() => new Set())
  const autoSentRef = useRef<Set<number>>(new Set())

  const joinUrl = useMemo(
    () => (companyId > 0 && locationId ? buildQrOrderUrl(companyId, locationId, demoTable) : ''),
    [companyId, locationId, demoTable],
  )
  const qrSrc = useMemo(
    () => (companyId > 0 && locationId ? qrOrderImageUrl(companyId, locationId, 200, demoTable) : ''),
    [companyId, locationId, demoTable],
  )
  const previewUrl = joinUrl

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
    const poll = window.setInterval(() => void refresh(), 4000)
    return () => {
      window.removeEventListener(QR_ORDER_CHANGED_EVENT, onChange)
      window.removeEventListener('storage', onChange)
      window.clearInterval(poll)
    }
  }, [refresh])

  const sendToStations = useCallback(async (order: PosQrOrder, opts?: { silent?: boolean }) => {
    if (busyId != null && !opts?.silent) return
    if (!opts?.silent) setBusyId(order.id)
    try {
      const { products, lines } = orderToStationPayload(order)
      const tickets = fireCartToStations({
        lines,
        products,
        checkNumber: 9000 + (order.id % 900),
        tableLabel: order.tableLabel || 'QR',
        dining: 'dine-in',
      })
      if (tickets.length === 0) {
        if (!opts?.silent) setError('Nothing to send to Bar or Kitchen for this order.')
        return false
      }
      await markQrOrderSent(order.id)
      notifyQrOrderChanged()
      await refresh()
      return true
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : 'Could not send order.')
      return false
    } finally {
      if (!opts?.silent) setBusyId(null)
    }
  }, [busyId, refresh])

  // Auto-route new guest orders to Bar/Kitchen while this board is open.
  useEffect(() => {
    let cancelled = false
    async function autoSend() {
      for (const order of orders) {
        if (autoSentRef.current.has(order.id)) continue
        autoSentRef.current.add(order.id)
        setAutoSentIds(new Set(autoSentRef.current))
        const ok = await sendToStations(order, { silent: true })
        if (!ok && !cancelled) {
          autoSentRef.current.delete(order.id)
          setAutoSentIds(new Set(autoSentRef.current))
        }
      }
    }
    void autoSend()
    return () => {
      cancelled = true
    }
  }, [orders, sendToStations])

  async function copyLink() {
    if (!joinUrl) return
    try {
      await navigator.clipboard?.writeText(joinUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy guest menu link', joinUrl)
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
          <h1>Customer mobile menu</h1>
          <p className="qr-order-board__sub">
            Guests scan the table QR and order on their phone at <strong>{locationName}</strong>.
            New orders auto-send to Bar / Kitchen while this board is open.
          </p>
        </div>
        <div className="qr-order-board__count" aria-live="polite">
          <strong>{orders.length}</strong>
          <span>{orders.length === 1 ? 'open order' : 'open orders'}</span>
        </div>
      </header>

      <div className="qr-order-board__layout qr-order-board__layout--preview">
        <section className="qr-order-board__qr-card">
          <label className="qr-order-board__demo-table">
            Demo table
            <input
              value={demoTable}
              onChange={e => setDemoTable(e.target.value)}
              maxLength={24}
              aria-label="Demo table label for guest QR"
            />
          </label>
          {qrSrc ? (
            <img src={qrSrc} alt="Table QR for guest menu" width={200} height={200} />
          ) : (
            <p className="qr-order-board__empty">Select a company and location to show the QR.</p>
          )}
          <div className="qr-order-board__qr-copy">
            <strong>Table QR → mobile menu</strong>
            <p>Print or place this code on the table. Guests browse, order, and send to kitchen.</p>
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
                  Open on phone
                </a>
              </div>
            ) : null}
          </div>
        </section>

        <section className="qr-order-board__phone" aria-label="Mobile guest menu preview">
          <div className="qr-order-board__phone-frame">
            <div className="qr-order-board__phone-notch" aria-hidden />
            {previewUrl ? (
              <iframe
                title="Guest mobile menu preview"
                src={previewUrl}
                className="qr-order-board__phone-screen"
              />
            ) : (
              <div className="qr-order-board__phone-empty">
                Select location to preview the guest phone menu.
              </div>
            )}
          </div>
          <p className="qr-order-board__phone-caption">
            Live preview — how customers see the menu on their phone after scanning the table code.
          </p>
        </section>

        <section className="qr-order-board__orders" aria-label="Incoming QR orders">
          {error ? <p className="qr-order-board__error">{error}</p> : null}
          {orders.length === 0 ? (
            <p className="qr-order-board__empty">
              No open guest orders. Scan the preview QR on a phone, add items, tap
              <strong> Send to kitchen</strong>.
            </p>
          ) : (
            <ul className="qr-order-board__list">
              {orders.map(order => (
                <li key={order.id} className="qr-order-board__order">
                  <header>
                    <strong>{order.tableLabel || 'QR'}</strong>
                    <span>{formatQrOrderTime(order.createdAt)}</span>
                  </header>
                  {order.guestName ? <p className="qr-order-board__guest">{order.guestName}</p> : null}
                  {autoSentIds.has(order.id) ? (
                    <p className="qr-order-board__guest">Sending to Bar / Kitchen…</p>
                  ) : null}
                  <ul>
                    {order.items.map((item, idx) => (
                      <li key={`${order.id}-${item.productId}-${idx}`}>
                        <span>{item.quantity}</span>
                        <span>{item.name}</span>
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
