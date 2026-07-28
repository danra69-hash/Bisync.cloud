import { useEffect, useMemo, useState } from 'react'
import { MOCK_PRODUCTS } from '../domain/catalog'
import { addToCart, addWeightToCart } from '../domain/cart'
import type { CartLine, OrderCharges, Product, ProductDepartment } from '../domain/types'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import { buildDepartmentGroups } from '../../../core/session/mapPosCatalog'
import { api } from '../../../../api'
import { ProductGrid } from './ProductGrid'
import { OrderPanel } from './OrderPanel'
import { HistoryModal } from './HistoryModal'
import './RegisterPage.css'

const EMPTY_CHARGES: OrderCharges = {
  discountCents: 0,
  serviceCents: 0,
  taxRegularCents: 0,
  taxAlcoholCents: 0,
}

export function RegisterPage() {
  const session = usePosSessionOptional()
  const liveCatalog = session?.catalog ?? []

  const { departments, groupsByDepartment } = useMemo(() => {
    if (session) {
      const built = buildDepartmentGroups(liveCatalog)
      if (built.departments.length > 0) return built
    }
    return {
      departments: ['Food', 'Beverage', 'Retail'] as ProductDepartment[],
      groupsByDepartment: {
        Food: ['Rice', 'Salads', 'Soup', 'Pizza'],
        Beverage: ['Coffee', 'Soft Drinks', 'Juice'],
        Retail: ['Merchandise', 'To-Go'],
      } satisfies Record<ProductDepartment, string[]>,
    }
  }, [liveCatalog, session])

  const [lines, setLines] = useState<CartLine[]>([])
  const [charges, setCharges] = useState<OrderCharges>(EMPTY_CHARGES)
  const [productQuery, setProductQuery] = useState('')
  const initialDept = (departments[0] ?? 'Food') as ProductDepartment
  const [department, setDepartment] = useState<ProductDepartment>(initialDept)
  const [group, setGroup] = useState(() => {
    const groups = groupsByDepartment[initialDept]
    return groups?.[0] ?? ''
  })
  const [dining, setDining] = useState('dine-in')
  const [table, setTable] = useState('t5')
  const [toast, setToast] = useState<string | null>(null)
  const [checkNumber] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [cover, setCover] = useState(2)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [charging, setCharging] = useState(false)

  useEffect(() => {
    if (!departments.includes(department)) {
      const nextDept = departments[0] ?? 'Food'
      setDepartment(nextDept)
      setGroup(groupsByDepartment[nextDept]?.[0] ?? '')
      return
    }
    const groups = groupsByDepartment[department] ?? []
    if (groups.length > 0 && !groups.includes(group)) {
      setGroup(groups[0])
    }
  }, [departments, groupsByDepartment, department, group])

  const groups = groupsByDepartment[department] ?? []

  const catalogForFilter = session ? liveCatalog : MOCK_PRODUCTS

  const filtered = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    return catalogForFilter.filter(p => {
      if (p.department !== department) return false
      if (group && p.group !== group) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q)
        || p.sku.toLowerCase().includes(q)
        || p.group.toLowerCase().includes(q)
      )
    })
  }, [catalogForFilter, productQuery, department, group])

  function selectDepartment(next: ProductDepartment) {
    setDepartment(next)
    setGroup(groupsByDepartment[next]?.[0] ?? '')
  }

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }

  function promptWeightAndAdd(product: Product) {
    const uom = product.weightUom || 'kg'
    const existing = lines.find(l => l.productId === product.id)
    const raw = window.prompt(
      `Enter weight (${uom}) for ${product.name}`,
      existing ? String(existing.quantity) : '',
    )
    if (raw == null) return
    const weight = Number(raw)
    if (!Number.isFinite(weight) || weight <= 0) {
      flash(`Enter a weight greater than zero (${uom}).`)
      return
    }
    setLines(prev => addWeightToCart(prev, product.id, weight))
    const totalCents = Math.round(product.priceCents * weight)
    flash(
      `${product.name}: ${weight} ${uom} → ${(totalCents / 100).toFixed(2)}`,
    )
  }

  async function chargePayment() {
    if (!session) {
      flash('Opening payment…')
      setLines([])
      setCharges(EMPTY_CHARGES)
      return
    }
    if (lines.length === 0 || charging) return
    setCharging(true)
    try {
      for (const line of lines) {
        const productId = Number(line.productId)
        if (!Number.isFinite(productId) || productId <= 0) continue
        await api.recordProductSale(productId, {
          locationExternalIds: [session.locationId],
          quantitySold: line.quantity,
          salesChannel: 'pos',
        })
      }
      const count = lines.reduce((n, l) => n + l.quantity, 0)
      setLines([])
      setCharges(EMPTY_CHARGES)
      flash(`POS sale recorded · ${count} item${count === 1 ? '' : 's'}`)
      session.refreshCatalog()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setCharging(false)
    }
  }

  return (
    <div className="register">
      <div className="register__catalog">
        {session?.catalogLoading ? (
          <p className="product-grid__empty">Loading live POS menu…</p>
        ) : null}
        {session?.catalogError ? (
          <p className="product-grid__empty">{session.catalogError}</p>
        ) : null}
        {!session?.catalogLoading && session && liveCatalog.length === 0 ? (
          <p className="product-grid__empty">
            No POS products with RRP for this company. Enable B2C products with RRP under Products.
          </p>
        ) : null}

        <div className="register__filters">
          <label className="register__product-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Search in products"
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
            />
          </label>
          <div className="register__departments" role="tablist" aria-label="Departments">
            {departments.map(d => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={department === d}
                className={`register__department${department === d ? ' is-active' : ''}`}
                onClick={() => selectDepartment(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="register__tabs" role="tablist" aria-label="Groups">
          {groups.map(g => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={group === g}
              className={`register__tab${group === g ? ' is-active' : ''}`}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>

        <ProductGrid
          products={filtered}
          onAdd={product => {
            if (product.pricedByWeight) {
              promptWeightAndAdd(product)
              return
            }
            setLines(prev => addToCart(prev, product.id))
          }}
        />
      </div>

      <OrderPanel
        checkNumber={checkNumber}
        cover={cover}
        lines={lines}
        products={catalogForFilter}
        charges={charges}
        dining={dining}
        table={table}
        onDiningChange={setDining}
        onTableChange={setTable}
        onCoverChange={setCover}
        onChange={setLines}
        onChargesChange={setCharges}
        onOpenHistory={() => setHistoryOpen(true)}
        onAction={action => {
          if (action === 'payment') {
            void chargePayment()
            return
          }
          const labels = {
            save: 'Order saved',
            print: 'Printing…',
            payment: 'Opening payment…',
          } as const
          flash(labels[action])
        }}
      />

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}

      {toast && (
        <div className="register__toast" role="status">
          {charging ? 'Recording sale…' : toast}
        </div>
      )}
    </div>
  )
}
