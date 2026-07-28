import { useMemo, useState } from 'react'
import {
  DEPARTMENTS,
  GROUPS_BY_DEPARTMENT,
  MOCK_PRODUCTS,
} from '../domain/catalog'
import { addToCart } from '../domain/cart'
import type { CartLine, OrderCharges, ProductDepartment } from '../domain/types'
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
  const [lines, setLines] = useState<CartLine[]>([
    { productId: 'p3', quantity: 2 },
    { productId: 'p1', quantity: 1 },
  ])
  const [charges, setCharges] = useState<OrderCharges>(EMPTY_CHARGES)
  const [productQuery, setProductQuery] = useState('')
  const [department, setDepartment] = useState<ProductDepartment>('Food')
  const [group, setGroup] = useState(GROUPS_BY_DEPARTMENT.Food[0])
  const [dining, setDining] = useState('dine-in')
  const [table, setTable] = useState('t5')
  const [toast, setToast] = useState<string | null>(null)
  const [checkNumber] = useState(20)
  const [cover, setCover] = useState(2)
  const [historyOpen, setHistoryOpen] = useState(false)

  const groups = GROUPS_BY_DEPARTMENT[department]

  const filtered = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    return MOCK_PRODUCTS.filter((p) => {
      if (p.department !== department) return false
      if (p.group !== group) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      )
    })
  }, [productQuery, department, group])

  function selectDepartment(next: ProductDepartment) {
    setDepartment(next)
    setGroup(GROUPS_BY_DEPARTMENT[next][0])
  }

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }

  return (
    <div className="register">
      <div className="register__catalog">
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
              onChange={(e) => setProductQuery(e.target.value)}
            />
          </label>
          <div className="register__departments" role="tablist" aria-label="Departments">
            {DEPARTMENTS.map((d) => (
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
          {groups.map((g) => (
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
          onAdd={(product) => setLines((prev) => addToCart(prev, product.id))}
        />
      </div>

      <OrderPanel
        checkNumber={checkNumber}
        cover={cover}
        lines={lines}
        products={MOCK_PRODUCTS}
        charges={charges}
        dining={dining}
        table={table}
        onDiningChange={setDining}
        onTableChange={setTable}
        onCoverChange={setCover}
        onChange={setLines}
        onChargesChange={setCharges}
        onOpenHistory={() => setHistoryOpen(true)}
        onAction={(action) => {
          const labels = {
            save: 'Order saved',
            print: 'Printing…',
            payment: 'Opening payment…',
          } as const
          flash(labels[action])
          if (action === 'payment') {
            setLines([])
            setCharges(EMPTY_CHARGES)
          }
        }}
      />

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}

      {toast && (
        <div className="register__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
