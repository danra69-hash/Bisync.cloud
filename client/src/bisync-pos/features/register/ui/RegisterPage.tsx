import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_PRODUCTS } from '../domain/catalog'
import {
  addToCart,
  addVariableToCart,
  addWeightToCart,
  cartGrandTotal,
  cartSubtotal,
  ensureCartLineKeys,
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
import { buildDepartmentGroups, isComponentSwapMenuGroup } from '../../../core/session/mapPosCatalog'
import {
  clearActiveRegisterSession,
  loadActiveRegisterSession,
  loadFloorPlan,
  markFloorTableOrdered,
  releaseFloorTable,
  setActiveRegisterSession,
  type ActiveRegisterSession,
  type FloorTable,
} from '../../order/domain/tables'
import { loadFloorPlanLocal, persistFloorTablePatch } from '../../order/domain/floorPlanSync'
import { FloorPlanTablePickerModal } from '../../order/ui/FloorPlanTablePickerModal'
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
import type { PosConfigType, PosPrepaidPurchase, PosPromotion } from '../../../../api'
import { enqueueOutbox } from '../../../core/offline/posOutbox'
import { isOnline } from '../../../core/offline/posCatalogStore'
import { ProductGrid } from './ProductGrid'
import { OrderPanel } from './OrderPanel'
import { HistoryModal } from './HistoryModal'
import { TakeawayPickupModal } from './TakeawayPickupModal'
import { CombinationPickerModal } from './CombinationPickerModal'
import { ComponentSwapModal } from './ComponentSwapModal'
import { PrepaidCustomerModal, PrepaidDepleteModal } from './PrepaidModals'
import {
  encodePrepaidNote,
  findActivePrepaidPromotionForProduct,
  parsePrepaidNote,
} from '../domain/prepaidNotes'
import { ModifierPickerModal } from './ModifierPickerModal'
import { VoidCancelModal } from './VoidCancelModal'
import { PaymentModal, type PaymentConfirmPayload } from './PaymentModal'
import { DiscountModal, type DiscountApplyPayload } from './DiscountModal'
import { CompulsoryModifierModal } from './CompulsoryModifierModal'
import { TENDER_LABEL, paymentMethodForApi, paymentTypeLabel } from '../../cashier/domain/payments'
import type { PosModifierGroup } from '../../../../api'
import {
  resolveRequiredModifierGroups,
  resolveToolbarModifierGroups,
} from '../../../../data/posModifierGroups'
import {
  formatPickupLabel,
  type TakeawayPickup,
} from '../domain/pickupTime'
import { formatPosCheckNumber, nextPosCheckNumber } from '../domain/checkNumber'
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
  const [table, setTable] = useState(() => loadActiveRegisterSession()?.tableId ?? '')
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
  const [selectedLineKeys, setSelectedLineKeys] = useState<string[]>([])
  const [tablePickerMode, setTablePickerMode] = useState<'changeTable' | 'moveProduct' | null>(null)
  const [modifierTarget, setModifierTarget] = useState<{
    kind: 'food' | 'beverage'
    line: CartLine
    product: Product
  } | null>(null)
  const [checkNumber, setCheckNumber] = useState(() => nextPosCheckNumber())
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
  const [entertainmentTypes, setEntertainmentTypes] = useState<PosConfigType[]>([])
  const [discountTypes, setDiscountTypes] = useState<PosConfigType[]>([])
  const [paymentTypes, setPaymentTypes] = useState<PosConfigType[]>([])
  const [discountOpen, setDiscountOpen] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [prepaidPromotions, setPrepaidPromotions] = useState<PosPromotion[]>([])
  const [prepaidCustomerTarget, setPrepaidCustomerTarget] = useState<{
    product: Product
    promotion: PosPromotion
  } | null>(null)
  const [prepaidDepleteOpen, setPrepaidDepleteOpen] = useState(false)
  const [prepaidPurchases, setPrepaidPurchases] = useState<PosPrepaidPurchase[]>([])
  const [prepaidDepleteBusy, setPrepaidDepleteBusy] = useState(false)
  const [prepaidDepleteError, setPrepaidDepleteError] = useState<string | null>(null)
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
    if (session.offlineFirst && session.modifierGroups.length > 0) {
      setModifierGroups(session.modifierGroups)
    }
    // Refresh from API whenever online so newly created Beverage/Food modifiers appear
    // even on offline-first stations that already have a catalog snapshot.
    if (session.offlineFirst && !isOnline()) return
    let cancelled = false
    api.posModifierGroups(session.companyId)
      .then(rows => {
        if (!cancelled) setModifierGroups(rows)
      })
      .catch(() => {
        if (cancelled) return
        if (!(session.offlineFirst && session.modifierGroups.length > 0)) {
          setModifierGroups([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [session?.companyId, session?.offlineFirst, session?.modifierGroups])

  useEffect(() => {
    if (!session?.companyId) {
      setPrepaidPromotions([])
      return
    }
    if (session.offlineFirst && session.promotions.length > 0) {
      setPrepaidPromotions(session.promotions.filter(p =>
        p.promotionKind === 'prepaid' && p.active && p.status !== 'Inactive'))
      return
    }
    let cancelled = false
    api.posPromotions(session.companyId)
      .then(rows => {
        if (cancelled) return
        setPrepaidPromotions(rows.filter(p =>
          p.promotionKind === 'prepaid' && p.active && p.status !== 'Inactive'))
      })
      .catch(() => {
        if (!cancelled) setPrepaidPromotions([])
      })
    return () => {
      cancelled = true
    }
  }, [session?.companyId, session?.offlineFirst, session?.promotions])

  useEffect(() => {
    if (!session?.companyId) {
      setEntertainmentTypes([])
      setDiscountTypes([])
      setPaymentTypes([])
      return
    }
    let cancelled = false
    Promise.all([
      api.posConfigTypes(session.companyId, { kind: 'payment', includeInactive: false }),
      api.posConfigTypes(session.companyId, { kind: 'entertainment', includeInactive: false }),
      api.posConfigTypes(session.companyId, { kind: 'discount', includeInactive: false }),
    ])
      .then(([pay, ent, disc]) => {
        if (cancelled) return
        setPaymentTypes(pay.filter(r => r.active !== false))
        setEntertainmentTypes(ent.filter(r => r.active !== false))
        setDiscountTypes(disc.filter(r => r.active !== false))
      })
      .catch(() => {
        if (cancelled) return
        setPaymentTypes([])
        setEntertainmentTypes([])
        setDiscountTypes([])
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
      const floorTables =
        session?.companyId && session.locationId
          ? loadFloorPlanLocal(session.companyId, session.locationId).tables
          : loadFloorPlan().tables
      const floorTable = floorTables.find(t => t.id === active.tableId)
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

    setLines(ensureCartLineKeys(check.lines))
    setCharges(check.charges ?? EMPTY_OPEN_CHARGES)
    setCheckNumber(check.checkNumber)
    setCover(check.cover > 0 ? check.cover : 2)
    setDining(check.dining || 'dine-in')
    setFiredQtyByLine(check.firedQtyByLine ?? {})
    setFiredAtByLine(check.firedAtByLine ?? {})
    setSelectedLineKey(null)
    setSelectedLineKeys([])
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

  const conceptLocations = useMemo(() => {
    const locs = session?.locations ?? []
    const active = locs.find(l => l.externalId === session?.locationId)
    const siteKey = (active?.physicalSiteKey || '').trim()
    if (!siteKey) return []
    return locs
      .filter(l => (l.physicalSiteKey || '').trim() === siteKey)
      .sort(
        (a, b) =>
          (a.conceptSortOrder ?? 0) - (b.conceptSortOrder ?? 0)
          || a.name.localeCompare(b.name),
      )
  }, [session?.locations, session?.locationId])

  const catalogForFilter = session ? liveCatalog : MOCK_PRODUCTS
  const tableOptions = useMemo(() => {
    const plan =
      session?.companyId && session.locationId
        ? loadFloorPlanLocal(session.companyId, session.locationId)
        : loadFloorPlan()
    return plan.tables.map(t => ({ id: t.id, label: t.label }))
  }, [session?.companyId, session?.locationId])

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
      // Component SWAP is a toolbar action — do not list those products as a menu grid.
      if (isComponentSwapMenuGroup(p.group)) return false
      if (p.department !== department) return false
      if (q) {
        return (
          p.name.toLowerCase().includes(q)
          || p.sku.toLowerCase().includes(q)
          || p.group.toLowerCase().includes(q)
        )
      }
      if (group && p.group !== group) return false
      return true
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
      let next = addToCart(lines, product.id)
      const labels = pendingCompulsoryLabelsRef.current
      pendingCompulsoryLabelsRef.current = []
      const target = next.find(l => l.productId === product.id && !l.saleDetail)
        ?? next.filter(l => l.productId === product.id).at(-1)
      if (labels.length > 0 && target) {
        next = setLineNote(next, product.id, labels.join(', '), target.lineKey)
      }
      setLines(next)
      if (target) focusLineKey(lineSelectionKey(target))
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
    const prepaid = findActivePrepaidPromotionForProduct(prepaidPromotions, product.id)
    if (prepaid) {
      setPrepaidCustomerTarget({ product, promotion: prepaid })
      return
    }
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

  function confirmPrepaidCustomer(payload: { customerName: string; customerMobile: string }) {
    const target = prepaidCustomerTarget
    setPrepaidCustomerTarget(null)
    if (!target) return
    const packageRpp = Number(
      target.promotion.packageRpp
      ?? target.promotion.products?.[0]?.rpp
      ?? 0,
    )
    const priceCents = Math.max(0, Math.round(packageRpp * 100))
    const note = encodePrepaidNote(
      target.promotion.id,
      payload.customerMobile,
      payload.customerName,
    )
    setLines(prev => [
      ...prev,
      {
        productId: target.product.id,
        quantity: 1,
        lineKey: `prepaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        note,
        unitPriceCents: priceCents,
      },
    ])
    setSelectedLineKey(null)
    setSelectedLineKeys([])
    flash(`Pre-paid · ${payload.customerName} · ${target.promotion.name}`)
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

  function focusLineKey(key: string | null) {
    setSelectedLineKey(key)
    setSelectedLineKeys(key ? [key] : [])
  }

  function toggleLineHighlight(line: CartLine) {
    const key = lineSelectionKey(line)
    setSelectedLineKeys(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key)
        setSelectedLineKey(next[next.length - 1] ?? null)
        return next
      }
      setSelectedLineKey(key)
      return [...prev, key]
    })
  }

  function findSelectedLine(): { line: CartLine; product: Product } | null {
    if (!selectedLineKey) return null
    const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
    const byId = new Map(products.map(p => [p.id, p]))
    const selected = lines.find(l => lineSelectionKey(l) === selectedLineKey)
    if (!selected) return null
    const product = byId.get(selected.productId)
    if (!product) return null
    return { line: selected, product }
  }

  /** When no row is highlighted, Modifier / SWAP always target the last ordered line. */
  function resolveLastOrderedLine(): { line: CartLine; product: Product } | null {
    const products = liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS
    const byId = new Map(products.map(p => [p.id, p]))
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i]
      const product = byId.get(line.productId)
      if (product) return { line, product }
    }
    return null
  }

  function resolveModifierOrSwapTarget(): { line: CartLine; product: Product } | null {
    if (selectedLineKey) {
      const selected = findSelectedLine()
      if (selected) return selected
      focusLineKey(null)
    }
    return resolveLastOrderedLine()
  }

  function openFoodModifier() {
    if (!requireDuty()) return
    const target = resolveModifierOrSwapTarget()
    if (!target) {
      flash('Add an item first, then tap Food Modifier.')
      return
    }
    if (target.product.department !== 'Food') {
      flash(`“${target.product.name}” is not a Food item. Select a Food line, or order Food last.`)
      return
    }
    focusLineKey(lineSelectionKey(target.line))
    setModifierTarget({ kind: 'food', ...target })
  }

  function openBeverageModifier() {
    if (!requireDuty()) return
    const target = resolveModifierOrSwapTarget()
    if (!target) {
      flash('Add an item first, then tap Beverage Modifier.')
      return
    }
    if (target.product.department !== 'Beverage') {
      flash(`“${target.product.name}” is not a Beverage item. Select a Beverage line, or order Beverage last.`)
      return
    }
    focusLineKey(lineSelectionKey(target.line))
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

  function lineCanSwap(product: Product | undefined): boolean {
    return Boolean(
      product?.isVariableComponent
      && (product.variableComponentSlots?.length ?? 0) > 0,
    )
  }

  const selectedLineInfo = findSelectedLine()
  const lastOrderedLine = resolveLastOrderedLine()
  const modifierSwapFocus = selectedLineKey ? selectedLineInfo : lastOrderedLine
  const canUseFoodModifier = modifierSwapFocus?.product.department === 'Food'
  const canUseBeverageModifier = modifierSwapFocus?.product.department === 'Beverage'
  const canUseComponentSwap = lineCanSwap(modifierSwapFocus?.product)

  function openComponentSwap() {
    if (!requireDuty()) return
    const target = resolveModifierOrSwapTarget()
    if (!target) {
      flash('Add an item first, then tap Component SWAP.')
      return
    }
    if (!lineCanSwap(target.product)) {
      flash(`“${target.product.name}” has no Component SWAP options. Select a swappable line, or order one last.`)
      return
    }
    focusLineKey(lineSelectionKey(target.line))
    handleSwapLine(target.line)
  }

  function modifierInitialSelected(note: string | undefined, groups: ReturnType<typeof resolveToolbarModifierGroups>): string[] {
    if (!note?.trim() || groups.length === 0) return []
    const labels = new Set(
      note
        .split(/[·,]/)
        .map(s => s.trim())
        .filter(Boolean),
    )
    const ids: string[] = []
    for (const group of groups) {
      for (const opt of group.options ?? []) {
        if (labels.has(opt.label)) ids.push(opt.id)
      }
    }
    return ids
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
    focusLineKey(lineSelectionKey(line))
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
    // Guarantee a stable line key so SWAP updates this row instead of appending.
    let lineKey = line.lineKey
    if (!lineKey) {
      lineKey = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setLines(prev =>
        prev.map(l =>
          l.productId === line.productId
          && !l.lineKey
          && l.quantity === line.quantity
          && l.note === line.note
            ? { ...l, lineKey }
            : l,
        ),
      )
    }
    focusLineKey(lineKey)
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
      lineKey,
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
          const useOutbox = Boolean(session.offlineFirst) || !isOnline()
          if (Number.isFinite(productIdNum) && productIdNum > 0) {
            const wastagePayload = {
              companyId: session.companyId,
              locationExternalId: session.locationId,
              productId: productIdNum,
              quantity: qty,
              checkNo: String(checkNumber),
              reason: payload.reason || 'POS void',
            }
            if (useOutbox) await enqueueOutbox('createPosWastage', wastagePayload)
            else {
              try {
                await api.createPosWastage(wastagePayload)
              } catch {
                await enqueueOutbox('createPosWastage', wastagePayload)
              }
            }
          }
          const voidPayload = {
            companyId: session.companyId,
            locationExternalId: session.locationId,
            checkNumber,
            productName: product.name,
            amountCents,
            reason: payload.reason,
            authorizedBy,
          }
          if (useOutbox) await enqueueOutbox('posRecordVoid', voidPayload)
          else {
            try {
              await api.posRecordVoid(voidPayload)
            } catch {
              await enqueueOutbox('posRecordVoid', voidPayload)
            }
          }
        }
      } else if (session?.companyId && session.locationId) {
        const cancelPayload = {
          companyId: session.companyId,
          locationExternalId: session.locationId,
          checkNumber,
          productName: product.name,
          amountCents,
          reason: payload.reason || undefined,
          canceledBy: authorizedBy,
        }
        if (session.offlineFirst || !isOnline()) {
          await enqueueOutbox('posRecordCancel', cancelPayload)
        } else {
          await api.posRecordCancel(cancelPayload).catch(async () => {
            await enqueueOutbox('posRecordCancel', cancelPayload)
          })
        }
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
      if (selectedLineKey === id || selectedLineKey === line.lineKey || selectedLineKeys.includes(id) || (line.lineKey ? selectedLineKeys.includes(line.lineKey) : false)) {
        setSelectedLineKeys(prev => prev.filter(k => k !== id && k !== line.lineKey))
        setSelectedLineKey(prev => (prev === id || prev === line.lineKey ? null : prev))
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
      flash(`Order #${formatPosCheckNumber(checkNumber)} sent to ${stations}`)
    } else {
      flash(`Order #${formatPosCheckNumber(checkNumber)} saved · ${tableLabel}`)
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
    // Refresh POS Config tenders so Payment Type edits show without remounting POS.
    const companyId = session.companyId
    if (companyId > 0) {
      void Promise.all([
        api.posConfigTypes(companyId, { kind: 'payment', includeInactive: false }),
        api.posConfigTypes(companyId, { kind: 'entertainment', includeInactive: false }),
      ])
        .then(([pay, ent]) => {
          setPaymentTypes(pay.filter(r => r.active !== false))
          setEntertainmentTypes(ent.filter(r => r.active !== false))
        })
        .catch(() => { /* keep previously loaded types */ })
    }
    setPaymentOpen(true)
  }

  function openChangeTablePicker() {
    const fromId = activeTableSession?.tableId || table
    if (!session?.companyId && tableOptions.length === 0) {
      flash('No floor plan tables available.')
      return
    }
    if (fromId && tableOptions.every(t => t.id === fromId) && tableOptions.length <= 1) {
      flash('No other tables available on this floor.')
      return
    }
    setTablePickerMode('changeTable')
  }

  function openMoveProductPicker() {
    if (lines.length === 0) {
      flash('Add items before moving a product.')
      return
    }
    if (selectedLineKeys.length === 0) {
      flash('Highlight one or more line items, then tap Move Product.')
      return
    }
    setTablePickerMode('moveProduct')
  }

  /** Move the entire open check / cart to another floor table. */
  function applyChangeTable(dest: FloorTable) {
    const fromId = activeTableSession?.tableId || table
    const fromLabel = activeTableSession?.tableLabel || (table ? `Table ${table}` : 'current table')
    if (dest.id === fromId) {
      flash(`Already on ${dest.label}.`)
      return
    }
    const occupying = loadOpenCheckForTable(dest.id)
    if (occupying && occupying.lines.length > 0) {
      flash(`${dest.label} already has an open check. Clear or pay it first.`)
      return
    }

    const orderId = `chk-${checkNumber}`
    const nextSession: ActiveRegisterSession = {
      tableId: dest.id,
      tableLabel: dest.label,
      openedAt: activeTableSession?.openedAt ?? new Date().toISOString(),
    }

    if (fromId) {
      const existing = loadOpenCheckForTable(fromId)
      const hasCart = lines.length > 0
      const hasExisting = Boolean(existing && existing.lines.length > 0)
      if (hasCart || hasExisting) {
        if (existing) removeOpenCheckForTable(fromId)
        upsertOpenCheck({
          tableId: dest.id,
          tableLabel: dest.label,
          orderId: existing?.orderId ?? orderId,
          checkNumber: existing?.checkNumber ?? checkNumber,
          lines: hasCart ? lines : (existing?.lines ?? []),
          charges: hasCart ? charges : (existing?.charges ?? { ...EMPTY_OPEN_CHARGES }),
          dining: hasCart ? (dining || 'dine-in') : (existing?.dining ?? 'dine-in'),
          cover: hasCart ? cover : (existing?.cover ?? 1),
          firedQtyByLine: hasCart ? firedQtyByLine : (existing?.firedQtyByLine ?? {}),
          firedAtByLine: hasCart ? firedAtByLine : (existing?.firedAtByLine ?? {}),
          updatedAt: new Date().toISOString(),
        })
      }

      if (session?.companyId && session.locationId) {
        void persistFloorTablePatch(session.companyId, session.locationId, fromId, {
          status: 'open',
          pax: undefined,
          openedAt: undefined,
          orderId: undefined,
          serverName: undefined,
        })
        void persistFloorTablePatch(session.companyId, session.locationId, dest.id, tableRow => ({
          status: hasCart || hasExisting ? 'ordered' : 'open',
          orderId: hasCart || hasExisting ? (existing?.orderId ?? orderId) : undefined,
          openedAt: tableRow.openedAt || nextSession.openedAt,
          pax: cover || undefined,
        }))
      } else {
        releaseFloorTable(fromId)
        if (hasCart || hasExisting) {
          markFloorTableOrdered(dest.id, existing?.orderId ?? orderId)
        }
      }
    }

    setActiveRegisterSession(nextSession)
    setActiveTableSession(nextSession)
    setTable(dest.id)
    hydratedTableIdRef.current = dest.id
    setTablePickerMode(null)
    flash(`Changed table · ${fromLabel} → ${dest.label}`)
  }

  /** Move highlighted cart line(s) onto another table’s open check. */
  function applyMoveProduct(dest: FloorTable) {
    const keys = selectedLineKeys
    if (keys.length === 0) {
      flash('Highlight one or more line items, then tap Move Product.')
      return
    }
    const fromId = activeTableSession?.tableId || table
    if (dest.id === fromId) {
      flash(`Already on ${dest.label}.`)
      return
    }

    const moving = lines.filter(l => keys.includes(lineSelectionKey(l)))
    if (moving.length === 0) {
      flash('Highlight one or more line items, then tap Move Product.')
      return
    }

    const keySet = new Set(keys)
    setLines(prev => prev.filter(l => !keySet.has(lineSelectionKey(l))))
    setFiredQtyByLine(prev => {
      const next = { ...prev }
      for (const line of moving) delete next[lineIdentity(line)]
      return next
    })
    setFiredAtByLine(prev => {
      const next = { ...prev }
      for (const line of moving) delete next[lineIdentity(line)]
      return next
    })
    focusLineKey(null)

    const destCheck = loadOpenCheckForTable(dest.id)
    const movedFiredQty: Record<string, number> = {}
    const movedFiredAt: Record<string, string> = {}
    for (const line of moving) {
      const lineId = lineIdentity(line)
      const qty = firedQtyByLine[lineId] ?? 0
      if (qty > 0) movedFiredQty[lineId] = qty
      const at = firedAtByLine[lineId]
      if (at) movedFiredAt[lineId] = at
    }

    if (destCheck) {
      upsertOpenCheck({
        ...destCheck,
        lines: [...destCheck.lines, ...moving],
        firedQtyByLine: {
          ...destCheck.firedQtyByLine,
          ...movedFiredQty,
        },
        firedAtByLine: {
          ...(destCheck.firedAtByLine ?? {}),
          ...movedFiredAt,
        },
        updatedAt: new Date().toISOString(),
      })
    } else {
      const newCheckNumber = nextPosCheckNumber()
      upsertOpenCheck({
        tableId: dest.id,
        tableLabel: dest.label,
        orderId: `chk-${newCheckNumber}`,
        checkNumber: newCheckNumber,
        lines: moving,
        charges: { ...EMPTY_OPEN_CHARGES },
        dining: dining || 'dine-in',
        cover: 1,
        firedQtyByLine: movedFiredQty,
        firedAtByLine: movedFiredAt,
        updatedAt: new Date().toISOString(),
      })
    }

    if (session?.companyId && session.locationId) {
      void persistFloorTablePatch(session.companyId, session.locationId, dest.id, tableRow => ({
        status: 'ordered',
        orderId: destCheck?.orderId ?? `chk-${checkNumber}`,
        openedAt: tableRow.openedAt || new Date().toISOString(),
      }))
    } else {
      markFloorTableOrdered(dest.id, destCheck?.orderId ?? `chk-${checkNumber}`)
    }

    setTablePickerMode(null)
    const names = moving.map(line => {
      const product = catalogForFilter.find(p => p.id === line.productId)
      return product?.name ?? `Item ${line.productId}`
    })
    const label = names.length === 1
      ? names[0]
      : `${names.length} items`
    flash(`Moved ${label} → ${dest.label}`)
  }

  // Pre-paid redeem modal kept for package sales flow; toolbar Pre-paid button removed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function openPrepaidDeplete() {
    if (!session?.companyId || !session.locationId) {
      flash('POS session is not ready.')
      return
    }
    setPrepaidDepleteError(null)
    setPrepaidDepleteBusy(true)
    try {
      const rows = await api.posPrepaidPurchases(session.companyId, {
        status: 'active',
        locationExternalId: session.locationId,
      })
      const withUnits = rows.map(row => {
        const promo = prepaidPromotions.find(p => p.id === row.posPromotionId)
        return {
          ...row,
          depletionMethod: promo?.depletionMethod,
          depletionUnits: promo?.depletionUnits,
        }
      })
      setPrepaidPurchases(withUnits)
      setPrepaidDepleteOpen(true)
      if (withUnits.length === 0) flash('No active prepaid packages at this location.')
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not load prepaid packages.')
    } finally {
      setPrepaidDepleteBusy(false)
    }
  }
  void openPrepaidDeplete

  async function confirmPrepaidDeplete(payload: {
    purchaseId: number
    unitCode?: string
    qty: number
  }) {
    if (!session?.companyId || !session.locationId) return
    setPrepaidDepleteBusy(true)
    setPrepaidDepleteError(null)
    try {
      const updated = await api.depletePosPrepaid({
        purchaseId: payload.purchaseId,
        companyId: session.companyId,
        locationExternalId: session.locationId,
        unitCode: payload.unitCode,
        qty: payload.qty,
        checkNumber,
        createdBy: duty?.employeeName || 'POS Staff',
      })
      setPrepaidDepleteOpen(false)
      flash(
        `Pre-paid redeemed · ${updated.customerName} · left ${updated.balanceRemaining} ${updated.packageUom}`,
      )
    } catch (e) {
      setPrepaidDepleteError(e instanceof Error ? e.message : 'Redeem failed.')
    } finally {
      setPrepaidDepleteBusy(false)
    }
  }

  async function confirmPayment(payload: PaymentConfirmPayload) {
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
      const isEntertainment = payload.tender === 'entertainment'
      const settleCharges = isEntertainment
        ? {
            ...charges,
            serviceCents: 0,
            taxRegularCents: 0,
            taxAlcoholCents: 0,
          }
        : charges
      const grandCents = isEntertainment
        ? Math.max(0, grossCents - settleCharges.discountCents)
        : cartGrandTotal(lines, products, charges)
      const locationId = session.locationId
      if (!locationId) {
        throw new Error('No location selected for this POS session.')
      }
      if (isEntertainment) {
        if (!payload.entertainment?.employeeName?.trim() || !payload.entertainment?.reason?.trim()) {
          throw new Error('Employee name and reason are required for entertainment.')
        }
      }

      let recordedSales = 0
      let prepaidPackageLines = 0
      const useOutbox = Boolean(session.offlineFirst) || !isOnline()

      for (const line of lines) {
        // Prepaid package purchase is paid now; inventory depletes later on Pre-paid redeem.
        if (parsePrepaidNote(line.note)) {
          prepaidPackageLines += 1
          continue
        }
        const productId = Number(line.productId)
        if (!Number.isFinite(productId) || productId <= 0) continue
        const detail = line.saleDetail
        const saleBody = {
          locationExternalIds: [locationId],
          quantitySold: line.quantity,
          salesChannel: 'pos' as const,
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
        }
        if (useOutbox) {
          await enqueueOutbox('recordProductSale', { productId, body: saleBody })
        } else {
          try {
            await api.recordProductSale(productId, saleBody)
          } catch {
            await enqueueOutbox('recordProductSale', { productId, body: saleBody })
          }
        }
        recordedSales += 1
      }
      if (recordedSales === 0 && prepaidPackageLines === 0) {
        throw new Error('No sellable products on this check. Check product IDs / catalog.')
      }

      const methodLabel = isEntertainment
        ? (payload.entertainment?.typeName || TENDER_LABEL.entertainment)
        : (payload.paymentTypeName
          || paymentTypeLabel(payload.paymentTypeCode, null)
          || TENDER_LABEL[payload.tender]
          || payload.tender)
      const discountNote = settleCharges.discountLabel?.trim()
        || (settleCharges.discountTypeCode
          ? `${settleCharges.discountTypeCode} ${settleCharges.discountPercent ?? ''}%`
          : '')
      const basePurpose = isEntertainment
        ? (payload.entertainment?.purpose || methodLabel)
        : methodLabel
      const paymentPurpose = discountNote && !isEntertainment
        ? `${basePurpose} · ${discountNote}`.slice(0, 240)
        : basePurpose
      const closedCheckPayload = {
        companyId: session.companyId,
        locationExternalId: locationId,
        checkNumber,
        checkLabel: activeTableSession?.tableLabel || 'POS Register',
        covers: cover > 0 ? cover : 1,
        discountCents: settleCharges.discountCents,
        taxCents: isEntertainment
          ? 0
          : settleCharges.taxRegularCents + settleCharges.taxAlcoholCents,
        grossCents,
        paymentMethod: isEntertainment
          ? 'entertainment'
          : paymentMethodForApi(payload.paymentTypeCode || payload.tender),
        paymentAmountCents: grandCents,
        paymentPurpose,
      }
      if (useOutbox) {
        await enqueueOutbox('posRecordClosedCheck', closedCheckPayload)
      } else {
        try {
          await api.posRecordClosedCheck(closedCheckPayload)
        } catch {
          await enqueueOutbox('posRecordClosedCheck', closedCheckPayload)
        }
      }

      // Activate prepaid package accounts for prepaid package lines.
      for (const line of lines) {
        const prepaidMeta = parsePrepaidNote(line.note)
        if (!prepaidMeta) continue
        const prepaidPayload = {
          companyId: session.companyId,
          locationExternalId: locationId,
          promotionId: prepaidMeta.promotionId,
          productId: Number(line.productId),
          customerName: prepaidMeta.customerName,
          customerMobile: prepaidMeta.customerMobile,
          checkNumber,
          createdBy: duty?.employeeName || 'POS Staff',
        }
        if (useOutbox) {
          await enqueueOutbox('createPosPrepaidPurchase', prepaidPayload)
        } else {
          try {
            await api.createPosPrepaidPurchase(prepaidPayload)
          } catch (err) {
            await enqueueOutbox('createPosPrepaidPurchase', prepaidPayload)
            flash(err instanceof Error ? err.message : 'Prepaid queued for upload.')
          }
        }
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
      flash(
        isEntertainment
          ? `Entertainment · ${methodLabel} · ${count} item${count === 1 ? '' : 's'}`
          : `Paid via ${methodLabel} · ${count} item${count === 1 ? '' : 's'}`,
      )
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
          {conceptLocations.length > 1 ? (
            <div className="register__brands" role="tablist" aria-label="Brand concepts">
              {conceptLocations.map(loc => {
                const label = (loc.conceptLabel || loc.name).trim() || loc.name
                const active = loc.externalId === session?.locationId
                return (
                  <button
                    key={loc.externalId}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`register__brand${active ? ' is-active' : ''}`}
                    onClick={() => {
                      if (!active) session?.setLocationId(loc.externalId)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
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
        >
          <button
            type="button"
            className="register__order-tool"
            disabled={!onDuty || !canUseFoodModifier}
            title={
              !onDuty
                ? 'Unlock POS to edit modifiers'
                : !canUseFoodModifier
                  ? 'Select a Food line, or make the last ordered item Food'
                  : selectedLineKey
                    ? 'Apply Food modifiers to the selected line'
                    : 'Apply Food modifiers to the last ordered line'
            }
            onClick={openFoodModifier}
          >
            Food Modifier
          </button>
          <button
            type="button"
            className="register__order-tool"
            disabled={!onDuty || !canUseBeverageModifier}
            title={
              !onDuty
                ? 'Unlock POS to edit modifiers'
                : !canUseBeverageModifier
                  ? 'Select a Beverage line, or make the last ordered item Beverage'
                  : selectedLineKey
                    ? 'Apply Beverage modifiers to the selected line'
                    : 'Apply Beverage modifiers to the last ordered line'
            }
            onClick={openBeverageModifier}
          >
            Beverage Modifier
          </button>
          <button
            type="button"
            className="register__order-tool register__order-tool--swap"
            disabled={!onDuty || !canUseComponentSwap}
            title={
              !onDuty
                ? 'Unlock POS to SWAP components'
                : !canUseComponentSwap
                  ? 'Select a Variable Component line, or order one last'
                  : selectedLineKey
                    ? 'SWAP components on the selected line'
                    : 'SWAP components on the last ordered line'
            }
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
        onEditDiscount={() => {
          setDiscountError(null)
          const companyId = session?.companyId
          if (companyId && companyId > 0) {
            void api.posConfigTypes(companyId, { kind: 'discount', includeInactive: false })
              .then(disc => setDiscountTypes(disc.filter(r => r.active !== false)))
              .catch(() => { /* keep previously loaded types */ })
          }
          setDiscountOpen(true)
        }}
        onSwapLine={handleSwapLine}
        onRemoveLine={handleRemoveLine}
        selectedLineKey={selectedLineKey}
        selectedLineKeys={selectedLineKeys}
        onSelectLine={toggleLineHighlight}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenPickup={() => {
          if (dining === 'takeaway') setPickupModalOpen(true)
        }}
        activeTableLabel={activeTableSession?.tableLabel ?? null}
        paymentBusy={charging}
        tableOptions={tableOptions}
        onAction={action => {
          if (!requireDuty()) return
          if (action === 'cancel') {
            handleCancelEdits()
            return
          }
          if (action === 'ok') {
            handleSaveOrder()
            return
          }
          if (action === 'payment') {
            openPayment()
            return
          }
          if (action === 'changeTable') {
            openChangeTablePicker()
            return
          }
          if (action === 'moveProduct') {
            openMoveProductPicker()
            return
          }
          flash('Printing…')
        }}
      />

      {tablePickerMode ? (
        <FloorPlanTablePickerModal
          companyId={session?.companyId ?? 0}
          locationId={session?.locationId ?? ''}
          mode={tablePickerMode}
          excludeTableId={activeTableSession?.tableId || table || null}
          onCancel={() => setTablePickerMode(null)}
          onPick={(dest) => {
            if (tablePickerMode === 'changeTable') applyChangeTable(dest)
            else applyMoveProduct(dest)
          }}
        />
      ) : null}

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
          initialSelected={modifierInitialSelected(
            modifierTarget.line.note,
            modifierTarget.kind === 'food'
              ? foodModifierPickerGroups
              : beverageModifierPickerGroups,
          )}
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

      {discountOpen ? (
        <DiscountModal
          subtotalCents={cartSubtotal(
            lines,
            liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS,
          )}
          cartLines={lines}
          catalog={liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS}
          discountTypes={discountTypes}
          error={discountError}
          onCancel={() => {
            setDiscountOpen(false)
            setDiscountError(null)
          }}
          onClear={() => {
            setCharges(prev => ({
              ...prev,
              discountCents: 0,
              discountTypeCode: undefined,
              discountPercent: undefined,
              discountReason: undefined,
              discountLabel: undefined,
            }))
            setDiscountOpen(false)
            setDiscountError(null)
            flash('Discount cleared')
          }}
          onConfirm={(payload: DiscountApplyPayload) => {
            setCharges(prev => ({
              ...prev,
              discountCents: payload.discountCents,
              discountTypeCode: payload.typeCode,
              discountPercent: payload.percentage,
              discountReason: payload.reason || undefined,
              discountLabel: payload.label,
            }))
            setDiscountOpen(false)
            setDiscountError(null)
            flash(`Discount · ${payload.label}`)
          }}
        />
      ) : null}

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
          entertainmentAmountCents={Math.max(
            0,
            cartSubtotal(lines, liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS)
              - charges.discountCents,
          )}
          cartLines={lines}
          catalog={liveCatalog.length > 0 ? liveCatalog : MOCK_PRODUCTS}
          paymentTypes={paymentTypes}
          entertainmentTypes={entertainmentTypes}
          defaultEmployeeName={duty?.employeeName || ''}
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

      {prepaidCustomerTarget ? (
        <PrepaidCustomerModal
          productName={prepaidCustomerTarget.product.name}
          promotionName={prepaidCustomerTarget.promotion.name}
          packageLabel={`${prepaidCustomerTarget.promotion.packageQty ?? 1} ${prepaidCustomerTarget.promotion.packageUom || 'unit'} · RPP ${(prepaidCustomerTarget.promotion.packageRpp ?? 0).toFixed(2)}`}
          onCancel={() => setPrepaidCustomerTarget(null)}
          onConfirm={confirmPrepaidCustomer}
        />
      ) : null}

      {prepaidDepleteOpen ? (
        <PrepaidDepleteModal
          purchases={prepaidPurchases.map(p => {
            const promo = prepaidPromotions.find(pr => pr.id === p.posPromotionId)
            return {
              id: p.id,
              customerName: p.customerName,
              customerMobile: p.customerMobile,
              promotionName: p.promotionName,
              productName: p.productName,
              balanceRemaining: p.balanceRemaining,
              packageUom: p.packageUom,
              packageQty: p.packageQty,
              depletionMethod: promo?.depletionMethod,
              depletionUnits: promo?.depletionUnits,
            }
          })}
          busy={prepaidDepleteBusy}
          error={prepaidDepleteError}
          onCancel={() => {
            if (prepaidDepleteBusy) return
            setPrepaidDepleteOpen(false)
            setPrepaidDepleteError(null)
          }}
          onConfirm={(payload) => { void confirmPrepaidDeplete(payload) }}
        />
      ) : null}

      {toast && (
        <div className="register__toast" role="status">
          {charging ? 'Recording sale…' : toast}
        </div>
      )}
    </div>
  )
}
