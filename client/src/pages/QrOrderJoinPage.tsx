import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  fetchQrOrderMenu,
  placeQrOrder,
  type PosQrMenuItem,
  type PosQrOrderItem,
} from '../bisync-pos/features/order/domain/qrOrder'
import './QrOrderJoinPage.css'

function readQuery() {
  const params = new URLSearchParams(window.location.search)
  const companyId = Number(params.get('c') || params.get('companyId') || 0)
  const locationId = (params.get('l') || params.get('location') || '').trim()
  const table = (params.get('t') || params.get('table') || '').trim()
  return {
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : 0,
    locationId,
    table,
  }
}

/** Public guest e-menu at /QR — browse POS menu and place an order. */
export function QrOrderJoinPage() {
  const query = useMemo(() => readQuery(), [])
  const [menu, setMenu] = useState<PosQrMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [tableLabel, setTableLabel] = useState(query.table)
  const [cart, setCart] = useState<PosQrOrderItem[]>([])
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<number | null>(null)
  const [category, setCategory] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!query.companyId || !query.locationId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchQrOrderMenu(query.companyId, query.locationId)
        if (!cancelled) setMenu(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load menu.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [query.companyId, query.locationId])

  const categories = useMemo(() => {
    const set = new Set(menu.map(m => m.category.trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [menu])

  const visible = useMemo(() => {
    if (category === 'all') return menu
    return menu.filter(m => m.category.toLowerCase() === category.toLowerCase())
  }, [menu, category])

  const total = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  function addItem(item: PosQrMenuItem) {
    setCart(prev => {
      const existing = prev.find(p => p.productId === item.id && !p.detail)
      if (existing) {
        return prev.map(p =>
          p === existing ? { ...p, quantity: p.quantity + 1 } : p,
        )
      }
      return [
        ...prev,
        {
          productId: item.id,
          name: item.name,
          quantity: 1,
          unitPrice: item.rrp,
          detail: item.category || item.group || '',
        },
      ]
    })
  }

  function bump(productId: number, delta: number) {
    setCart(prev =>
      prev
        .map(p => (p.productId === productId ? { ...p, quantity: p.quantity + delta } : p))
        .filter(p => p.quantity > 0),
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.companyId || !query.locationId) {
      setError('This QR link is missing restaurant details. Ask staff for a new code.')
      return
    }
    if (cart.length === 0) {
      setError('Add at least one item.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row = await placeQrOrder({
        companyId: query.companyId,
        locationExternalId: query.locationId,
        tableLabel: tableLabel.trim() || 'QR',
        guestName: guestName.trim(),
        items: cart,
      })
      setDoneId(row.id)
      setCart([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order.')
    } finally {
      setBusy(false)
    }
  }

  if (!query.companyId || !query.locationId) {
    return (
      <div className="qr-join">
        <div className="qr-join__card">
          <p className="qr-join__code">QR Order</p>
          <h1>Link incomplete</h1>
          <p>Ask staff to show the QR Order code from the POS again.</p>
        </div>
      </div>
    )
  }

  if (doneId != null) {
    return (
      <div className="qr-join">
        <div className="qr-join__card qr-join__card--ok">
          <p className="qr-join__code">Order received</p>
          <h1>#{doneId}</h1>
          <p>Thanks{guestName.trim() ? `, ${guestName.trim()}` : ''}. Staff will prepare your order shortly.</p>
          <button type="button" className="qr-join__cta" onClick={() => setDoneId(null)}>
            Order more
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="qr-join qr-join--menu">
      <header className="qr-join__head">
        <p className="qr-join__code">QR Order</p>
        <h1>Order here</h1>
        <p>Browse the menu and send your order to the restaurant.</p>
      </header>

      <form className="qr-join__meta" onSubmit={e => e.preventDefault()}>
        <label>
          Table
          <input
            value={tableLabel}
            onChange={e => setTableLabel(e.target.value)}
            placeholder="Table number"
            maxLength={64}
          />
        </label>
        <label>
          Name
          <input
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            placeholder="Optional"
            maxLength={120}
          />
        </label>
      </form>

      <div className="qr-join__cats" role="tablist" aria-label="Menu categories">
        <button
          type="button"
          className={category === 'all' ? 'is-active' : undefined}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            className={category === cat ? 'is-active' : undefined}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {error ? <p className="qr-join__error">{error}</p> : null}
      {loading ? <p className="qr-join__hint">Loading menu…</p> : null}

      <div className="qr-join__grid">
        {visible.map(item => (
          <button
            key={item.id}
            type="button"
            className="qr-join__item"
            onClick={() => addItem(item)}
          >
            <span className="qr-join__item-name">{item.name}</span>
            <span className="qr-join__item-meta">
              {item.group || item.category}
              <strong>{item.rrp.toFixed(2)}</strong>
            </span>
          </button>
        ))}
      </div>

      {cart.length > 0 ? (
        <form className="qr-join__cart" onSubmit={e => void onSubmit(e)}>
          <h2>Your order</h2>
          <ul>
            {cart.map(line => (
              <li key={line.productId}>
                <span>{line.name}</span>
                <div className="qr-join__qty">
                  <button type="button" onClick={() => bump(line.productId, -1)} aria-label="Decrease">
                    −
                  </button>
                  <strong>{line.quantity}</strong>
                  <button type="button" onClick={() => bump(line.productId, 1)} aria-label="Increase">
                    +
                  </button>
                </div>
                <em>{(line.quantity * line.unitPrice).toFixed(2)}</em>
              </li>
            ))}
          </ul>
          <div className="qr-join__total">
            <span>Total</span>
            <strong>{total.toFixed(2)}</strong>
          </div>
          <button type="submit" className="qr-join__cta" disabled={busy}>
            {busy ? 'Sending…' : 'Place order'}
          </button>
        </form>
      ) : null}
    </div>
  )
}
