import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_PRODUCTS } from '../domain/catalog'
import {
  addToCart,
  addVariableToCart,
  addWeightToCart,
  cartGrandTotal,
  cartSubtotal,
  updateLineSaleDetail,
} from '../domain/cart'
import type { CartLine, OrderCharges, Product, ProductDepartment } from '../domain/types'
import type {
  PosSaleCombinationSelection,
  PosSaleReplacementSelection,
  PosSaleVariableDetail,
} from '../domain/saleDetail'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import { buildDepartmentGroups } from '../../../core/session/mapPosCatalog'
import {
  clearActiveRegisterSession,
  loadActiveRegisterSession,
  loadFloorPlan,
  releaseFloorTable,
  type ActiveRegisterSession,
} from '../../order/domain/tables'
import { persistFloorPlanRemote } from '../../order/domain/floorPlanSync'
import { usePosDutySession } from '../../../core/session/usePosDutySession'
import {
  consumePendingTakeawayRequest,
  POS_TAKEAWAY_REQUEST_EVENT,
  publishPosDiningMode,
} from '../../../core/session/posDiningBridge'
import { api } from '../../../../api'
import { ProductGrid } from './ProductGrid'
import { OrderPanel } from './OrderPanel'
import { HistoryModal } from './HistoryModal'
import { TakeawayPickupModal } from './TakeawayPickupModal'
import { CombinationPickerModal } from './CombinationPickerModal'
import { ComponentSwapModal } from './ComponentSwapModal'
import {
  formatPickupLabel,
  type TakeawayPickup,
} from '../domain/pickupTime'
import './RegisterPage.css'

const EMPTY_CHARGES: OrderCharges = {
  discountCents: 0,
  serviceCents: 0,
  taxRegularCents: 0,
  taxAlcoholCents: 0,
}

export function RegisterPage() {
  const navigate = useNavigate()
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
  const [activeTableSession, setActiveTableSession] = useState<ActiveRegisterSession | null>(
    () => loadActiveRegisterSession(),
  )
  const [table, setTable] = useState(() => loadActiveRegisterSession()?.tableId ?? 't5')
  const [takeawayPickup, setTakeawayPickup] = useState<TakeawayPickup | null>(null)
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const [comboProduct, setComboProduct] = useState<Product | null>(null)
  const [swapTarget, setSwapTarget] = useState<{
    product: Product
    lineKey?: string
    quantity?: number
    pendingWeight?: {
      weight: number
      weightUom: string
      referenceWeightQty: number
    }
    initialSelections?: PosSaleReplacementSelection[]
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [checkNumber] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [cover, setCover] = useState(2)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [charging, setCharging] = useState(false)
  const { duty } = usePosDutySession()

  useEffect(() => {
    function openTakeaway() {
      setPickupModalOpen(true)
    }
    if (consumePendingTakeawayRequest()) openTakeaway()
    function onTakeawayRequest() {
      consumePendingTakeawayRequest()
      openTakeaway()
    }
    window.addEventListener(POS_TAKEAWAY_REQUEST_EVENT, onTakeawayRequest)
    return () => window.removeEventListener(POS_TAKEAWAY_REQUEST_EVENT, onTakeawayRequest)
  }, [])

  useEffect(() => {
    publishPosDiningMode(dining)
  }, [dining])

  useEffect(() => {
    const active = loadActiveRegisterSession()
    setActiveTableSession(active)
    if (active) {
      setDining('dine-in')
      setTable(active.tableId)
    }
  }, [])

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
  const groupColumns = Math.max(1, Math.ceil(groups.length / 2))
  const onDuty = Boolean(duty)

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

  function handleDiningChange(value: string) {
    if (value === 'takeaway') {
      setPickupModalOpen(true)
      return
    }
    setDining(value)
    setTakeawayPickup(null)
  }

  function handlePickupCancel() {
    setPickupModalOpen(false)
  }

  function handlePickupConfirm(pickup: TakeawayPickup) {
    setDining('takeaway')
    setTakeawayPickup(pickup)
    setPickupModalOpen(false)
    flash(formatPickupLabel(pickup))
  }

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2800)
  }

  function requireDuty(): boolean {
    if (onDuty) return true
    flash('Check in and enter your Team PIN to activate POS ordering.')
    return false
  }

  function promptWeightAndAdd(product: Product) {
    const uom = product.weightUom || 'kg'
    const existing = lines.find((l) => {
      if (l.productId !== product.id) return false
      const mode = l.saleDetail?.variableMode
      return mode === 'weight'
        || (mode === 'variableComponent' && (l.saleDetail?.enteredWeight ?? 0) > 0)
    })
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
    const referenceWeightQty = product.weightQty && product.weightQty > 0 ? product.weightQty : 1
    const slots = product.variableComponentSlots ?? []
    if (product.isVariableComponent && slots.length > 0) {
      setSwapTarget({
        product,
        pendingWeight: { weight, weightUom: uom, referenceWeightQty },
      })
      return
    }
    const detail: PosSaleVariableDetail = {
      variableMode: 'weight',
      enteredWeight: weight,
      weightUom: uom,
      referenceWeightQty,
    }
    setLines(prev => addWeightToCart(prev, product.id, weight, detail))
    const totalCents = Math.round(product.priceCents * weight)
    flash(
      `${product.name}: ${weight} ${uom} → ${(totalCents / 100).toFixed(2)}`,
    )
  }

  function promptCombinationAndAdd(product: Product) {
    const options = product.combinationOptions ?? []
    const need = product.choiceQty && product.choiceQty > 0 ? Math.round(product.choiceQty) : 1
    if (options.length === 0 || need <= 0) {
      flash(`${product.name}: no combination options configured.`)
      return
    }
    setComboProduct(product)
  }

  function confirmCombinationPicks(picks: PosSaleCombinationSelection[]) {
    if (!comboProduct) return
    const detail: PosSaleVariableDetail = {
      variableMode: 'combination',
      combinationSelections: picks,
    }
    setLines(prev => addVariableToCart(prev, comboProduct.id, detail, 1))
    flash(`${comboProduct.name}: ${picks.map(p => `${p.quantity}× ${p.productName}`).join(', ')}`)
    setComboProduct(null)
  }

  function promptVariableComponentAndAdd(product: Product) {
    const slots = product.variableComponentSlots ?? []
    if (slots.length === 0) {
      flash(`${product.name}: no Variable Component substitutes configured.`)
      return
    }
    setSwapTarget({ product })
  }

  function confirmComponentSwap(selections: PosSaleReplacementSelection[]) {
    if (!swapTarget) return
    const { product, lineKey, quantity, pendingWeight } = swapTarget
    const detail: PosSaleVariableDetail = {
      variableMode: 'variableComponent',
      replacementSelections: selections,
      ...(pendingWeight
        ? {
            enteredWeight: pendingWeight.weight,
            weightUom: pendingWeight.weightUom,
            referenceWeightQty: pendingWeight.referenceWeightQty,
          }
        : {}),
    }
    if (lineKey) {
      setLines(prev => updateLineSaleDetail(prev, lineKey, product.id, detail))
    } else if (pendingWeight) {
      setLines(prev => addWeightToCart(prev, product.id, pendingWeight.weight, detail))
    } else {
      setLines(prev => addVariableToCart(prev, product.id, detail, quantity && quantity > 0 ? quantity : 1))
    }
    flash(
      `${product.name}: ${selections
        .map(s =>
          s.chosenComponentId === s.baseComponentId
            ? s.baseComponentName
            : `${s.baseComponentName} → ${s.chosenComponentName}${
              s.extraCharge && s.extraCharge > 0 ? ` (+${s.extraCharge.toFixed(2)})` : ''
            }`,
        )
        .join(', ')}`,
    )
    setSwapTarget(null)
  }

  function addProduct(product: Product) {
    if (!requireDuty()) return
    if (product.pricedByWeight || product.variableMode === 'weight') {
      promptWeightAndAdd(product)
      return
    }
    if (product.variableMode === 'combination') {
      promptCombinationAndAdd(product)
      return
    }
    if (product.isVariableComponent && (product.variableComponentSlots?.length ?? 0) > 0) {
      promptVariableComponentAndAdd(product)
      return
    }
    setLines(prev => addToCart(prev, product.id))
  }

  function handleSwapLine(line: CartLine) {
    const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
    const product = products.find(p => p.id === line.productId)
    if (!product?.isVariableComponent || !(product.variableComponentSlots?.length)) {
      flash('This line has no Variable Component swaps.')
      return
    }
    const pendingWeight = line.saleDetail?.enteredWeight && line.saleDetail.enteredWeight > 0
      ? {
          weight: line.saleDetail.enteredWeight,
          weightUom: line.saleDetail.weightUom || product.weightUom || 'kg',
          referenceWeightQty: line.saleDetail.referenceWeightQty
            && line.saleDetail.referenceWeightQty > 0
            ? line.saleDetail.referenceWeightQty
            : (product.weightQty && product.weightQty > 0 ? product.weightQty : 1),
        }
      : undefined
    setSwapTarget({
      product,
      lineKey: line.lineKey,
      quantity: line.quantity,
      pendingWeight,
      initialSelections: line.saleDetail?.replacementSelections,
    })
  }

  function handleCancelTable() {
    if (lines.length > 0) {
      flash('Remove order items before cancelling the table.')
      return
    }
    if (!activeTableSession) {
      flash('No opened table to cancel.')
      return
    }
    const released = releaseFloorTable(activeTableSession.tableId)
    if (session?.companyId && session.locationId) {
      void persistFloorPlanRemote(loadFloorPlan(), session.companyId, session.locationId)
    }
    clearActiveRegisterSession()
    setActiveTableSession(null)
    setCharges(EMPTY_CHARGES)
    flash(
      released
        ? `Table ${activeTableSession.tableLabel} released`
        : `Table ${activeTableSession.tableLabel} cancelled`,
    )
    navigate('/order/floor')
  }

  async function chargePayment() {
    if (!requireDuty()) return
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
        const detail = line.saleDetail
        await api.recordProductSale(productId, {
          locationExternalIds: [session.locationId],
          quantitySold: line.quantity,
          salesChannel: 'pos',
          variableDetail: detail
            ? {
                variableMode: detail.variableMode,
                enteredWeight: detail.enteredWeight,
                weightUom: detail.weightUom,
                referenceWeightQty: detail.referenceWeightQty,
                combinationSelections: detail.combinationSelections,
                replacementSelections: detail.replacementSelections,
              }
            : undefined,
        })
      }
      const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
      const grossCents = cartSubtotal(lines, products)
      const grandCents = cartGrandTotal(lines, products, charges)
      try {
        await api.posRecordClosedCheck({
          companyId: session.companyId,
          locationExternalId: session.locationId,
          covers: 1,
          discountCents: charges.discountCents,
          taxCents: charges.taxRegularCents + charges.taxAlcoholCents,
          grossCents,
          paymentMethod: 'cash',
          paymentAmountCents: grandCents,
          checkLabel: 'POS Register',
        })
      } catch {
        /* inventory sale already recorded; EOD row is best-effort */
      }
      const count = lines.reduce((n, l) => n + l.quantity, 0)
      setLines([])
      setCharges(EMPTY_CHARGES)
      clearActiveRegisterSession()
      setActiveTableSession(null)
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

        <div
          className="register__tabs"
          role="tablist"
          aria-label="Groups"
          style={{ gridTemplateColumns: `repeat(${groupColumns}, minmax(0, 1fr))` }}
        >
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

        {!onDuty ? (
          <p className="register__duty-banner" role="status">
            Use Check in/out: scan with Team (/TEAM), then enter your Team PIN to unlock ordering.
          </p>
        ) : (
          <p className="register__duty-banner is-on" role="status">
            On duty: {duty?.employeeName} — POS stays open until check out
          </p>
        )}

        <div className="register__grid-scroll">
          <ProductGrid
            products={filtered}
            onAdd={addProduct}
            disabled={!onDuty}
          />
        </div>
      </div>

      <OrderPanel
        checkNumber={checkNumber}
        cover={cover}
        lines={lines}
        products={catalogForFilter}
        charges={charges}
        dining={dining}
        table={table}
        pickupLabel={dining === 'takeaway' ? formatPickupLabel(takeawayPickup) : undefined}
        onDiningChange={handleDiningChange}
        onTableChange={setTable}
        onCoverChange={setCover}
        onChange={setLines}
        onChargesChange={setCharges}
        onSwapLine={handleSwapLine}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPickup={() => {
          if (dining === 'takeaway') setPickupModalOpen(true)
        }}
        activeTableLabel={activeTableSession?.tableLabel ?? null}
        onAction={action => {
          if (!requireDuty()) return
          if (action === 'cancel') {
            handleCancelTable()
            return
          }
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
      {pickupModalOpen && (
        <TakeawayPickupModal
          onCancel={handlePickupCancel}
          onConfirm={handlePickupConfirm}
        />
      )}
      {comboProduct && (
        <CombinationPickerModal
          productName={comboProduct.name}
          choiceQty={comboProduct.choiceQty && comboProduct.choiceQty > 0
            ? Math.round(comboProduct.choiceQty)
            : 1}
          options={comboProduct.combinationOptions ?? []}
          onCancel={() => setComboProduct(null)}
          onConfirm={confirmCombinationPicks}
        />
      )}
      {swapTarget && (
        <ComponentSwapModal
          productName={swapTarget.product.name}
          slots={swapTarget.product.variableComponentSlots ?? []}
          initialSelections={swapTarget.initialSelections}
          onCancel={() => setSwapTarget(null)}
          onConfirm={confirmComponentSwap}
        />
      )}

      {toast && (
        <div className="register__toast" role="status">
          {charging ? 'Recording sale…' : toast}
        </div>
      )}
    </div>
  )
}
