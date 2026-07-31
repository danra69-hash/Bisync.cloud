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

type Screen = 'menu' | 'cart' | 'done'

/** Public guest e-menu at /QR — mobile menu after scanning a table QR. */
export function QrOrderJoinPage() {
  const query = useMemo(() => readQuery(), [])
  const [menu, setMenu] = useState<PosQrMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [tableLabel] = useState(query.table || 'Table')
  const [cart, setCart] = useState<PosQrOrderItem[]>([])
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<number | null>(null)
  const [category, setCategory] = useState('all')
  const [group, setGroup] = useState('all')
  const [screen, setScreen] = useState<Screen>('menu')
  const [toast, setToast] = useState<string | null>(null)

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

  const groups = useMemo(() => {
    const source = category === 'all'
      ? menu
      : menu.filter(m => m.category.toLowerCase() === category.toLowerCase())
    const set = new Set(source.map(m => m.group.trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [menu, category])

  const visible = useMemo(() => {
    return menu.filter(m => {
      if (category !== 'all' && m.category.toLowerCase() !== category.toLowerCase()) return false
      if (group !== 'all' && m.group.toLowerCase() !== group.toLowerCase()) return false
      return true
    })
  }, [menu, category, group])

  const cartCount = cart.reduce((n, i) => n + i.quantity, 0)
  const total = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 1600)
  }

  function addItem(item: PosQrMenuItem) {
    setCart(prev => {
      const existing = prev.find(p => p.productId === item.id)
      if (existing) {
        return prev.map(p =>
          p.productId === item.id ? { ...p, quantity: p.quantity + 1 } : p,
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
    flash(`Added ${item.name}`)
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
      setError('This table QR is missing restaurant details. Ask staff for a new code.')
      return
    }
    if (cart.length === 0) {
      setError('Add at least one item from the menu.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row = await placeQrOrder({
        companyId: query.companyId,
        locationExternalId: query.locationId,
        tableLabel: tableLabel.trim() || 'Table',
        guestName: guestName.trim(),
        items: cart,
      })
      setDoneId(row.id)
      setCart([])
      setScreen('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send order to kitchen.')
    } finally {
      setBusy(false)
    }
  }

  if (!query.companyId || !query.locationId) {
    return (
      <div className="qr-mobile">
        <div className="qr-mobile__shell">
          <div className="qr-mobile__card">
            <p className="qr-mobile__eyebrow">QR Order</p>
            <h1>Invalid table code</h1>
            <p>Ask staff to print or show a fresh table QR for this outlet.</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'done' && doneId != null) {
    return (
      <div className="qr-mobile">
        <div className="qr-mobile__shell qr-mobile__shell--done">
          <div className="qr-mobile__status-bar" aria-hidden>
            <span>9:41</span>
            <span className="qr-mobile__notch" />
            <span>●●●</span>
          </div>
          <div className="qr-mobile__card qr-mobile__card--ok">
            <p className="qr-mobile__eyebrow">Sent to kitchen</p>
            <h1>Order #{doneId}</h1>
            <p>
              {tableLabel ? <strong>{tableLabel}</strong> : null}
              {tableLabel ? ' · ' : null}
              Your order is with the kitchen
              {guestName.trim() ? `, ${guestName.trim()}` : ''}.
            </p>
            <button
              type="button"
              className="qr-mobile__primary"
              onClick={() => {
                setDoneId(null)
                setScreen('menu')
              }}
            >
              Order more
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="qr-mobile">
      <div className="qr-mobile__shell">
        <div className="qr-mobile__status-bar" aria-hidden>
          <span>9:41</span>
          <span className="qr-mobile__notch" />
          <span>●●●</span>
        </div>

        <header className="qr-mobile__head">
          <div>
            <p className="qr-mobile__eyebrow">Table menu</p>
            <h1>{tableLabel || 'Your table'}</h1>
            <p>Browse, add items, then send your order to the kitchen.</p>
          </div>
          <label className="qr-mobile__name">
            Name
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Optional"
              maxLength={120}
            />
          </label>
        </header>

        <div className="qr-mobile__cats" role="tablist" aria-label="Categories">
          <button
            type="button"
            className={category === 'all' ? 'is-active' : undefined}
            onClick={() => {
              setCategory('all')
              setGroup('all')
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={category === cat ? 'is-active' : undefined}
              onClick={() => {
                setCategory(cat)
                setGroup('all')
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {groups.length > 1 ? (
          <div className="qr-mobile__groups" role="tablist" aria-label="Groups">
            <button
              type="button"
              className={group === 'all' ? 'is-active' : undefined}
              onClick={() => setGroup('all')}
            >
              All groups
            </button>
            {groups.map(g => (
              <button
                key={g}
                type="button"
                className={group === g ? 'is-active' : undefined}
                onClick={() => setGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="qr-mobile__error">{error}</p> : null}
        {loading ? <p className="qr-mobile__hint">Loading menu…</p> : null}

        {screen === 'menu' ? (
          <div className="qr-mobile__list">
            {visible.map(item => {
              const qty = cart.find(c => c.productId === item.id)?.quantity ?? 0
              return (
                <article key={item.id} className="qr-mobile__item">
                  <div className="qr-mobile__item-copy">
                    <h2>{item.name}</h2>
                    <p>{item.group || item.category}</p>
                    <strong>{item.rrp.toFixed(2)}</strong>
                  </div>
                  <div className="qr-mobile__item-actions">
                    {qty > 0 ? (
                      <div className="qr-mobile__stepper">
                        <button type="button" onClick={() => bump(item.id, -1)} aria-label="Decrease">
                          −
                        </button>
                        <span>{qty}</span>
                        <button type="button" onClick={() => bump(item.id, 1)} aria-label="Increase">
                          +
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="qr-mobile__add" onClick={() => addItem(item)}>
                        Add
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
            {!loading && visible.length === 0 ? (
              <p className="qr-mobile__hint">No items in this section.</p>
            ) : null}
          </div>
        ) : (
          <form className="qr-mobile__cart-screen" onSubmit={e => void onSubmit(e)}>
            <button type="button" className="qr-mobile__back" onClick={() => setScreen('menu')}>
              ← Back to menu
            </button>
            <h2>Your order</h2>
            <ul>
              {cart.map(line => (
                <li key={line.productId}>
                  <div>
                    <strong>{line.name}</strong>
                    <span>{line.unitPrice.toFixed(2)} each</span>
                  </div>
                  <div className="qr-mobile__stepper">
                    <button type="button" onClick={() => bump(line.productId, -1)} aria-label="Decrease">
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => bump(line.productId, 1)} aria-label="Increase">
                      +
                    </button>
                  </div>
                  <em>{(line.quantity * line.unitPrice).toFixed(2)}</em>
                </li>
              ))}
            </ul>
            <div className="qr-mobile__total">
              <span>Total</span>
              <strong>{total.toFixed(2)}</strong>
            </div>
            <button type="submit" className="qr-mobile__primary" disabled={busy || cart.length === 0}>
              {busy ? 'Sending…' : 'Send to kitchen'}
            </button>
          </form>
        )}

        {screen === 'menu' && cartCount > 0 ? (
          <div className="qr-mobile__dock">
            <button type="button" className="qr-mobile__dock-btn" onClick={() => setScreen('cart')}>
              <span>
                {cartCount} item{cartCount === 1 ? '' : 's'}
              </span>
              <strong>View order · {total.toFixed(2)}</strong>
            </button>
          </div>
        ) : null}

        {toast ? <div className="qr-mobile__toast">{toast}</div> : null}
      </div>
    </div>
  )
}
