import { request } from './client'
import {
  parseQtyWithUom,
  recipeUomOf,
} from '../components/ProductMeta'
import { extractPoShareLink } from '../utils/poShareLink'
import type {
  Address,
  CartVendor,
  Ingredient,
  IngredientTab,
  OrderDetail,
  OrderSummary,
  OrderTemplate,
  Outlet,
} from '../types'

const OPERATOR_ACTIVE_STATUSES = [
  'Approved',
  'Submitted',
  'Failed',
  'Viewed',
  'Accepted',
  'ToShip',
  'Cancelled',
  'PaymentApproved',
  'PaymentFailed',
  'Rejected',
  'SubmittedWithChanges',
  'Disapproved',
  'WaitingForAccepted',
  'PendingVendorReview',
  'VendorApproved',
]

export const operatorStatusChips = [
  { key: 'toApprove', label: 'To Approve', statuses: ['Requested'] },
  { key: 'active', label: 'Active PO', statuses: OPERATOR_ACTIVE_STATUSES },
  { key: 'received', label: 'Received', statuses: ['Received'] },
  { key: 'consolidated', label: 'Consolidated', statuses: ['Consolidated'] },
] as const

export async function listOperatorOrders(
  token: string,
  statuses: string[],
  pageIndex = 1,
  pageSize = 20,
  poNumber = '',
) {
  const { data, recordsCount } = await request<OrderSummary[]>('OperatorOrder/List', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      purchaseOrderNumber: poNumber,
      status: statuses,
    },
  })
  return {
    orders: Array.isArray(data) ? data : [],
    totalCount: recordsCount ?? (Array.isArray(data) ? data.length : 0),
  }
}

function extractRawLines(raw: Record<string, unknown> | null | undefined): unknown {
  if (!raw || typeof raw !== 'object') return []
  return (
    raw.orderDetails ??
    raw.OrderDetails ??
    raw.details ??
    raw.Details ??
    raw.orderDetail ??
    raw.amendments ??
    []
  )
}

async function fetchVendorOrderAsOperator(token: string, id: number) {
  const { data } = await request<Record<string, unknown>>(`VendorOrder/${id}`, {
    token,
  })
  return normalizeVendorOrderAsOperator(data, id)
}

export async function getOperatorOrder(token: string, id: number) {
  try {
    const { data } = await request<Record<string, unknown>>(`Operatororder/${id}`, {
      token,
    })
    const detail = normalizeOperatorOrder(data, id)
    // Some responses succeed with an empty line array; VendorOrder may still have lines.
    if ((detail.orderDetails?.length ?? 0) === 0) {
      try {
        const vendorDetail = await fetchVendorOrderAsOperator(token, id)
        if ((vendorDetail.orderDetails?.length ?? 0) > 0) {
          return {
            ...detail,
            ...vendorDetail,
            // Prefer operator header fields when present
            status: detail.status || vendorDetail.status,
            poNumber: detail.poNumber || vendorDetail.poNumber,
            allowApproveOrReject: detail.allowApproveOrReject,
            allowCancel: detail.allowCancel,
            orderDetails: vendorDetail.orderDetails,
          }
        }
      } catch {
        // keep operator detail (possibly empty lines)
      }
    }
    return detail
  } catch (operatorErr) {
    // Some UAT Requested POs 500 on Operatororder/{id}; VendorOrder often still returns lines.
    try {
      return await fetchVendorOrderAsOperator(token, id)
    } catch {
      throw operatorErr
    }
  }
}

function normalizeLine(raw: Record<string, unknown>): NonNullable<OrderDetail['orderDetails']>[number] {
  const onHandRaw =
    (raw.onHandQuantity as string | number | undefined) ??
    (raw.quantityOnHand as string | number | undefined) ??
    (raw.onHand as string | number | undefined)
  const onHand = parseQtyWithUom(onHandRaw)
  const par = parseQtyWithUom(raw.parStock as string | number | undefined)
  const detailIdCandidates = [
    raw.orderDetailId,
    raw.OrderDetailId,
    raw.OrderDetailsId,
    raw.orderDetailsId,
    raw.id,
  ]
  let orderDetailId: number | undefined
  for (const candidate of detailIdCandidates) {
    const n = Number(candidate)
    if (Number.isFinite(n) && n > 0) {
      orderDetailId = n
      break
    }
  }
  return {
    orderDetailId,
    ingredientId: raw.ingredientId as number | undefined,
    productId: raw.productId as number | undefined,
    productCode: raw.productCode as string | undefined,
    productName:
      (raw.productName as string | undefined) ||
      (raw.ingredientName as string | undefined) ||
      (raw.name as string | undefined),
    ingredientName: raw.ingredientName as string | undefined,
    productQuantity:
      (raw.productQuantity as number | undefined) ??
      (raw.quantity as number | undefined),
    productPrice:
      (raw.productPrice as number | undefined) ?? (raw.price as number | undefined),
    subtotal: raw.subtotal as number | undefined,
    discount: raw.discount as number | undefined,
    tax: raw.tax as number | undefined,
    productType: raw.productType as string | undefined,
    deliveryPackage: raw.deliveryPackage as string | undefined,
    uom: (raw.uom as string | undefined) || (raw.deliveryPackage as string | undefined),
    recipeUnit: raw.recipeUnit as string | undefined,
    recipeUom: recipeUomOf({
      recipeUnit: raw.recipeUnit as string | undefined,
      recipeUom: raw.recipeUom as string | undefined,
      onHandQuantity: onHandRaw,
      deliveryPackage: raw.deliveryPackage as string | undefined,
    }),
    parStock: par.qty ?? undefined,
    onHandQuantity: onHand.qty ?? undefined,
    quantityOnHand: onHand.qty ?? undefined,
  }
}

function normalizeLines(raw: unknown): NonNullable<OrderDetail['orderDetails']> {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => normalizeLine(row as Record<string, unknown>))
}

/** Detail API often returns Delivered for POs that list as Received. */
function normalizeOperatorListStatus(status?: string | null) {
  const raw = (status || '').trim()
  if (!raw) return undefined
  const key = raw.toLowerCase().replace(/\s+/g, '')
  if (key === 'delivered') return 'Received'
  if (key === 'toship') return 'To Ship'
  return raw
}

function normalizeOperatorOrder(
  raw: Record<string, unknown> | null | undefined,
  fallbackId: number,
): OrderDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: fallbackId, orderDetails: [] }
  }

  return {
    id: Number(raw.id ?? fallbackId),
    poNumber: (raw.poNumber as string | undefined) || undefined,
    poDate:
      (raw.poDate as string | undefined) ||
      (raw.orderDate as string | undefined) ||
      undefined,
    status: normalizeOperatorListStatus(
      (raw.status as string | undefined) ||
        (raw.orderStatus as string | undefined),
    ),
    outletName: (raw.outletName as string | undefined) || undefined,
    outletId:
      raw.outletId != null && Number.isFinite(Number(raw.outletId))
        ? Number(raw.outletId)
        : undefined,
    vendorId:
      raw.vendorId != null && Number.isFinite(Number(raw.vendorId))
        ? Number(raw.vendorId)
        : undefined,
    vendorName: (raw.vendorName as string | undefined) || undefined,
    operatorCompanyName: (raw.operatorCompanyName as string | undefined) || undefined,
    supplier:
      (raw.supplier as string | undefined) ||
      (raw.vendorName as string | undefined) ||
      undefined,
    outlet: (raw.outlet as string | undefined) || undefined,
    deliveryAddress: (raw.deliveryAddress as string | undefined) || undefined,
    billingAddress: (raw.billingAddress as string | undefined) || undefined,
    deliveryDate: (raw.deliveryDate as string | undefined) || undefined,
    tel: (raw.tel as string | undefined) || undefined,
    email: (raw.email as string | undefined) || undefined,
    vendorTel: (raw.vendorTel as string | undefined) || undefined,
    vendorEmail: (raw.vendorEmail as string | undefined) || undefined,
    vendorFax: (raw.vendorFax as string | undefined) || undefined,
    brn:
      (raw.brn as string | undefined) ||
      (raw.BRN as string | undefined) ||
      (raw.businessRegistrationNumber as string | undefined) ||
      (raw.companyRegNo as string | undefined) ||
      undefined,
    gstNo:
      (raw.gstNo as string | undefined) ||
      (raw.GSTNo as string | undefined) ||
      (raw.gstNumber as string | undefined) ||
      (raw.taxRegistrationNumber as string | undefined) ||
      undefined,
    remarks: (raw.remarks as string | undefined) || undefined,
    subTotal: raw.subTotal as number | undefined,
    totalDiscount: raw.totalDiscount as number | undefined,
    tax: raw.tax as number | undefined,
    deliveryCharge: raw.deliveryCharge as number | undefined,
    rounding: (raw.rounding as number | undefined) ?? (raw.roundingCharge as number | undefined),
    grandTotal: raw.grandTotal as number | undefined,
    total: raw.total as number | undefined,
    allowApproveOrReject: Boolean(raw.allowApproveOrReject),
    allowCancel: Boolean(raw.allowCancel),
    isVirtualVendor: Boolean(raw.isVirtualVendor),
    shippingDate: (raw.shippingDate as string | undefined) || undefined,
    preferDeliveryDate: (raw.preferDeliveryDate as string | undefined) || undefined,
    orderDetails: normalizeLines(extractRawLines(raw)),
    doImageURL:
      (raw.doImageURL as string | undefined) ||
      (raw.doImageUrl as string | undefined) ||
      undefined,
  }
}

function normalizeVendorOrderAsOperator(
  raw: Record<string, unknown> | null | undefined,
  fallbackId: number,
): OrderDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: fallbackId, orderDetails: [] }
  }

  const status =
    (raw.status as string | undefined) ||
    (raw.orderStatus as string | undefined) ||
    'Requested'
  return {
    id: Number(raw.id ?? fallbackId),
    poNumber:
      (raw.ponNumber as string | undefined) ||
      (raw.poNumber as string | undefined) ||
      (raw.purchaseOrderNumber as string | undefined),
    poDate: (raw.poDate as string | undefined) || undefined,
    status,
    outletName:
      (raw.outlet as string | undefined) ||
      (raw.outletName as string | undefined) ||
      undefined,
    outletId:
      raw.outletId != null && Number.isFinite(Number(raw.outletId))
        ? Number(raw.outletId)
        : undefined,
    vendorId:
      raw.vendorId != null && Number.isFinite(Number(raw.vendorId))
        ? Number(raw.vendorId)
        : undefined,
    vendorName:
      (raw.supplier as string | undefined) ||
      (raw.vendorName as string | undefined) ||
      undefined,
    supplier: (raw.supplier as string | undefined) || undefined,
    operatorCompanyName: (raw.operatorCompanyName as string | undefined) || undefined,
    outlet: (raw.outlet as string | undefined) || undefined,
    deliveryAddress: (raw.deliveryAddress as string | undefined) || undefined,
    billingAddress: (raw.billingAddress as string | undefined) || undefined,
    remarks: (raw.remarks as string | undefined) || undefined,
    subTotal:
      (raw.subtotal as number | undefined) ?? (raw.subTotal as number | undefined),
    totalDiscount: raw.totalDiscount as number | undefined,
    tax: raw.tax as number | undefined,
    deliveryCharge: raw.deliveryCharge as number | undefined,
    rounding:
      (raw.rounding as number | undefined) ??
      (raw.roundingCharges as number | undefined),
    grandTotal: (raw.total as number | undefined) ?? (raw.grandTotal as number | undefined),
    total: raw.total as number | undefined,
    allowApproveOrReject: status.toLowerCase() === 'requested',
    allowCancel:
      status.toLowerCase() === 'requested' || status.toLowerCase() === 'submitted',
    isVirtualVendor: Boolean(raw.isVirtualVendor),
    shippingDate: (raw.shippingDate as string | undefined) || undefined,
    orderDetails: normalizeLines(extractRawLines(raw)),
    doImageURL:
      (raw.doImageURL as string | undefined) ||
      (raw.doImageUrl as string | undefined) ||
      undefined,
  }
}

/** Build a usable detail view when Operatororder/{id} fails on UAT. */
export function orderSummaryToDetail(summary: OrderSummary): OrderDetail {
  const status = summary.status || summary.orderStatus || 'Requested'
  return {
    id: summary.id,
    poNumber: summary.purchaseOrderNumber,
    poDate: summary.createdOn,
    status,
    outletName: summary.outletName || summary.operatorOutletName,
    vendorName: summary.vendorName,
    supplier: summary.vendorName,
    operatorCompanyName: summary.operatorCompanyName,
    grandTotal: summary.grandTotal ?? summary.total,
    total: summary.total,
    isVirtualVendor: summary.isVirtualVendor,
    allowApproveOrReject: status.toLowerCase() === 'requested',
    allowCancel:
      status.toLowerCase() === 'requested' ||
      status.toLowerCase() === 'submitted',
    orderDetails: [],
    doImageURL: summary.doImageUrl,
  }
}

export async function cancelOperatorOrder(token: string, id: number) {
  await request(`OperatorOrder/Cancel/${id}`, { method: 'PUT', token })
}

/** Supervisor approve: Requested → Approved (Active PO). Does not send to vendor yet. */
export async function approveOperatorOrder(
  token: string,
  id: number,
  lines: OrderDetail['orderDetails'] = [],
  remark = '',
) {
  await request(`OperatorOrder/OrderAction/${id}`, {
    method: 'POST',
    token,
    body: {
      orderStatus: 'Approved',
      remark,
      amendments: (lines || []).map((d) => ({
        orderDetailId: d.orderDetailId,
        quantity: d.productQuantity,
        price: d.productPrice,
      })),
    },
  })
}

/**
 * Issue PO to vendor: Approved → WaitingForAccepted.
 * UAT rejects Approved → Submitted (500); WaitingForAccepted is the valid issue step.
 * Call getOperatorPoLink afterwards for Create link / WhatsApp.
 */
export async function issueOperatorOrder(
  token: string,
  id: number,
  lines: OrderDetail['orderDetails'] = [],
  remark = '',
) {
  const amendments = (lines || [])
    .filter((d) => d.orderDetailId != null)
    .map((d) => ({
      orderDetailId: d.orderDetailId,
      quantity: d.productQuantity,
      price: d.productPrice,
    }))
  await request(`OperatorOrder/OrderAction/${id}`, {
    method: 'POST',
    token,
    body: {
      orderStatus: 'WaitingForAccepted',
      remark,
      amendments,
    },
  })
}

/** Shareable PDF / PODetail link for vendor (Create link / WhatsApp). */
export async function getOperatorPoLink(token: string, id: number): Promise<string> {
  const { data } = await request<unknown>(`OperatorOrder/CopyPO/${id}`, { token })
  const link = extractPoShareLink(data)
  if (link) return link
  throw new Error('PO PDF link was empty')
}

export async function rejectOperatorOrder(
  token: string,
  id: number,
  remark = '',
  /** Requested POs use Disapproved; Accepted/ToShip use Rejected */
  mode: 'disapprove' | 'reject' = 'disapprove',
) {
  await request(`OperatorOrder/OrderAction/${id}`, {
    method: 'POST',
    token,
    body: {
      orderStatus: mode === 'reject' ? 'Rejected' : 'Disapproved',
      remark,
    },
  })
}

export async function receiveOperatorOrder(token: string, id: number) {
  await request(`OperatorOrder/OrderAction/ReceiveOrder/${id}`, {
    method: 'POST',
    token,
  })
}

/** Receive Accepted / To Ship PO with optional qty/price amendments (mobile DeliveryOrder). */
export async function receiveOperatorOrderWithAmendments(
  token: string,
  id: number,
  lines: OrderDetail['orderDetails'] = [],
  remark = '',
  options: {
    tax?: number
    discount?: number
    rounding?: number
    deliveryCharge?: number
  } = {},
) {
  await request(`OperatorOrder/OrderAction/DeliveryOrder/${id}`, {
    method: 'POST',
    token,
    body: {
      orderStatus: 'Received',
      remark,
      tax: Number(options.tax) || 0,
      discount: Number(options.discount) || 0,
      rounding: Number(options.rounding) || 0,
      deliveryCharge: Number(options.deliveryCharge) || 0,
      amendments: buildDeliveryAmendments(lines),
    },
  })
}

/** Consolidate Received → Consolidated; backend posts qty into on-hand stock. */
export async function consolidateOperatorOrder(
  token: string,
  id: number,
  lines: OrderDetail['orderDetails'] = [],
  options: {
    remark?: string
    tax?: number
    discount?: number
    rounding?: number
    deliveryCharge?: number
    customInvoiceNo?: string
  } = {},
) {
  const body: Record<string, unknown> = {
    orderStatus: 'Consolidated',
    remark: options.remark ?? '',
    generalFeedback: null,
    issueFeedbackId: 0,
    issueFeedback: null,
    tax: Number(options.tax) || 0,
    discount: Number(options.discount) || 0,
    rounding: Number(options.rounding) || 0,
    deliveryCharge: Number(options.deliveryCharge) || 0,
    amendments: buildDeliveryAmendments(lines),
  }
  const invoice = (options.customInvoiceNo || '').trim()
  if (invoice) body.customInvoiceNo = invoice

  await request(`OperatorOrder/OrderAction/DeliveryOrder/${id}`, {
    method: 'POST',
    token,
    body,
  })
}

function buildDeliveryAmendments(lines: OrderDetail['orderDetails'] = []) {
  return (lines || [])
    .filter((d) => d.orderDetailId != null)
    .map((d) => {
      const quantity = Number(d.productQuantity) || 0
      const price = Number(d.productPrice) || 0
      const subtotal =
        d.subtotal != null && Number.isFinite(Number(d.subtotal))
          ? Number(d.subtotal)
          : quantity * price
      return {
        orderDetailId: d.orderDetailId,
        quantity,
        price,
        subtotal,
        discount: Number(d.discount) || 0,
        tax: Number(d.tax) || 0,
      }
    })
}

/** Sync PO line qty/price (and add new products) — same API Flutter uses. */
export async function updateOperatorOrderQuantity(
  token: string,
  orderId: number,
  lines: NonNullable<OrderDetail['orderDetails']>,
  taxAmount = 0,
) {
  await request(`OperatorOrder/Order/${orderId}/UpdateQuantity`, {
    method: 'POST',
    token,
    body: {
      taxAmount,
      cartDetails: (lines || [])
        .filter((d) => d.productId != null || d.ingredientId != null)
        .map((d) => ({
          ingredientId: d.ingredientId,
          productId: d.productId,
          quantity: d.productQuantity ?? 0,
          rrp: d.productPrice ?? 0,
          ProductType: d.productType,
        })),
    },
  })
}

export async function getOperatorOutlets(token: string) {
  const { data } = await request<Outlet[]>('OperatorOrder/Outlet', { token })
  return Array.isArray(data) ? data : []
}

export async function getIngredientCategories(token: string) {
  const { data } = await request<IngredientTab[]>(
    'OperatorOrder/Ingredient/Category',
    { token },
  )
  return Array.isArray(data) ? data : []
}

export async function getIngredientVendors(token: string, outletId: number) {
  const { data } = await request<Array<{ vendorId?: number; name?: string }>>(
    `OperatorOrder/Vendors/${outletId}`,
    { token },
  )
  if (!Array.isArray(data)) return []
  return data.map(
    (v): IngredientTab => ({
      id: v.vendorId,
      name: v.name,
    }),
  )
}

export type IngredientSearchParams = {
  outletId: number
  keyword?: string
  categoryId?: number | null
  vendorIds?: number[] | null
  pageIndex?: number
  pageSize?: number
}

export async function searchOperatorIngredients(
  token: string,
  params: IngredientSearchParams,
) {
  const { data } = await request<unknown[]>('OperatorOrder/Ingredient', {
    method: 'POST',
    token,
    body: {
      pageSize: params.pageSize ?? 50,
      pageIndex: params.pageIndex ?? 1,
      outletId: params.outletId,
      vendorId: params.vendorIds ?? null,
      categoryId: params.categoryId ?? null,
      groupId: null,
      keyword: params.keyword ?? '',
    },
  })
  if (!Array.isArray(data)) return []
  return data.map((row) => normalizeOperatorIngredient(row as Record<string, unknown>))
}

/** Paginate OperatorOrder/Ingredient until exhausted. */
export async function searchAllOperatorIngredients(
  token: string,
  params: Omit<IngredientSearchParams, 'pageIndex' | 'pageSize'>,
) {
  const pageSize = 100
  const all: Ingredient[] = []
  for (let pageIndex = 1; pageIndex <= 40; pageIndex += 1) {
    const page = await searchOperatorIngredients(token, {
      ...params,
      pageIndex,
      pageSize,
    })
    all.push(...page)
    if (page.length < pageSize) break
  }
  return all
}

function normalizeOperatorIngredient(raw: Record<string, unknown>): Ingredient {
  const ingredientName =
    String(
      raw.ingredientName ??
        raw.IngredientName ??
        raw.smartIngredientName ??
        raw.SmartIngredientName ??
        '',
    ).trim() || undefined
  // Keep vendor product name separate from smart ingredient name.
  const productName =
    String(raw.productName ?? raw.ProductName ?? raw.name ?? raw.Name ?? '').trim() ||
    undefined
  const onHandRaw =
    (raw.quantityOnHand as string | number | undefined) ??
    (raw.onHandQuantity as string | number | undefined) ??
    (raw.onHand as string | number | undefined)
  const onHand = parseQtyWithUom(onHandRaw)
  const par = parseQtyWithUom(raw.parStock as string | number | undefined)
  const recipeUom = recipeUomOf({
    recipeUnit: raw.recipeUnit as string | undefined,
    recipeUom: raw.recipeUom as string | undefined,
    onHandQuantity: onHandRaw,
    deliveryPackage: raw.deliveryPackage as string | undefined,
  })
  const ingredientIdRaw = raw.ingredientId ?? raw.IngredientId
  return {
    ingredientId:
      ingredientIdRaw != null && Number.isFinite(Number(ingredientIdRaw))
        ? Number(ingredientIdRaw)
        : undefined,
    ingredientName,
    productId: raw.productId != null ? Number(raw.productId) : undefined,
    productName: productName || undefined,
    name: productName || ingredientName,
    price: raw.price as number | undefined,
    type: raw.type as string | undefined,
    uom: (raw.uom as string | undefined) || (raw.deliveryPackage as string | undefined),
    deliveryPackage: raw.deliveryPackage as string | undefined,
    recipeUnit: raw.recipeUnit as string | undefined,
    recipeUom,
    promotionDetailId: raw.promotionDetailId as number | undefined,
    quantityOnHand: onHand.qty ?? undefined,
    onHandQuantity: onHand.qty ?? undefined,
    parStock: par.qty ?? undefined,
    vendorId:
      raw.vendorId != null ? Number(raw.vendorId) : undefined,
    vendorName: raw.vendorName as string | undefined,
    cartItemId: raw.cartItemId as number | undefined,
    cartQuantity:
      raw.cartQuantity != null ? Number(raw.cartQuantity) : undefined,
  }
}

export async function getOrderTemplates(token: string, outletId: number) {
  const { data } = await request<OrderTemplate[]>(
    `OperatorOrder/OrderTemplate?outletId=${outletId}`,
    { token },
  )
  return Array.isArray(data) ? data : []
}

export async function importOrderTemplate(
  token: string,
  outletId: number,
  orderTemplateId: number,
) {
  await request('OperatorOrder/ImportTemplate', {
    method: 'POST',
    token,
    body: { outletId, orderTemplateId },
  })
}

export async function getOperatorCart(token: string, outletId: number) {
  const { data } = await request(`OperatorOrder/Cart?outletId=${outletId}`, {
    token,
  })
  const list = Array.isArray(data) ? data : data ? [data] : []
  // Mobile API returns line items under `details`, not `cartItems`.
  return list.map((vendor) => {
    const row = vendor as Record<string, unknown>
    const details = row.details
    const cartItems = row.cartItems
    const lines = Array.isArray(cartItems)
      ? cartItems
      : Array.isArray(details)
        ? details
        : []
    return { ...row, cartItems: lines } as CartVendor
  })
}

export async function updateOperatorCart(
  token: string,
  body: Record<string, unknown>,
) {
  const { data } = await request('OperatorOrder/Cart/Update', {
    method: 'POST',
    token,
    body,
  })
  return data
}

export async function getOperatorAddresses(token: string, outletId: number) {
  const { data } = await request<Address[]>(
    `OperatorOrder/Outlet/${outletId}/DeliveryAddress`,
    { token },
  )
  return Array.isArray(data) ? data : []
}

export async function checkoutOperatorCart(
  token: string,
  outletId: number,
  deliveryAddressId: number,
  cartVendorDetails: unknown[],
) {
  await request('OperatorOrder/Cart/Checkout', {
    method: 'POST',
    token,
    body: {
      outletId,
      billingAddressId: 0,
      deliveryAddressId,
      cartVendorDetails,
    },
  })
}
