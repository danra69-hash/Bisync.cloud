import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_PRODUCTS } from '../domain/catalog'
import {
  addToCart,
  addVariableToCart,
  addWeightToCart,
  cartGrandTotal,
  cartSubtotal,
  removeLine,
  setLineNote,
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
  markFloorTableOrdered,
  releaseFloorTable,
  type ActiveRegisterSession,
} from '../../order/domain/tables'
import { persistFloorTablePatch } from '../../order/domain/floorPlanSync'
import { fireCartToStations, notifyStationsLineRemoved } from '../../boh/domain/kitchenTickets'
import {
  clearCustomerDisplaySnapshot,
  publishCustomerDisplaySnapshot,
} from '../../boh/domain/customerDisplay'
import { saleDetailExtraChargeCents } from '../domain/saleDetail'
import { MODE_META } from '../../../core/modes/types'
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
import { ModifierPickerModal } from './ModifierPickerModal'
import { VoidCancelModal } from './VoidCancelModal'
import { PaymentModal } from './PaymentModal'
import { CompulsoryModifierModal } from './CompulsoryModifierModal'
import type { TenderType } from '../../cashier/domain/payments'
import { TENDER_LABEL } from '../../cashier/domain/payments'
import type { PosModifierGroup } from '../../../../api'
import {
  resolveRequiredModifierGroups,
  resolveToolbarModifierGroups,
} from '../../../../data/posModifierGroups'
import {
  formatPickupLabel,
  type TakeawayPickup,
} from '../domain/pickupTime'
import {
  EMPTY_OPEN_CHARGES,
  lineIdentity,
  loadOpenCheckForTable,
  mergeFiredAtByLine,
  minutesSinceFire,
  recoverOpenCheckFromKitchen,
  removalModeForFireAge,
  removeOpenCheckForTable,
  takeUnfiredLines,
  upsertOpenCheck,
  type OpenCheck,
} from '../domain/openChecks'
import { appendPosLineAudit } from '../domain/posLineAudit'
import { authorizeVoidPin } from '../domain/voidPermission'
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
  const [selectedLineKey, setSelectedLineKey] = useState<string | null>(null)
  const [modifierTarget, setModifierTarget] = useState<{
    kind: 'food' | 'beverage'
    line: CartLine
    product: Product
  } | null>(null)
  const [checkNumber, setCheckNumber] = useState(() => Math.floor(1000 + Math.random() * 9000))
  const [firedQtyByLine, setFiredQtyByLine] = useState<Record<string, number>>({})
  const [firedAtByLine, setFiredAtByLine] = useState<Record<string, string>>({})
  const [removalTarget, setRemovalTarget] = useState<{
    line: CartLine
    product: Product
    mode: 'cancel' | 'void'
    minutesSinceFire: number
  } | null>(null)
  const [removalBusy, setRemovalBusy] = useState(false)
  const [removalError, setRemovalError] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [modifierGroups, setModifierGroups] = useState<PosModifierGroup[]>([])
  const [compulsoryFlow, setCompulsoryFlow] = useState<{
    product: Product
    groups: PosModifierGroup[]
    index: number
    selectedLabels: string[]
  } | null>(null)
  const [cover, setCover] = useState(2)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [charging, setCharging] = useState(false)
  const hydratedTableIdRef = useRef<string | null>(null)
  const pendingCompulsoryLabelsRef = useRef<string[]>([])
  const { duty, orderingLocked } = usePosDutySession()

  useEffect(() => {
    if (!session?.companyId) {
      setModifierGroups([])
      return
    }
    let cancelled = false
    api.posModifierGroups(session.companyId)
      .then(rows => {
        if (!cancelled) setModifierGroups(rows)
      })
      .catch(() => {
        if (!cancelled) setModifierGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [session?.companyId])

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
    if (!active) return

    setDining('dine-in')
    setTable(active.tableId)
    if (hydratedTableIdRef.current === active.tableId) return

    let check = loadOpenCheckForTable(active.tableId)
    if (!check) {
      const floorTable = loadFloorPlan().tables.find(t => t.id === active.tableId)
      if (floorTable?.orderId) {
        // Wait for live catalog so KDS name matching can resolve real products.
        if (session && liveCatalog.length === 0) return
        const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
        check = recoverOpenCheckFromKitchen(
          active.tableId,
          active.tableLabel,
          floorTable.orderId,
          products,
        )
      }
    }

    hydratedTableIdRef.current = active.tableId
    if (!check) return

    setLines(check.lines)
    setCharges(check.charges ?? EMPTY_OPEN_CHARGES)
    setCheckNumber(check.checkNumber)
    setCover(check.cover > 0 ? check.cover : 2)
    setDining(check.dining || 'dine-in')
    setFiredQtyByLine(check.firedQtyByLine ?? {})
    setFiredAtByLine(check.firedAtByLine ?? {})
    setSelectedLineKey(null)
  }, [liveCatalog, session])

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
  const onDuty = !orderingLocked

  const catalogForFilter = session ? liveCatalog : MOCK_PRODUCTS

  // Keep CDS in sync with the open register check (pre-payment only).
  useEffect(() => {
    if (lines.length === 0) {
      clearCustomerDisplaySnapshot()
      return
    }
    const byId = new Map(catalogForFilter.map(p => [p.id, p]))
    const displayLines = lines.flatMap(line => {
      const product = byId.get(line.productId)
      if (!product) return []
      const extraCents = saleDetailExtraChargeCents(line.saleDetail)
      return [{
        name: product.name,
        note: line.note,
        quantityLabel: product.pricedByWeight && product.weightUom
          ? `${line.quantity} ${product.weightUom}`
          : String(line.quantity),
        unitPriceCents: product.priceCents,
        lineTotalCents: product.priceCents * line.quantity + extraCents,
      }]
    })
    publishCustomerDisplaySnapshot({
      checkNumber,
      dining,
      tableLabel:
        activeTableSession?.tableLabel
        || (dining === 'takeaway' ? 'Takeaway' : table ? `Table ${table}` : ''),
      cover,
      lines: displayLines,
      charges,
      subtotalCents: cartSubtotal(lines, catalogForFilter),
      grandTotalCents: cartGrandTotal(lines, catalogForFilter, charges),
      updatedAt: new Date().toISOString(),
    })
  }, [
    lines,
    charges,
    dining,
    table,
    cover,
    checkNumber,
    activeTableSession,
    catalogForFilter,
  ])

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
    flash('Check in with Team QR, then enter your PIN to unlock POS ordering.')
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
    if (raw == null) {
      pendingCompulsoryLabelsRef.current = []
      return
    }
    const weight = Number(raw)
    if (!Number.isFinite(weight) || weight <= 0) {
      pendingCompulsoryLabelsRef.current = []
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
    const labels = pendingCompulsoryLabelsRef.current
    pendingCompulsoryLabelsRef.current = []
    setLines(prev => {
      const next = addWeightToCart(prev, product.id, weight, detail)
      return applyCompulsoryNote(next, product.id, undefined, labels)
    })
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
    const labels = pendingCompulsoryLabelsRef.current
    pendingCompulsoryLabelsRef.current = []
    setLines(prev => {
      const next = addVariableToCart(prev, comboProduct.id, detail, 1)
      const added = next[next.length - 1]
      return applyCompulsoryNote(next, comboProduct.id, added?.lineKey, labels)
    })
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
    const labels = pendingCompulsoryLabelsRef.current
    pendingCompulsoryLabelsRef.current = []
    if (lineKey) {
      setLines(prev => {
        const next = updateLineSaleDetail(prev, lineKey, product.id, detail)
        return applyCompulsoryNote(next, product.id, lineKey, labels)
      })
    } else if (pendingWeight) {
      setLines(prev => {
        const next = addWeightToCart(prev, product.id, pendingWeight.weight, detail)
        return applyCompulsoryNote(next, product.id, undefined, labels)
      })
    } else {
      setLines(prev => {
        const next = addVariableToCart(prev, product.id, detail, quantity && quantity > 0 ? quantity : 1)
        const added = next[next.length - 1]
        return applyCompulsoryNote(next, product.id, added?.lineKey, labels)
      })
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

  function applyCompulsoryNote(
    lines: CartLine[],
    productId: string,
    lineKey: string | undefined,
    labels: string[],
  ): CartLine[] {
    if (labels.length === 0) return lines
    const line = lineKey
      ? lines.find(l => l.lineKey === lineKey)
      : lines.filter(l => l.productId === productId).at(-1)
    if (!line) return lines
    const existing = (line.note ?? '').trim()
    const nextNote = [existing, labels.join(', ')].filter(Boolean).join(' · ')
    return setLineNote(lines, productId, nextNote, line.lineKey)
  }

  function continueAddProduct(product: Product, compulsoryLabels: string[] = []) {
    pendingCompulsoryLabelsRef.current = compulsoryLabels
    const finishPlainAdd = () => {
      setLines(prev => {
        const next = addToCart(prev, product.id)
        const labels = pendingCompulsoryLabelsRef.current
        pendingCompulsoryLabelsRef.current = []
        if (labels.length === 0) return next
        const added = next[next.length - 1]
        if (!added || added.productId !== product.id) return next
        return setLineNote(next, product.id, labels.join(', '), added.lineKey)
      })
      setSelectedLineKey(`pid:${product.id}`)
    }

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
    finishPlainAdd()
  }

  function addProduct(product: Product) {
    if (!requireDuty()) return
    const compulsory = resolveRequiredModifierGroups(modifierGroups, product)
    if (compulsory.length > 0) {
      setCompulsoryFlow({
        product,
        groups: compulsory,
        index: 0,
        selectedLabels: [],
      })
      return
    }
    continueAddProduct(product)
  }

  function confirmCompulsoryStep(optionIds: number[]) {
    if (!compulsoryFlow) return
    const group = compulsoryFlow.groups[compulsoryFlow.index]
    if (!group) return
    const labels = (group.options ?? [])
      .filter(o => optionIds.includes(o.id))
      .map(o => o.label)
    const selectedLabels = [...compulsoryFlow.selectedLabels, ...labels]
    const nextIndex = compulsoryFlow.index + 1
    if (nextIndex < compulsoryFlow.groups.length) {
      setCompulsoryFlow({
        ...compulsoryFlow,
        index: nextIndex,
        selectedLabels,
      })
      return
    }
    const product = compulsoryFlow.product
    setCompulsoryFlow(null)
    continueAddProduct(product, selectedLabels)
  }


  function lineSelectionKey(line: CartLine) {
    return line.lineKey ?? `pid:${line.productId}`
  }

  function resolveTargetLine(department?: ProductDepartment) {
    const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
    const byId = new Map(products.map(p => [p.id, p]))
    if (selectedLineKey) {
      const selected = lines.find(l => lineSelectionKey(l) === selectedLineKey)
      if (selected) {
        const product = byId.get(selected.productId)
        if (product && (!department || product.department === department)) {
          return { line: selected, product }
        }
      }
    }
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]
      const product = byId.get(line.productId)
      if (!product) continue
      if (!department || product.department === department) {
        return { line, product }
      }
    }
    return null
  }

  function openFoodModifier() {
    if (!requireDuty()) return
    const target = resolveTargetLine('Food')
    if (!target) {
      flash('Add a Food item first, or select a Food line on the order.')
      return
    }
    setSelectedLineKey(lineSelectionKey(target.line))
    setModifierTarget({ kind: 'food', ...target })
  }

  function openBeverageModifier() {
    if (!requireDuty()) return
    const target = resolveTargetLine('Beverage')
    if (!target) {
      flash('Add a Beverage item first, or select a Beverage line on the order.')
      return
    }
    setSelectedLineKey(lineSelectionKey(target.line))
    setModifierTarget({ kind: 'beverage', ...target })
  }

  const foodModifierPickerGroups = resolveToolbarModifierGroups(
    modifierGroups,
    'food',
    modifierTarget?.kind === 'food' ? modifierTarget.product : null,
  )
  const beverageModifierPickerGroups = resolveToolbarModifierGroups(
    modifierGroups,
    'beverage',
    modifierTarget?.kind === 'beverage' ? modifierTarget.product : null,
  )

  function openComponentSwap() {
    if (!requireDuty()) return
    const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
    const byId = new Map(products.map(p => [p.id, p]))
    let target = resolveTargetLine()
    if (target) {
      const canSwap = Boolean(
        target.product.isVariableComponent
        && (target.product.variableComponentSlots?.length ?? 0) > 0,
      )
      if (!canSwap) target = null
    }
    if (!target) {
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i]
        const product = byId.get(line.productId)
        if (product?.isVariableComponent && (product.variableComponentSlots?.length ?? 0) > 0) {
          target = { line, product }
          break
        }
      }
    }
    if (!target) {
      flash('Select or add a Variable Component item to SWAP.')
      return
    }
    setSelectedLineKey(lineSelectionKey(target.line))
    handleSwapLine(target.line)
  }

  function applyModifiers(labels: string[]) {
    if (!modifierTarget) return
    const { line, product } = modifierTarget
    const existing = (line.note ?? '').trim()
    // Keep non-modifier detail notes (weight/swap summary) when present.
    const detailNote = line.saleDetail ? (existing.split(' · ')[0] ?? existing) : ''
    const modifierNote = labels.join(', ')
    const nextNote = [detailNote && line.saleDetail ? detailNote : '', modifierNote]
      .map(s => s.trim())
      .filter(Boolean)
      .join(' · ')
    setLines(prev => setLineNote(prev, product.id, nextNote, line.lineKey))
    flash(
      labels.length > 0
        ? `${product.name}: ${labels.join(', ')}`
        : `${product.name}: modifiers cleared`,
    )
    setModifierTarget(null)
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

  function goHome() {
    navigate(MODE_META.order.homePath)
  }

  function handleRemoveLine(line: CartLine) {
    if (!requireDuty()) return
    const products = catalogForFilter
    const product = products.find(p => p.id === line.productId)
    if (!product) {
      setLines(prev => removeLine(prev, line.productId, line.lineKey))
      return
    }
    const id = lineIdentity(line)
    const firedQty = firedQtyByLine[id] ?? 0
    if (firedQty <= 0) {
      setLines(prev => removeLine(prev, line.productId, line.lineKey))
      return
    }
    const firedAt = firedAtByLine[id]
    const mode = removalModeForFireAge(firedAt)
    if (mode === 'unfired') {
      setLines(prev => removeLine(prev, line.productId, line.lineKey))
      return
    }
    setRemovalError(null)
    setRemovalTarget({
      line,
      product,
      mode,
      minutesSinceFire: minutesSinceFire(firedAt) ?? 0,
    })
  }

  async function confirmRemoval(payload: { reason: string; authorizerPin?: string }) {
    if (!removalTarget) return
    const { line, product, mode } = removalTarget
    const tableLabel =
      activeTableSession?.tableLabel
      || (table ? `Table ${table}` : 'Takeaway')
    const qty = line.quantity
    const amountCents = Math.round(
      (product.priceCents + saleDetailExtraChargeCents(line.saleDetail)) * qty,
    )
    const id = lineIdentity(line)

    setRemovalBusy(true)
    setRemovalError(null)
    try {
      let authorizedBy = duty?.employeeName || 'POS Staff'
      if (mode === 'void') {
        const auth = await authorizeVoidPin(payload.authorizerPin || '')
        if (!auth.ok) {
          setRemovalError(auth.error)
          return
        }
        authorizedBy = auth.employeeName
        if (session?.companyId && session.locationId) {
          const productIdNum = Number(line.productId)
          if (Number.isFinite(productIdNum) && productIdNum > 0) {
            await api.createPosWastage({
              companyId: session.companyId,
              locationExternalId: session.locationId,
              productId: productIdNum,
              quantity: qty,
              checkNo: String(checkNumber),
              reason: payload.reason || 'POS void',
            })
          }
          await api.posRecordVoid({
            companyId: session.companyId,
            locationExternalId: session.locationId,
            checkNumber,
            productName: product.name,
            amountCents,
            reason: payload.reason,
            authorizedBy,
          })
        }
      } else if (session?.companyId && session.locationId) {
        await api.posRecordCancel({
          companyId: session.companyId,
          locationExternalId: session.locationId,
          checkNumber,
          productName: product.name,
          amountCents,
          reason: payload.reason || undefined,
          canceledBy: authorizedBy,
        }).catch(() => { /* best-effort reference log */ })
      }

      notifyStationsLineRemoved({
        mode: mode === 'void' ? 'voided' : 'canceled',
        checkNumber,
        tableLabel,
        dining: dining || 'dine-in',
        product,
        quantity: qty,
        detail: line.note,
        reason: payload.reason || undefined,
      })

      appendPosLineAudit({
        kind: mode === 'void' ? 'voided' : 'canceled',
        checkNumber,
        tableLabel,
        productId: line.productId,
        productName: product.name,
        quantity: qty,
        amountCents,
        reason: payload.reason || '',
        authorizedBy,
        station: product.department === 'Beverage' ? 'Bar' : 'Kitchen',
      })

      setLines(prev => removeLine(prev, line.productId, line.lineKey))
      setFiredQtyByLine(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setFiredAtByLine(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (selectedLineKey === id || selectedLineKey === line.lineKey) {
        setSelectedLineKey(null)
      }
      setRemovalTarget(null)
      flash(
        mode === 'void'
          ? `Voided ${product.name} · stock depleted · stations notified`
          : `Canceled ${product.name} · stations notified`,
      )
    } catch (err) {
      setRemovalError(err instanceof Error ? err.message : 'Unable to complete removal.')
    } finally {
      setRemovalBusy(false)
    }
  }

  /**
   * Discard unsaved register edits and leave.
   * Never cancels/voids a bill or deletes a persisted open check that has items.
   * Empty newly-opened tables (no saved order) are released so the seat returns to free.
   */
  function handleCancelEdits() {
    const label = activeTableSession?.tableLabel
    const saved = activeTableSession
      ? loadOpenCheckForTable(activeTableSession.tableId)
      : null
    const hasSavedOrder = Boolean(saved && saved.lines.length > 0)

    if (activeTableSession && !hasSavedOrder) {
      removeOpenCheckForTable(activeTableSession.tableId)
      if (session?.companyId && session.locationId) {
        persistFloorTablePatch(session.companyId, session.locationId, activeTableSession.tableId, {
          status: 'open',
          pax: undefined,
          openedAt: undefined,
          orderId: undefined,
          serverName: undefined,
        })
      } else {
        releaseFloorTable(activeTableSession.tableId)
      }
    }

    setLines([])
    setCharges(EMPTY_CHARGES)
    setFiredQtyByLine({})
    setFiredAtByLine({})
    setPaymentOpen(false)
    setPaymentError(null)
    clearCustomerDisplaySnapshot()
    clearActiveRegisterSession()
    setActiveTableSession(null)
    flash(
      hasSavedOrder
        ? `Edits discarded · ${label ?? 'order'} unchanged`
        : label
          ? `Left ${label} without changes`
          : 'Left without changes',
    )
    goHome()
  }

  /** Fire new items to Bar/Kitchen, persist the open check, keep the table occupied. */
  function handleSaveOrder() {
    if (lines.length === 0) {
      flash('Add items before saving.')
      return
    }
    const products = catalogForFilter
    const tableLabel =
      activeTableSession?.tableLabel
      || (table ? `Table ${table}` : 'Takeaway')
    const orderId = `chk-${checkNumber}`
    const { toFire, nextFiredQtyByLine } = takeUnfiredLines(lines, firedQtyByLine)
    const firedAtIso = new Date().toISOString()
    const nextFiredAtByLine = mergeFiredAtByLine(
      firedAtByLine,
      firedQtyByLine,
      nextFiredQtyByLine,
      firedAtIso,
    )
    const tickets = toFire.length > 0
      ? fireCartToStations({
          lines: toFire,
          products,
          checkNumber,
          tableLabel,
          dining: dining || 'dine-in',
        })
      : []

    if (activeTableSession) {
      const openCheck: OpenCheck = {
        tableId: activeTableSession.tableId,
        tableLabel: activeTableSession.tableLabel,
        orderId,
        checkNumber,
        lines,
        charges,
        dining: dining || 'dine-in',
        cover,
        firedQtyByLine: nextFiredQtyByLine,
        firedAtByLine: nextFiredAtByLine,
        updatedAt: new Date().toISOString(),
      }
      upsertOpenCheck(openCheck)
      if (session?.companyId && session.locationId) {
        persistFloorTablePatch(
          session.companyId,
          session.locationId,
          activeTableSession.tableId,
          table => ({
            status: 'ordered',
            orderId,
            openedAt: table.openedAt || new Date().toISOString(),
          }),
        )
      } else {
        markFloorTableOrdered(activeTableSession.tableId, orderId)
      }
    } else if (toFire.length === 0) {
      flash('Nothing new to send to Bar or Kitchen.')
      return
    }

    const stations = [...new Set(tickets.map(t => t.station))].join(' · ')
    setLines([])
    setCharges(EMPTY_CHARGES)
    setFiredQtyByLine({})
    setFiredAtByLine({})
    clearCustomerDisplaySnapshot()
    clearActiveRegisterSession()
    setActiveTableSession(null)
    if (tickets.length > 0) {
      flash(`Order #${checkNumber} sent to ${stations}`)
    } else {
      flash(`Order #${checkNumber} saved · ${tableLabel}`)
    }
    goHome()
  }

  function openPayment() {
    if (!requireDuty()) return
    if (lines.length === 0) {
      flash('Add items before taking payment.')
      return
    }
    if (!session) {
      flash('POS session is not ready. Re-open the register from the floor.')
      return
    }
    if (charging) return
    setPaymentError(null)
    setPaymentOpen(true)
  }

  async function confirmPayment(payload: {
    tender: TenderType
    cashReceivedCents?: number
  }) {
    if (!session) {
      setPaymentError('POS session is not ready.')
      return
    }
    if (lines.length === 0 || charging) return
    setCharging(true)
    setPaymentError(null)
    try {
      const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
      const grossCents = cartSubtotal(lines, products)
      const grandCents = cartGrandTotal(lines, products, charges)
      const locationId = session.locationId
      if (!locationId) {
        throw new Error('No location selected for this POS session.')
      }

      let recordedSales = 0
      for (const line of lines) {
        const productId = Number(line.productId)
        if (!Number.isFinite(productId) || productId <= 0) continue
        const detail = line.saleDetail
        await api.recordProductSale(productId, {
          locationExternalIds: [locationId],
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
        recordedSales += 1
      }
      if (recordedSales === 0) {
        throw new Error('No sellable products on this check. Check product IDs / catalog.')
      }

      const methodLabel = TENDER_LABEL[payload.tender] || payload.tender
      try {
        await api.posRecordClosedCheck({
          companyId: session.companyId,
          locationExternalId: locationId,
          checkNumber,
          checkLabel: activeTableSession?.tableLabel || 'POS Register',
          covers: cover > 0 ? cover : 1,
          discountCents: charges.discountCents,
          taxCents: charges.taxRegularCents + charges.taxAlcoholCents,
          grossCents,
          paymentMethod: payload.tender,
          paymentAmountCents: grandCents,
          paymentPurpose: methodLabel,
        })
      } catch {
        /* inventory sale already recorded; EOD row is best-effort */
      }

      const count = lines.reduce((n, l) => n + l.quantity, 0)
      if (activeTableSession) {
        removeOpenCheckForTable(activeTableSession.tableId)
        if (session.companyId && session.locationId) {
          persistFloorTablePatch(session.companyId, session.locationId, activeTableSession.tableId, {
            status: 'open',
            pax: undefined,
            openedAt: undefined,
            orderId: undefined,
            serverName: undefined,
          })
        } else {
          releaseFloorTable(activeTableSession.tableId)
        }
      }
      setLines([])
      setCharges(EMPTY_CHARGES)
      setFiredQtyByLine({})
      setFiredAtByLine({})
      setPaymentOpen(false)
      clearCustomerDisplaySnapshot()
      clearActiveRegisterSession()
      setActiveTableSession(null)
      flash(`Paid via ${methodLabel} · ${count} item${count === 1 ? '' : 's'}`)
      session.refreshCatalog()
      goHome()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment failed'
      setPaymentError(message)
      flash(message)
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
            Attendance is QR in Team (/TEAM). After check-in, enter PIN to unlock POS.
          </p>
        ) : (
          <p className="register__duty-banner is-on" role="status">
            Ordering unlocked — QR records attendance; PIN only unlocks POS
          </p>
        )}

        <div className="register__grid-scroll">
          <ProductGrid
            products={filtered}
            onAdd={addProduct}
            disabled={!onDuty}
          />
        </div>

        <div
          className="register__order-tools"
          role="group"
          aria-label="Order modifiers"
          style={{ gridTemplateColumns: `repeat(${groupColumns}, minmax(0, 1fr))` }}
        >
          <button
            type="button"
            className="register__order-tool"
            disabled={!onDuty}
            onClick={openFoodModifier}
          >
            Food Modifier
          </button>
          <button
            type="button"
            className="register__order-tool"
            disabled={!onDuty}
            onClick={openBeverageModifier}
          >
            Beverage Modifier
          </button>
          <button
            type="button"
            className="register__order-tool register__order-tool--swap"
            disabled={!onDuty}
            onClick={openComponentSwap}
          >
            Component SWAP
          </button>
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
        onRemoveLine={handleRemoveLine}
        selectedLineKey={selectedLineKey}
        onSelectLine={(line) => setSelectedLineKey(line.lineKey ?? `pid:${line.productId}`)}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPickup={() => {
          if (dining === 'takeaway') setPickupModalOpen(true)
        }}
        activeTableLabel={activeTableSession?.tableLabel ?? null}
        paymentBusy={charging}
        onAction={action => {
          if (!requireDuty()) return
          if (action === 'cancel') {
            handleCancelEdits()
            return
          }
          if (action === 'save') {
            handleSaveOrder()
            return
          }
          if (action === 'payment') {
            openPayment()
            return
          }
          flash('Printing…')
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
      {modifierTarget && (
        <ModifierPickerModal
          title={modifierTarget.kind === 'food' ? 'Food Modifier' : 'Beverage Modifier'}
          productName={modifierTarget.product.name}
          groups={
            modifierTarget.kind === 'food'
              ? foodModifierPickerGroups
              : beverageModifierPickerGroups
          }
          onCancel={() => setModifierTarget(null)}
          onConfirm={applyModifiers}
        />
      )}

      {compulsoryFlow && compulsoryFlow.groups[compulsoryFlow.index] ? (
        <CompulsoryModifierModal
          productName={compulsoryFlow.product.name}
          group={compulsoryFlow.groups[compulsoryFlow.index]}
          stepIndex={compulsoryFlow.index}
          stepTotal={compulsoryFlow.groups.length}
          onCancel={() => setCompulsoryFlow(null)}
          onConfirm={confirmCompulsoryStep}
        />
      ) : null}

      {removalTarget && (
        <VoidCancelModal
          mode={removalTarget.mode}
          productName={removalTarget.product.name}
          quantity={removalTarget.line.quantity}
          minutesSinceFire={removalTarget.minutesSinceFire}
          busy={removalBusy}
          error={removalError}
          onCancel={() => {
            if (removalBusy) return
            setRemovalTarget(null)
            setRemovalError(null)
          }}
          onConfirm={(payload) => { void confirmRemoval(payload) }}
        />
      )}

      {paymentOpen && (
        <PaymentModal
          checkNumber={checkNumber}
          tableLabel={
            activeTableSession?.tableLabel
            || (table ? `Table ${table}` : 'Takeaway')
          }
          amountCents={cartGrandTotal(
            lines,
            liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS,
            charges,
          )}
          busy={charging}
          error={paymentError}
          onCancel={() => {
            if (charging) return
            setPaymentOpen(false)
            setPaymentError(null)
          }}
          onConfirm={(payload) => { void confirmPayment(payload) }}
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
