import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import {
  canApproveOperatorOrder,
  canCancelOperatorOrder,
  canConsolidateOperatorOrder,
  canCreateOperatorOrder,
  canEditProcurementPrice,
  canReceiveOperatorOrder,
  canViewOperatorOrders,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  approveOperatorOrder,
  cancelOperatorOrder,
  consolidateOperatorOrder,
  getIngredientVendors,
  getOperatorOrder,
  issueOperatorOrder,
  listOperatorOrders,
  orderSummaryToDetail,
  receiveOperatorOrderWithAmendments,
  rejectOperatorOrder,
  searchOperatorIngredients,
  updateOperatorOrderQuantity,
} from '../../api/operatorOrders'
import { DeliveryQrModal } from '../../components/DeliveryQrModal'
import {
  LineChargesModal,
  sumLineDiscounts,
  sumLineTaxes,
} from '../../components/LineChargesModal'
import { OrderDetailView } from '../../components/OrderDetail'
import type { OrderTotalsValues } from '../../components/OrderTotalsBox'
import {
  deliveryUomOf,
  ProductMeta,
  recipeUomOf,
} from '../../components/ProductMeta'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  buildOrderDocumentShareUrl,
  buildPoPdfShareMessage,
  isCloudPoDetailUrl,
  isShortShareUrl,
} from '../../utils/poShareLink'
import type {
  Ingredient,
  OrderDetail,
  OrderLine,
  OrderSummary,
} from '../../types'

type ListChip = 'active' | 'received' | 'consolidated'

function patchOrderStatus(
  qc: ReturnType<typeof useQueryClient>,
  orderId: number,
  token: string | null,
  nextStatus: string,
  summary?: OrderSummary | null,
  targetChip: ListChip = 'active',
  seedDetail?: OrderDetail | null,
) {
  qc.setQueryData<OrderDetail>(['operator-order', orderId, token], (prev) => {
    const base =
      prev ||
      seedDetail ||
      (summary ? orderSummaryToDetail({ ...summary, status: nextStatus }) : null)
    if (!base) return prev
    return {
      ...base,
      status: nextStatus,
      allowApproveOrReject: false,
      allowCancel:
        nextStatus === 'Submitted' ||
        nextStatus === 'WaitingForAccepted' ||
        nextStatus === 'Approved' ||
        nextStatus === 'Requested',
    }
  })

  const moved: OrderSummary = {
    id: orderId,
    purchaseOrderNumber: summary?.purchaseOrderNumber,
    createdOn: summary?.createdOn,
    outletName: summary?.outletName,
    vendorName: summary?.vendorName,
    operatorCompanyName: summary?.operatorCompanyName,
    total: summary?.total,
    grandTotal: summary?.grandTotal,
    isVirtualVendor: summary?.isVirtualVendor,
    status: nextStatus,
    orderStatus: nextStatus,
  }

  for (const chip of ['toApprove', 'active', 'received', 'consolidated'] as const) {
    qc.setQueriesData<{ orders: OrderSummary[]; totalCount?: number }>(
      { queryKey: ['operator-orders', chip] },
      (prev) => {
        if (!prev?.orders) return prev
        const orders = prev.orders.filter((o) => o.id !== orderId)
        return { ...prev, orders, totalCount: orders.length }
      },
    )
  }

  qc.setQueriesData<{ orders: OrderSummary[]; totalCount?: number }>(
    { queryKey: ['operator-orders', targetChip] },
    (prev) => {
      const rest = (prev?.orders || []).filter((o) => o.id !== orderId)
      const orders = [moved, ...rest]
      return { orders, totalCount: Math.max(prev?.totalCount ?? 0, orders.length) }
    },
  )

  return moved
}

function ensureOrderInChipCache(
  qc: ReturnType<typeof useQueryClient>,
  chip: ListChip,
  moved: OrderSummary,
) {
  qc.setQueriesData<{ orders: OrderSummary[]; totalCount?: number }>(
    { queryKey: ['operator-orders', chip] },
    (prev) => {
      const existing = prev?.orders || []
      const without = existing.filter((o) => o.id !== moved.id)
      const orders = [{ ...moved }, ...without]
      return {
        orders,
        totalCount: Math.max(prev?.totalCount ?? 0, orders.length),
      }
    },
  )
}

function normalizeStatus(status?: string) {
  return (status || '').toLowerCase().replace(/\s+/g, '')
}

function lineQty(line: OrderLine) {
  return Number(line.productQuantity ?? 0)
}

/** True when every line is qty 0 — treat as cancelling the order. */
function allQtysZero(lines: OrderLine[]) {
  return lines.length > 0 && lines.every((l) => lineQty(l) <= 0)
}

export function OperatorOrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { token, hasPermission } = useAuth()
  const { selectedLocationId } = useLocationFilter()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const [editableLines, setEditableLines] = useState<OrderLine[]>([])
  const [extraProductIds, setExtraProductIds] = useState<number[]>([])
  const [orderTotals, setOrderTotals] = useState<OrderTotalsValues>({
    discount: 0,
    deliveryCharge: 0,
    rounding: 0,
    tax: 0,
  })
  const [shareLink, setShareLink] = useState('')
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [addKeyword, setAddKeyword] = useState('')
  const [addSearchNeedle, setAddSearchNeedle] = useState('')
  const [addMessage, setAddMessage] = useState<string | null>(null)
  const [chargesLine, setChargesLine] = useState<OrderLine | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [showDeliveryQr, setShowDeliveryQr] = useState(false)
  /** After Confirm Received, Bypass closes QR then finishes navigation / stay. */
  const [pendingAfterReceive, setPendingAfterReceive] = useState<
    'stay' | 'navigate' | null
  >(null)

  const canReceivePerm = canReceiveOperatorOrder(hasPermission)
  const canConsolidatePerm = canConsolidateOperatorOrder(hasPermission)
  const canIssuePerm = canCreateOperatorOrder(hasPermission)
  const canEditPrice = canEditProcurementPrice(hasPermission)
  const canApprovePerm = canApproveOperatorOrder(hasPermission)
  const canCancelPerm = canCancelOperatorOrder(hasPermission)
  const canViewOrder = canViewOperatorOrders(hasPermission)

  const summaryFromNav = (location.state as { order?: OrderSummary } | null)?.order

  const summaryFromCache = (() => {
    const cached = qc.getQueriesData<{ orders: OrderSummary[] }>({
      queryKey: ['operator-orders'],
    })
    for (const [, data] of cached) {
      const found = data?.orders?.find((o) => o.id === orderId)
      if (found) return found
    }
    return undefined
  })()

  const listSummary =
    summaryFromNav?.id === orderId ? summaryFromNav : summaryFromCache

  const query = useQuery({
    queryKey: ['operator-order', orderId, token],
    enabled: !!token && Number.isFinite(orderId),
    queryFn: () => getOperatorOrder(token!, orderId),
    retry: 2,
    refetchOnMount: 'always',
    refetchInterval: (q) => {
      const s = normalizeStatus(q.state.data?.status)
      return s === 'waitingforaccepted' ||
        s === 'submitted' ||
        s === 'submittedwithchanges' ||
        s === 'viewed'
        ? 8000
        : false
    },
  })

  const summaryFallback: OrderDetail | null = listSummary
    ? orderSummaryToDetail(listSummary)
    : null

  const order: OrderDetail | null = query.data ?? summaryFallback
  const lineCount = order?.orderDetails?.length ?? 0
  const waitingForLines = query.isFetching && lineCount === 0
  const detailFailed = query.isError && !query.isFetching && lineCount === 0

  const status = normalizeStatus(order?.status)
  // Approve/Reject only while Requested — ignore stale allowApproveOrReject
  // flags that the API may still return after approval.
  const canApproveReject =
    canApprovePerm &&
    status === 'requested' &&
    (order?.allowApproveOrReject == null || order.allowApproveOrReject)
  const canIssue = status === 'approved' && canIssuePerm
  // PDF share unlocks only after Issue (Submitted+) — not while still Approved.
  const canShare =
    status === 'submitted' ||
    status === 'submittedwithchanges' ||
    status === 'viewed' ||
    status === 'waitingforaccepted' ||
    status === 'accepted' ||
    status === 'toship'
  const canShareAction = canShare || canIssue
  const canReceiveOrReject =
    canReceivePerm && (status === 'accepted' || status === 'toship')
  // Received list detail often arrives as Delivered from the API — treat alike.
  const canConsolidate =
    canConsolidatePerm &&
    (status === 'received' || status === 'delivered')
  const canShowDriverQr =
    status === 'accepted' ||
    status === 'toship' ||
    status === 'received' ||
    status === 'delivered' ||
    status === 'consolidated' ||
    showDeliveryQr

  /** Active PO before / at delivery — add lines and adjust qty. */
  const isActiveAmendStatus =
    status === 'approved' ||
    status === 'submitted' ||
    status === 'submittedwithchanges' ||
    status === 'waitingforaccepted' ||
    status === 'viewed' ||
    status === 'accepted' ||
    status === 'toship'

  const canAmendActive =
    isActiveAmendStatus && (canIssuePerm || canReceivePerm)

  /**
   * Purchase request (Requested): approvers, or creators with issue rights.
   * Users without issue authority may change quantity only (not price).
   */
  const canAmendPurchaseRequest =
    status === 'requested' && (canApproveReject || canIssuePerm)

  const linesEditable =
    canReceiveOrReject ||
    canConsolidate ||
    canAmendPurchaseRequest ||
    canAmendActive

  /** Price locked on purchase request when the user cannot Issue PO. */
  const allowPriceEdit =
    linesEditable &&
    !(canAmendPurchaseRequest && !canIssuePerm) &&
    (canEditPrice || canReceiveOrReject || canConsolidate || canIssuePerm)

  const allowAddItem =
    canReceiveOrReject ||
    canConsolidate ||
    canAmendPurchaseRequest ||
    canAmendActive

  const totalsSeedKey = useRef('')

  useEffect(() => {
    if (status !== 'accepted' && status !== 'toship') return
    void qc.invalidateQueries({ queryKey: ['operator-orders'] })
  }, [status, qc])

  useEffect(() => {
    setExtraProductIds([])
    setShowAddItem(false)
    setAddKeyword('')
    setAddSearchNeedle('')
    setAddMessage(null)
    setChargesLine(null)
    setInvoiceNumber('')
    totalsSeedKey.current = ''
  }, [orderId])

  useEffect(() => {
    const source = query.data?.orderDetails
    if (!source) {
      setEditableLines([])
      return
    }
    const extras = new Set(extraProductIds)
    setEditableLines((prev) => {
      const prevById = new Map(
        prev
          .filter((l) => l.orderDetailId != null)
          .map((l) => [l.orderDetailId as number, l]),
      )
      const prevByProduct = new Map(
        prev
          .filter((l) => l.productId != null)
          .map((l) => [Number(l.productId), l]),
      )
      return source.map((l) => {
        const local =
          (l.orderDetailId != null ? prevById.get(l.orderDetailId) : undefined) ||
          (l.productId != null ? prevByProduct.get(Number(l.productId)) : undefined)
        const qty = local?.productQuantity ?? l.productQuantity
        const price = local?.productPrice ?? l.productPrice
        return {
          ...l,
          productQuantity: qty,
          productPrice: price,
          subtotal:
            local?.subtotal ??
            (qty != null && price != null ? Number(qty) * Number(price) : l.subtotal),
          discount: local?.discount ?? l.discount,
          tax: local?.tax ?? l.tax,
          isExtra:
            !!local?.isExtra ||
            (l.productId != null && extras.has(Number(l.productId))),
        }
      })
    })
  }, [query.data, extraProductIds])

  // Re-seed totals when opening an order or when status changes (e.g. after
  // Receive → consolidate). Do not overwrite while the user is editing.
  useEffect(() => {
    const detail = query.data
    if (!detail) return
    const key = `${detail.id}:${normalizeStatus(detail.status)}`
    if (totalsSeedKey.current === key) return
    totalsSeedKey.current = key
    const lines = detail.orderDetails || []
    const fromLinesDiscount = sumLineDiscounts(lines)
    const fromLinesTax = sumLineTaxes(lines)
    setOrderTotals({
      discount:
        fromLinesDiscount > 0
          ? fromLinesDiscount
          : Number(detail.totalDiscount ?? 0) || 0,
      deliveryCharge: Number(detail.deliveryCharge ?? 0) || 0,
      rounding: Number(detail.rounding ?? 0) || 0,
      tax:
        fromLinesTax > 0 ? fromLinesTax : Number(detail.tax ?? 0) || 0,
    })
  }, [query.data])

  const outletIdForSearch =
    order?.outletId ?? selectedLocationId ?? undefined

  const vendorsQuery = useQuery({
    queryKey: ['operator-ingredient-vendors', outletIdForSearch, token],
    enabled:
      !!token && !!outletIdForSearch && showAddItem && allowAddItem,
    staleTime: 60_000,
    queryFn: () => getIngredientVendors(token!, outletIdForSearch!),
  })

  const resolvedVendorId = useMemo(() => {
    if (order?.vendorId != null) return order.vendorId
    const name = (order?.vendorName || order?.supplier || '')
      .trim()
      .toLowerCase()
    if (!name) return null
    const match = (vendorsQuery.data || []).find(
      (v) => (v.name || '').trim().toLowerCase() === name,
    )
    return match?.id ?? null
  }, [order?.vendorId, order?.vendorName, order?.supplier, vendorsQuery.data])

  const addProductsQuery = useQuery({
    queryKey: [
      'receive-add-products',
      outletIdForSearch,
      resolvedVendorId,
      addSearchNeedle,
      token,
    ],
    enabled:
      !!token &&
      !!outletIdForSearch &&
      showAddItem &&
      addSearchNeedle.length >= 0,
    queryFn: () =>
      searchOperatorIngredients(token!, {
        outletId: outletIdForSearch!,
        keyword: addSearchNeedle,
        vendorIds: resolvedVendorId != null ? [resolvedVendorId] : null,
        pageIndex: 1,
        pageSize: 40,
      }),
  })

  function workingLines() {
    return editableLines.length > 0
      ? editableLines
      : order?.orderDetails || []
  }

  /** Qty 0 = skip that product; only cancel when every line is zeroed. */
  const willCancelFromQtys = allQtysZero(workingLines())

  /** Persist qty/price (and newly added products). Used before Approve/Issue.
   *  Receive/Consolidate must NOT use this — UpdateQuantity often fails on
   *  Accepted/ToShip; DeliveryOrder carries amendments instead (Flutter). */
  async function syncLinesToServer(lines: OrderLine[]) {
    await updateOperatorOrderQuantity(token!, orderId, lines)
    const refreshed = await getOperatorOrder(token!, orderId)
    qc.setQueryData(['operator-order', orderId, token], refreshed)
    const extras = new Set(extraProductIds)
    const merged = (refreshed.orderDetails || []).map((l) => {
      const local = lines.find(
        (x) =>
          (x.orderDetailId != null &&
            l.orderDetailId != null &&
            x.orderDetailId === l.orderDetailId) ||
          (x.productId != null &&
            l.productId != null &&
            Number(x.productId) === Number(l.productId)),
      )
      const qty = local?.productQuantity ?? l.productQuantity
      const price = local?.productPrice ?? l.productPrice
      return {
        ...l,
        productQuantity: qty,
        productPrice: price,
        subtotal:
          qty != null && price != null
            ? Number(qty) * Number(price)
            : l.subtotal,
        discount: local?.discount ?? l.discount,
        tax: local?.tax ?? l.tax,
        isExtra:
          !!local?.isExtra ||
          (l.productId != null && extras.has(Number(l.productId))),
      }
    })
    setEditableLines(merged)
    return merged
  }

  /**
   * Receive/Consolidate: never call UpdateQuantity (fails on Accepted/ToShip/
   * Received). Refresh detail for line ids, then overlay local qty/price/charges.
   */
  async function linesForDeliveryAction(): Promise<OrderLine[]> {
    const local = workingLines()
    const unsaved = local.filter(
      (l) =>
        l.orderDetailId == null &&
        (l.productId != null || l.ingredientId != null),
    )
    if (unsaved.length > 0) {
      throw new Error(
        'New products are still saving. Wait a moment, or remove unsaved extras and use + Add Item again.',
      )
    }

    const refreshed = await getOperatorOrder(token!, orderId)
    qc.setQueryData(['operator-order', orderId, token], refreshed)
    const serverLines = refreshed.orderDetails || []
    if (serverLines.length === 0) {
      throw new Error('No line items available — reload this PO and try again')
    }

    const extras = new Set(extraProductIds)
    const merged = serverLines.map((l) => {
      const match = local.find(
        (x) =>
          (x.orderDetailId != null &&
            l.orderDetailId != null &&
            Number(x.orderDetailId) === Number(l.orderDetailId)) ||
          (x.productId != null &&
            l.productId != null &&
            Number(x.productId) === Number(l.productId)),
      )
      const qty = match?.productQuantity ?? l.productQuantity
      const price = match?.productPrice ?? l.productPrice
      return {
        ...l,
        productQuantity: qty,
        productPrice: price,
        subtotal:
          qty != null && price != null
            ? Number(qty) * Number(price)
            : l.subtotal,
        discount: match?.discount ?? l.discount,
        tax: match?.tax ?? l.tax,
        isExtra:
          !!match?.isExtra ||
          (l.productId != null && extras.has(Number(l.productId))),
      }
    })

    const withIds = merged.filter(
      (l) => l.orderDetailId != null && Number(l.orderDetailId) > 0,
    )
    if (withIds.length === 0) {
      throw new Error(
        'Line detail ids missing from the API — reload this PO and try again',
      )
    }

    setEditableLines(merged)
    return withIds
  }

  function updateLineQty(orderDetailId: number, quantity: number) {
    setEditableLines((prev) =>
      prev.map((line) => {
        if (line.orderDetailId !== orderDetailId) return line
        const price = Number(line.productPrice ?? 0)
        return {
          ...line,
          productQuantity: quantity,
          subtotal: price * quantity,
        }
      }),
    )
  }

  // Active POs after Issue (waiting/submitted) — persist qty locally.
  // Do not live-sync Accepted/ToShip — receive uses DeliveryOrder instead.
  const lineSyncGen = useRef(0)
  useEffect(() => {
    const shouldLiveSync =
      linesEditable &&
      canAmendActive &&
      status !== 'accepted' &&
      status !== 'toship' &&
      !canApproveReject &&
      !canIssue &&
      !canReceiveOrReject &&
      !canConsolidate
    if (!shouldLiveSync || !token || editableLines.length === 0) return
    const gen = ++lineSyncGen.current
    const timer = window.setTimeout(() => {
      if (gen !== lineSyncGen.current) return
      void updateOperatorOrderQuantity(token, orderId, editableLines).catch(
        () => undefined,
      )
    }, 700)
    return () => window.clearTimeout(timer)
  }, [
    editableLines,
    linesEditable,
    canAmendActive,
    status,
    canApproveReject,
    canIssue,
    canReceiveOrReject,
    canConsolidate,
    token,
    orderId,
  ])

  function runPrimaryAction(
    action: 'approve' | 'issue' | 'receive' | 'consolidate',
  ) {
    if (willCancelFromQtys) {
      cancel.mutate()
      return
    }
    if (action === 'approve') approve.mutate()
    else if (action === 'issue') issue.mutate()
    else if (action === 'receive') receive.mutate()
    else consolidate.mutate()
  }

  function updateLinePrice(orderDetailId: number, price: number) {
    if (!allowPriceEdit) return
    setEditableLines((prev) =>
      prev.map((line) => {
        if (line.orderDetailId !== orderDetailId) return line
        const qty = Number(line.productQuantity ?? 0)
        return {
          ...line,
          productPrice: price,
          subtotal: qty * price,
        }
      }),
    )
  }

  function matchEditableLine(a: OrderLine, b: OrderLine) {
    if (
      a.orderDetailId != null &&
      b.orderDetailId != null &&
      Number(a.orderDetailId) === Number(b.orderDetailId)
    ) {
      return true
    }
    return (
      a.productId != null &&
      b.productId != null &&
      Number(a.productId) === Number(b.productId)
    )
  }

  function applyLineCharges(
    target: OrderLine,
    next: { discount: number; tax: number },
  ) {
    setEditableLines((prev) => {
      const updated = prev.map((line) =>
        matchEditableLine(line, target)
          ? { ...line, discount: next.discount, tax: next.tax }
          : line,
      )
      setOrderTotals((totals) => ({
        ...totals,
        discount: sumLineDiscounts(updated),
        tax: sumLineTaxes(updated),
      }))
      return updated
    })
    setChargesLine(null)
    setShareMessage('Line discount/tax applied — Total Order updated.')
  }

  function currentOrderSummary(nextStatus: string): OrderSummary | null {
    return (
      listSummary ||
      (order
        ? {
            id: order.id,
            purchaseOrderNumber: order.poNumber,
            createdOn: order.poDate,
            outletName: order.outletName,
            vendorName: order.vendorName || order.supplier,
            total: order.total,
            grandTotal: order.grandTotal,
            status: nextStatus,
          }
        : null)
    )
  }

  /** Oldest Requested PO still waiting (same queue order as Home → To Approve). */
  async function findNextRequestedPoId(
    excludeId: number,
  ): Promise<number | null> {
    if (!token) return null
    try {
      const result = await listOperatorOrders(token, ['Requested'], 1, 50)
      const sorted = [...result.orders].sort((a, b) => {
        const aTime = Date.parse(a.createdOn || '') || 0
        const bTime = Date.parse(b.createdOn || '') || 0
        if (aTime !== bTime) return aTime - bTime
        return a.id - b.id
      })
      return sorted.find((o) => o.id !== excludeId)?.id ?? null
    } catch {
      return null
    }
  }

  async function afterStatusChange(
    nextStatus: string,
    targetChip: ListChip = 'active',
  ) {
    const summary = currentOrderSummary(nextStatus)

    await qc.resetQueries({ queryKey: ['operator-order', orderId, token] })

    const moved = patchOrderStatus(
      qc,
      orderId,
      token,
      nextStatus,
      summary,
      targetChip,
      order,
    )

    qc.setQueryData(['operator-orders-pin', targetChip], moved)

    void qc.prefetchQuery({
      queryKey: ['operator-order', orderId, token],
      queryFn: () => getOperatorOrder(token!, orderId),
    })

    await qc.invalidateQueries({ queryKey: ['operator-orders'] })
    await qc.refetchQueries({ queryKey: ['operator-orders', targetChip] })
    ensureOrderInChipCache(qc, targetChip, moved)

    const tab =
      targetChip === 'received'
        ? 'received'
        : targetChip === 'consolidated'
          ? 'consolidated'
          : 'active'
    navigate(
      `/operator?tab=${tab}&changed=${encodeURIComponent(nextStatus)}&id=${orderId}`,
      { replace: true },
    )
  }

  /**
   * After Approve: open the next Requested PO. When the queue is empty,
   * land on Active PO (approved orders live there for Issue / share).
   */
  async function afterApproveContinueQueue() {
    const summary = currentOrderSummary('Approved')
    await qc.resetQueries({ queryKey: ['operator-order', orderId, token] })
    const moved = patchOrderStatus(
      qc,
      orderId,
      token,
      'Approved',
      summary,
      'active',
      order ? { ...order, status: 'Approved' } : null,
    )
    qc.setQueryData(['operator-orders-pin', 'active'], moved)
    await qc.invalidateQueries({ queryKey: ['operator-orders'] })
    ensureOrderInChipCache(qc, 'active', moved)

    const nextId = await findNextRequestedPoId(orderId)
    if (nextId != null) {
      void qc.prefetchQuery({
        queryKey: ['operator-order', nextId, token],
        queryFn: () => getOperatorOrder(token!, nextId),
      })
      navigate(`/operator/orders/${nextId}`, { replace: true })
      return
    }

    navigate(
      `/operator?tab=active&changed=${encodeURIComponent('Approved')}&id=${orderId}`,
      { replace: true },
    )
  }

  const approve = useMutation({
    mutationFn: async () => {
      // Persist newly added products (UpdateQuantity) before Approve amendments.
      const lines = await syncLinesToServer(workingLines())
      await approveOperatorOrder(token!, orderId, lines)
    },
    onSuccess: async () => {
      await afterApproveContinueQueue()
    },
  })

  const issue = useMutation({
    mutationFn: async () => {
      const lines = await syncLinesToServer(workingLines())
      await issueOperatorOrder(token!, orderId, lines)
    },
    onSuccess: async () => {
      const refreshed = await getOperatorOrder(token!, orderId).catch(() => null)
      // Always treat local status as issued after a successful Issue call —
      // refetch can lag or omit orderStatus and would leave PDF share disabled.
      const issuedDetail: OrderDetail = {
        ...(refreshed || (order as OrderDetail)),
        status: refreshed?.status || 'WaitingForAccepted',
        allowApproveOrReject: false,
        allowCancel: true,
      }
      // Normalize spaced API values like "Waiting For Accepted"
      if (normalizeStatus(issuedDetail.status) === 'waitingforaccepted') {
        issuedDetail.status = 'WaitingForAccepted'
      }
      qc.setQueryData(['operator-order', orderId, token], issuedDetail)
      patchOrderStatus(
        qc,
        orderId,
        token,
        'WaitingForAccepted',
        listSummary || {
          id: orderId,
          purchaseOrderNumber: order?.poNumber,
          status: 'WaitingForAccepted',
        },
        'active',
        issuedDetail,
      )
      await qc.invalidateQueries({ queryKey: ['operator-orders'] })

      // Prefer short durable /s/:id links — Cloud PODetail keys expire.
      let link = ''
      try {
        link = await buildOrderDocumentShareUrl(issuedDetail, 'po')
      } catch {
        /* user can still tap Copy link */
      }
      setShareLink(link)
      setShareMessage(
        link
          ? 'Issued. Copy the PDF link or send via WhatsApp to the vendor.'
          : 'Issued. Use Copy link or WhatsApp to send this PO to the vendor.',
      )
    },
  })

  const rejectRequested = useMutation({
    mutationFn: () => rejectOperatorOrder(token!, orderId, '', 'disapprove'),
    onSuccess: async () => {
      await afterStatusChange('Disapproved')
    },
  })

  const rejectActive = useMutation({
    mutationFn: () => rejectOperatorOrder(token!, orderId, '', 'reject'),
    onSuccess: async () => {
      await afterStatusChange('Rejected')
    },
  })

  const receive = useMutation({
    mutationFn: async () => {
      // Do not call UpdateQuantity — it fails on Accepted/ToShip/Received on UAT.
      // DeliveryOrder carries qty/price/discount/tax amendments (Flutter path).
      const lines = await linesForDeliveryAction()
      await receiveOperatorOrderWithAmendments(token!, orderId, lines, '', {
        tax: orderTotals.tax,
        discount: orderTotals.discount,
        rounding: orderTotals.rounding,
        deliveryCharge: orderTotals.deliveryCharge,
      })
    },
    onSuccess: async () => {
      await qc.resetQueries({ queryKey: ['operator-order', orderId, token] })
      patchOrderStatus(
        qc,
        orderId,
        token,
        'Received',
        listSummary || {
          id: orderId,
          purchaseOrderNumber: order?.poNumber,
          status: 'Received',
        },
        'received',
        order ? { ...order, status: 'Received' } : null,
      )
      const refreshed = await getOperatorOrder(token!, orderId).catch(() => null)
      if (refreshed) {
        qc.setQueryData(['operator-order', orderId, token], {
          ...refreshed,
          status: 'Received',
        })
      }
      await qc.invalidateQueries({ queryKey: ['operator-orders'] })
      setPendingAfterReceive(canConsolidatePerm ? 'stay' : 'navigate')
      setShowDeliveryQr(true)
      setShareMessage(
        'Delivery confirmed. Show the QR to the delivery person, then Bypass.',
      )
    },
  })

  async function finishAfterReceiveQr() {
    setShowDeliveryQr(false)
    const next = pendingAfterReceive
    setPendingAfterReceive(null)
    if (next === 'navigate') {
      await afterStatusChange('Received', 'received')
      return
    }
    if (next === 'stay') {
      setShareMessage(
        'Received. Consolidate to add items to stock and move to Consolidated.',
      )
    }
  }

  const consolidate = useMutation({
    mutationFn: async () => {
      if (order?.isVirtualVendor && !invoiceNumber.trim()) {
        throw new Error('Invoice number is required for virtual vendor POs')
      }
      const lines = await linesForDeliveryAction()
      await consolidateOperatorOrder(token!, orderId, lines, {
        tax: orderTotals.tax,
        discount: orderTotals.discount,
        rounding: orderTotals.rounding,
        deliveryCharge: orderTotals.deliveryCharge,
        customInvoiceNo: invoiceNumber.trim() || undefined,
      })
    },
    onSuccess: async () => {
      // Backend posts consolidated qty into ingredient on-hand stock.
      await qc.invalidateQueries({ queryKey: ['operator-ingredients'] })
      await afterStatusChange('Consolidated', 'consolidated')
    },
  })

  const addExtraItem = useMutation({
    mutationFn: async (product: Ingredient) => {
      const productId = product.productId ?? product.ingredientId
      if (productId == null) throw new Error('Product id missing')
      const already = workingLines().some(
        (l) =>
          (l.productId != null && Number(l.productId) === Number(productId)) ||
          (l.ingredientId != null &&
            product.ingredientId != null &&
            Number(l.ingredientId) === Number(product.ingredientId)),
      )
      if (already) throw new Error('Product is already on this order')

      const price = Number(product.price ?? 0) || 0
      const nextLines: OrderLine[] = [
        ...workingLines(),
        {
          productId: product.productId,
          ingredientId: product.ingredientId,
          productName: product.productName || product.name,
          ingredientName: product.ingredientName,
          productQuantity: 1,
          productPrice: price,
          subtotal: price,
          productType: product.type,
          deliveryPackage: product.deliveryPackage || product.uom,
          uom: product.uom || product.deliveryPackage,
          recipeUom: product.recipeUom || product.recipeUnit,
          parStock: product.parStock,
          onHandQuantity: product.onHandQuantity ?? product.quantityOnHand,
          isExtra: true,
        },
      ]
      await updateOperatorOrderQuantity(token!, orderId, nextLines)
      const refreshed = await getOperatorOrder(token!, orderId)
      return { refreshed, productId: Number(product.productId ?? productId) }
    },
    onSuccess: ({ refreshed, productId }) => {
      setExtraProductIds((prev) =>
        prev.includes(productId) ? prev : [...prev, productId],
      )
      qc.setQueryData(['operator-order', orderId, token], refreshed)
      setShowAddItem(false)
      setAddKeyword('')
      setAddSearchNeedle('')
      setAddMessage(null)
      setShareMessage(
        canReceiveOrReject || canConsolidate
          ? 'Extra product added — adjust qty/price before confirming.'
          : allowPriceEdit
            ? 'Extra product added — adjust qty/price as needed.'
            : 'Extra product added — adjust quantity as needed.',
      )
    },
    onError: (err) => setAddMessage((err as Error).message),
  })

  const cancel = useMutation({
    mutationFn: () => cancelOperatorOrder(token!, orderId),
    onSuccess: async () => {
      await afterStatusChange('Cancelled')
    },
  })

  async function resolveShortLink() {
    if (!token) throw new Error('Not signed in')
    const detail = order
    if (!detail) throw new Error('Order is still loading')
    // The initiator can act directly from the approval notice. If the PO is
    // Approved but not yet issued, issue it before creating the vendor link.
    if (status === 'approved' && canIssuePerm) {
      await issue.mutateAsync()
    }
    const latest =
      (qc.getQueryData(['operator-order', orderId, token]) as
        | OrderDetail
        | undefined) || detail
    if (shareLink && isShortShareUrl(shareLink) && !isCloudPoDetailUrl(shareLink)) {
      return shareLink
    }
    const link = await buildOrderDocumentShareUrl(latest, 'po')
    setShareLink(link)
    return link
  }

  async function copyLink() {
    setShareMessage(null)
    try {
      const link = await resolveShortLink()
      try {
        await navigator.clipboard.writeText(link)
        setShareMessage('PDF link copied — send it to the vendor')
      } catch {
        setShareMessage('Link ready — copy it below')
      }
    } catch (err) {
      setShareMessage((err as Error).message || 'Failed to create PO link')
    }
  }

  async function forwardWhatsApp() {
    setShareMessage(null)
    try {
      const link = await resolveShortLink()
      const text = buildPoPdfShareMessage({
        poNumber: order?.poNumber,
        orderId,
        link,
        kind: 'po',
      })
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      setShareMessage('WhatsApp opened with the PDF link')
    } catch (err) {
      setShareMessage((err as Error).message || 'Failed to open WhatsApp')
    }
  }

  if (!canViewOrder) {
    return (
      <div className="stack">
        <PermissionDenied
          title="Order unavailable"
          message="Your account does not have permission to view this order."
        />
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    )
  }

  if (!order && query.isLoading) {
    return <p className="muted">Loading order…</p>
  }

  if (!order) {
    return (
      <div className="stack">
        <p className="error-text">
          {(query.error as Error)?.message || 'Order not found'}
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    )
  }

  const busy =
    approve.isPending ||
    issue.isPending ||
    rejectRequested.isPending ||
    rejectActive.isPending ||
    receive.isPending ||
    consolidate.isPending ||
    cancel.isPending ||
    addExtraItem.isPending

  const actionError =
    approve.error ||
    issue.error ||
    rejectRequested.error ||
    rejectActive.error ||
    receive.error ||
    consolidate.error ||
    cancel.error

  const displayStatus = normalizeStatus(order.status)

  return (
    <div className="stack">
      <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {waitingForLines && (
        <p className="muted" style={{ margin: 0 }}>
          Loading line items…
        </p>
      )}

      {detailFailed && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="error-text" style={{ margin: 0 }}>
            Line items unavailable — the detail API failed for this PO.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            {query.isFetching ? 'Retrying…' : 'Retry loading lines'}
          </button>
        </div>
      )}

      <OrderDetailView
        order={order}
        lines={linesEditable ? editableLines : order.orderDetails}
        editableLines={linesEditable}
        onLineQtyChange={updateLineQty}
        onLinePriceChange={allowPriceEdit ? updateLinePrice : undefined}
        totals={orderTotals}
        totalsEditable={canReceiveOrReject || canConsolidate}
        onTotalsChange={setOrderTotals}
        allowAddItem={allowAddItem}
        onAddItem={() => {
          setAddMessage(null)
          setAddKeyword('')
          setAddSearchNeedle('')
          setShowAddItem(true)
        }}
        allowLineChargesEdit={canReceiveOrReject || canConsolidate}
        onEditLineCharges={(line) => setChargesLine(line)}
        actions={
          <div className="stack" style={{ gap: 10 }}>
            <div className="actions">
              {canApproveReject && (
                <>
                  <button
                    type="button"
                    className={willCancelFromQtys ? 'btn btn-danger' : 'btn btn-primary'}
                    disabled={busy}
                    onClick={() => runPrimaryAction('approve')}
                  >
                    {cancel.isPending && willCancelFromQtys
                      ? 'Cancelling…'
                      : approve.isPending
                        ? 'Approving…'
                        : willCancelFromQtys
                          ? 'Cancel order'
                          : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => rejectRequested.mutate()}
                  >
                    {rejectRequested.isPending ? 'Rejecting…' : 'Reject'}
                  </button>
                </>
              )}

              {canIssue && (
                <button
                  type="button"
                  className={willCancelFromQtys ? 'btn btn-danger' : 'btn btn-primary'}
                  disabled={busy}
                  onClick={() => runPrimaryAction('issue')}
                >
                  {cancel.isPending && willCancelFromQtys
                    ? 'Cancelling…'
                    : issue.isPending
                      ? 'Issuing…'
                      : willCancelFromQtys
                        ? 'Cancel order'
                        : 'Issue PO'}
                </button>
              )}

              {canIssue && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  {willCancelFromQtys
                    ? 'All quantities are 0 — this will cancel the order.'
                    : 'Use + Add Item or adjust qty before Issue. Issue unlocks Copy link and WhatsApp for the vendor. Qty 0 skips a product without cancelling.'}
                </p>
              )}

              {canReceiveOrReject && (
                <>
                  <button
                    type="button"
                    className={willCancelFromQtys ? 'btn btn-danger' : 'btn btn-primary'}
                    disabled={busy || editableLines.length === 0}
                    onClick={() => runPrimaryAction('receive')}
                  >
                    {cancel.isPending && willCancelFromQtys
                      ? 'Cancelling…'
                      : receive.isPending
                        ? 'Confirming…'
                        : willCancelFromQtys
                          ? 'Cancel order'
                          : 'Confirm Received'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => rejectActive.mutate()}
                  >
                    {rejectActive.isPending ? 'Rejecting…' : 'Reject'}
                  </button>
                </>
              )}

              {canConsolidate && (
                <button
                  type="button"
                  className={willCancelFromQtys ? 'btn btn-danger' : 'btn btn-primary'}
                  disabled={
                    busy ||
                    workingLines().length === 0 ||
                    (!!order.isVirtualVendor && !invoiceNumber.trim())
                  }
                  onClick={() => runPrimaryAction('consolidate')}
                >
                  {cancel.isPending && willCancelFromQtys
                    ? 'Cancelling…'
                    : consolidate.isPending
                      ? 'Consolidating…'
                      : willCancelFromQtys
                        ? 'Cancel order'
                        : 'Consolidate'}
                </button>
              )}

              {canConsolidate && order.isVirtualVendor && (
                <label className="field" style={{ flexBasis: '100%', margin: 0 }}>
                  <span>Invoice number (required)</span>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Vendor invoice / DO number"
                    disabled={busy}
                    autoComplete="off"
                  />
                </label>
              )}

              {canConsolidate && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  {willCancelFromQtys
                    ? 'All quantities are 0 — this will cancel the order.'
                    : order.isVirtualVendor
                      ? 'Enter the vendor invoice number, adjust discount/tax if needed, then Consolidate to post stock.'
                      : 'Use Edit on lines for discount/tax, or edit Total Order above, then Consolidate to post stock.'}
                </p>
              )}

              {canShowDriverQr && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setPendingAfterReceive(null)
                    setShowDeliveryQr(true)
                  }}
                >
                  Show Driver QR
                </button>
              )}

              {canShowDriverQr && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  Delivery QR uses ORDER_{orderId} — scan from the delivery app.
                </p>
              )}

              {canReceiveOrReject && !willCancelFromQtys && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  Use Edit on a line for discount/tax (totals update
                  automatically). You can also edit delivery, rounding, and
                  order-level discount/tax in Total Order above before confirming
                  received.
                </p>
              )}

              {canApproveReject && willCancelFromQtys && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  All quantities are 0 — this will cancel the order. Set qty above
                  0 on at least one product to approve.
                </p>
              )}

              {canReceiveOrReject && willCancelFromQtys && (
                <p className="muted" style={{ margin: 0, flexBasis: '100%' }}>
                  All quantities are 0 — this will cancel the order. Qty 0 on
                  some products only skips those lines.
                </p>
              )}

              {canCancelPerm &&
                (order.allowCancel ||
                  displayStatus === 'requested' ||
                  displayStatus === 'approved' ||
                  displayStatus === 'submitted') &&
                !canReceiveOrReject &&
                !willCancelFromQtys && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => cancel.mutate()}
                  >
                    Cancel
                  </button>
                )}
            </div>

            {canShareAction && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="muted" style={{ margin: 0 }}>
                  {canIssue
                    ? 'Copy link or WhatsApp will Issue this approved PO, then create a printable PDF link for the vendor.'
                    : 'Send a printable PDF link to the vendor. They can open it without signing in and use Print / Save PDF.'}
                </p>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void copyLink()}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void forwardWhatsApp()}
                  >
                    WhatsApp
                  </button>
                </div>
                {shareLink && (
                  <p
                    className="muted"
                    style={{ margin: 0, wordBreak: 'break-all' }}
                  >
                    <a href={shareLink} target="_blank" rel="noreferrer">
                      {shareLink}
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        }
      />

      {shareMessage && <p className="muted">{shareMessage}</p>}
      {actionError && (
        <p className="error-text">{(actionError as Error).message}</p>
      )}

      {showDeliveryQr && (
        <DeliveryQrModal
          orderId={orderId}
          poNumber={order.poNumber}
          bypassLabel={pendingAfterReceive ? 'Bypass' : 'Close'}
          onBypass={() => {
            if (pendingAfterReceive) {
              void finishAfterReceiveQr()
              return
            }
            setShowDeliveryQr(false)
          }}
        />
      )}

      {chargesLine && (
        <LineChargesModal
          line={chargesLine}
          busy={busy}
          onClose={() => setChargesLine(null)}
          onSave={(next) => applyLineCharges(chargesLine, next)}
        />
      )}

      {showAddItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !addExtraItem.isPending && setShowAddItem(false)}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-label="Add vendor product"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-card-row">
              <h3 style={{ margin: 0 }}>Add Item</h3>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={addExtraItem.isPending}
                onClick={() => setShowAddItem(false)}
              >
                Close
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {canAmendPurchaseRequest
                ? 'Search vendor products to add to this purchase request'
                : canReceiveOrReject || canConsolidate
                  ? 'Search vendor products that arrived without a PO line'
                  : 'Search vendor products to add to this PO'}
              {order.vendorName || order.supplier
                ? ` from ${order.vendorName || order.supplier}`
                : ''}
              .
              {canReceiveOrReject || canConsolidate
                ? ' They will be included when you confirm receive / consolidate.'
                : canAmendPurchaseRequest
                  ? ' They are saved on the request before Approve.'
                  : ' They are saved on this PO immediately.'}
            </p>
            {!outletIdForSearch && (
              <p className="error-text" style={{ margin: 0 }}>
                Select a location in the top bar so products can be searched.
              </p>
            )}
            <form
              className="stack"
              style={{ gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                setAddSearchNeedle(addKeyword.trim())
              }}
            >
              <label className="field">
                <span>Keyword</span>
                <input
                  value={addKeyword}
                  onChange={(e) => setAddKeyword(e.target.value)}
                  placeholder="Product or ingredient name"
                  autoFocus
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!outletIdForSearch || addExtraItem.isPending}
              >
                Search
              </button>
            </form>

            {addProductsQuery.isLoading && (
              <p className="muted" style={{ margin: 0 }}>
                Searching…
              </p>
            )}
            {addProductsQuery.isError && (
              <p className="error-text" style={{ margin: 0 }}>
                {(addProductsQuery.error as Error).message}
              </p>
            )}
            {addMessage && (
              <p className="error-text" style={{ margin: 0 }}>
                {addMessage}
              </p>
            )}

            <div className="order-list">
              {(addProductsQuery.data || []).map((item, idx) => {
                const already = workingLines().some(
                  (l) =>
                    (item.productId != null &&
                      l.productId != null &&
                      Number(l.productId) === Number(item.productId)) ||
                    (item.ingredientId != null &&
                      l.ingredientId != null &&
                      Number(l.ingredientId) === Number(item.ingredientId)),
                )
                return (
                  <div
                    className="order-card-row"
                    key={`${item.productId ?? item.ingredientId}-${idx}`}
                  >
                    <ProductMeta
                      name={item.productName || item.name || 'Product'}
                      ingredientName={item.ingredientName}
                      deliveryUom={deliveryUomOf(item)}
                      recipeUom={recipeUomOf(item)}
                      parStock={item.parStock}
                      onHand={item.quantityOnHand ?? item.onHandQuantity}
                      extra={
                        [
                          item.vendorName,
                          item.price != null ? String(item.price) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || null
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={already || addExtraItem.isPending || busy}
                      onClick={() => {
                        setAddMessage(null)
                        addExtraItem.mutate(item)
                      }}
                    >
                      {already
                        ? 'Added'
                        : addExtraItem.isPending
                          ? 'Adding…'
                          : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
            {!addProductsQuery.isLoading &&
              (addProductsQuery.data || []).length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  No products found. Try another keyword
                  {resolvedVendorId == null
                    ? ', or check the location filter'
                    : ''}
                  .
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
