import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import {
  cancelQrOrder,
  fetchOpenQrOrders,
  formatQrOrderTime,
  notifyQrOrderChanged,
  buildQrOrderUrl,
  qrOrderImageUrl,
  QR_ORDER_CHANGED_EVENT,
  type PosQrOrder,
} from '../../order/domain/qrOrder'
import { acceptQrOrderToStations } from '../../order/domain/qrOrderStations'
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
  const [demoTable, setDemoTable] = useState('T5')

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

  async function acceptOrder(order: PosQrOrder) {
    if (busyId != null) return
    setBusyId(order.id)
    try {
      const result = await acceptQrOrderToStations(order)
      if (!result.ok) {
        setError(result.error || 'Could not accept order.')
        return
      }
      notifyQrOrderChanged()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept order.')
    } finally {
      setBusyId(null)
    }
  }

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
            New orders pop up on the main POS screen for Accept before Bar / Kitchen.
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
            <p>Print or place this code on the table. Guests browse and place orders for staff review.</p>
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
              No open guest orders. When a guest submits, the order appears here and as a popup
              on the main screen for Accept before kitchen / bar.
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
                      onClick={() => void acceptOrder(order)}
                    >
                      Accept → Bar / Kitchen
                    </button>
                    <button
                      type="button"
                      className="qr-order-board__btn"
                      disabled={busyId === order.id}
                      onClick={() => void dismissOrder(order)}
                    >
                      Reject
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
