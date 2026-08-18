import { useEffect, useMemo, useState } from 'react'
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

function productInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function Photo({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return (
      <img
        className="qr-menu__photo"
        src={imageUrl}
        alt=""
        loading="lazy"
      />
    )
  }
  return (
    <div className="qr-menu__photo qr-menu__photo--placeholder" aria-hidden>
      <span>{productInitials(name)}</span>
    </div>
  )
}

/** Public guest e-menu at /QR — mobile menu after scanning a table QR. */
export function QrOrderJoinPage() {
  const query = useMemo(() => readQuery(), [])
  const [menu, setMenu] = useState<PosQrMenuItem[]>([])
  const [locationName, setLocationName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tableLabel] = useState(query.table || 'Table')
  const [cart, setCart] = useState<PosQrOrderItem[]>([])
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<number | null>(null)
  const [category, setCategory] = useState('')
  const [group, setGroup] = useState('')
  const [screen, setScreen] = useState<Screen>('menu')

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
        const payload = await fetchQrOrderMenu(query.companyId, query.locationId)
        if (cancelled) return
        setMenu(payload.items)
        setLocationName(payload.locationName || query.locationId)
        const cats = [...new Set(payload.items.map(m => m.category.trim()).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b))
        setCategory(cats[0] ?? '')
        setGroup('')
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
    const source = category
      ? menu.filter(m => m.category.toLowerCase() === category.toLowerCase())
      : menu
    const set = new Set(source.map(m => m.group.trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [menu, category])

  useEffect(() => {
    if (group && !groups.some(g => g.toLowerCase() === group.toLowerCase())) {
      setGroup('')
    }
  }, [groups, group])

  const visible = useMemo(() => {
    return menu.filter(m => {
      if (category && m.category.toLowerCase() !== category.toLowerCase()) return false
      if (group && m.group.toLowerCase() !== group.toLowerCase()) return false
      return true
    })
  }, [menu, category, group])

  const cartCount = cart.reduce((n, i) => n + i.quantity, 0)
  const total = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)

  function qtyFor(productId: number): number {
    return cart.find(c => c.productId === productId)?.quantity ?? 0
  }

  function bump(item: PosQrMenuItem, delta: number) {
    setCart(prev => {
      const existing = prev.find(p => p.productId === item.id)
      if (!existing) {
        if (delta <= 0) return prev
        return [
          ...prev,
          {
            productId: item.id,
            name: item.name,
            quantity: 1,
            unitPrice: item.rrp,
            detail: item.group || item.category || '',
          },
        ]
      }
      const nextQty = existing.quantity + delta
      if (nextQty <= 0) return prev.filter(p => p.productId !== item.id)
      return prev.map(p => (p.productId === item.id ? { ...p, quantity: nextQty } : p))
    })
  }

  function bumpCartLine(productId: number, delta: number) {
    setCart(prev =>
      prev
        .map(p => (p.productId === productId ? { ...p, quantity: p.quantity + delta } : p))
        .filter(p => p.quantity > 0),
    )
  }

  async function confirmOrder() {
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
        items: cart,
      })
      setDoneId(row.id)
      setCart([])
      setScreen('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order.')
    } finally {
      setBusy(false)
    }
  }

  if (!query.companyId || !query.locationId) {
    return (
      <div className="qr-menu">
        <div className="qr-menu__shell">
          <div className="qr-menu__empty-card">
            <h1>Invalid table code</h1>
            <p>Ask staff to print or show a fresh table QR for this outlet.</p>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'done' && doneId != null) {
    return (
      <div className="qr-menu">
        <div className="qr-menu__shell qr-menu__shell--done">
          <div className="qr-menu__empty-card qr-menu__empty-card--ok">
            <p className="qr-menu__eyebrow">Order received</p>
            <h1>Order #{doneId}</h1>
            <p>
              <strong>{locationName}</strong>
              {tableLabel ? ` · ${tableLabel}` : ''}
            </p>
            <p>Staff will review and confirm your order.</p>
            <button
              type="button"
              className="qr-menu__confirm"
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
    <div className="qr-menu">
      <div className={`qr-menu__shell${screen === 'cart' ? ' is-cart' : ''}`}>
        <header className="qr-menu__top">
          <div className="qr-menu__brand">
            <h1>{locationName || 'Menu'}</h1>
            <p>{tableLabel}</p>
          </div>
          <button
            type="button"
            className="qr-menu__cart-btn"
            onClick={() => setScreen(screen === 'cart' ? 'menu' : 'cart')}
            aria-label={screen === 'cart' ? 'Back to menu' : `Shopping cart, ${cartCount} items`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M6 6h15l-1.5 9h-12z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1.25" />
              <circle cx="18" cy="20" r="1.25" />
            </svg>
            {cartCount > 0 ? <span className="qr-menu__cart-badge">{cartCount}</span> : null}
          </button>
        </header>

        {screen === 'menu' ? (
          <>
            <div className="qr-menu__cats" role="tablist" aria-label="Categories">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  className={category === cat ? 'is-active' : undefined}
                  onClick={() => {
                    setCategory(cat)
                    setGroup('')
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {groups.length > 0 ? (
              <div className="qr-menu__groups" role="tablist" aria-label="Groups">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!group}
                  className={!group ? 'is-active' : undefined}
                  onClick={() => setGroup('')}
                >
                  All
                </button>
                {groups.map(g => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={group === g}
                    className={group === g ? 'is-active' : undefined}
                    onClick={() => setGroup(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? <p className="qr-menu__error">{error}</p> : null}
            {loading ? <p className="qr-menu__hint">Loading menu…</p> : null}

            <div className="qr-menu__list" role="list">
              {visible.map(item => {
                const qty = qtyFor(item.id)
                return (
                  <article key={item.id} className="qr-menu__item" role="listitem">
                    <button
                      type="button"
                      className="qr-menu__item-main"
                      onClick={() => bump(item, 1)}
                      aria-label={`Add ${item.name}`}
                    >
                      <Photo name={item.name} imageUrl={item.imageUrl} />
                      <div className="qr-menu__item-copy">
                        <h2>{item.name}</h2>
                        <strong>{item.rrp.toFixed(2)}</strong>
                      </div>
                      <span className="qr-menu__qty" aria-live="polite">
                        {qty}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="qr-menu__qty-down"
                      disabled={qty <= 0}
                      onClick={() => bump(item, -1)}
                      aria-label={`Reduce ${item.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </article>
                )
              })}
              {!loading && visible.length === 0 ? (
                <p className="qr-menu__hint">No items in this section.</p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="qr-menu__cart">
            <div className="qr-menu__cart-head">
              <button type="button" className="qr-menu__back" onClick={() => setScreen('menu')}>
                ← Menu
              </button>
              <h2>Your order</h2>
            </div>

            {error ? <p className="qr-menu__error">{error}</p> : null}

            {cart.length === 0 ? (
              <p className="qr-menu__hint">Your cart is empty. Tap products on the menu to add them.</p>
            ) : (
              <ul className="qr-menu__cart-list">
                {cart.map(line => {
                  const menuItem = menu.find(m => m.id === line.productId)
                  return (
                    <li key={line.productId}>
                      <Photo name={line.name} imageUrl={menuItem?.imageUrl} />
                      <div className="qr-menu__cart-copy">
                        <strong>{line.name}</strong>
                        <span>{line.unitPrice.toFixed(2)} each</span>
                      </div>
                      <div className="qr-menu__cart-qty">
                        <button
                          type="button"
                          className="qr-menu__qty-down"
                          onClick={() => bumpCartLine(line.productId, -1)}
                          aria-label={`Reduce ${line.name}${line.quantity <= 1 ? ' (removes item)' : ''}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="qr-menu__cart-qty-value"
                          onClick={() => bumpCartLine(line.productId, 1)}
                          aria-label={`Add ${line.name}`}
                        >
                          {line.quantity}
                        </button>
                      </div>
                      <em>{(line.quantity * line.unitPrice).toFixed(2)}</em>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="qr-menu__cart-footer">
              <div className="qr-menu__total">
                <span>Total</span>
                <strong>{total.toFixed(2)}</strong>
              </div>
              <button
                type="button"
                className="qr-menu__confirm"
                disabled={busy || cart.length === 0}
                onClick={() => void confirmOrder()}
              >
                {busy ? 'Sending…' : 'Confirm Order'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
