import { request } from './client'
import { parseQtyWithUom, recipeUomOf } from '../components/ProductMeta'
import { extractPoShareLink } from '../utils/poShareLink'
import type { Address, Ingredient, OrderDetail, OrderSummary, Outlet } from '../types'

export const vendorStatusChips = [
  {
    key: 'new',
    label: 'New',
    /** Sales waiting to accept/approve + inbound POs from Cloud customers */
    statuses: [
      'Submitted',
      'SubmittedWithChanges',
      'WaitingForAccepted',
      'PendingVendorReview',
      'VendorApproved',
      'Viewed',
    ],
  },
  {
    key: 'active',
    label: 'Active Order',
    /** Client / vendor has accepted — order is in progress */
    statuses: ['Accepted', 'ToShip'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    /** Client has received the goods */
    statuses: ['Received', 'Consolidated'],
  },
] as const

/** True when this vendor account must get internal approval before issuing. */
export function vendorNeedsIssueApproval(hasPermission: (name: string) => boolean) {
  return hasPermission('VendorOrderApproveRejectRequiredApproval')
}

/** Who can Approve/Reject a PendingVendorReview sales order. */
export function canVendorInternallyApprove(
  hasPermission: (name: string) => boolean,
  roleName?: string | null,
) {
  const isMaster = (roleName || '').toLowerCase() === 'master'
  // Flutter: master without VendorOrderApproveRejectRequiredApproval.
  // Also allow any master so approvers can clear the To Approve queue.
  if (isMaster) return true
  return !hasPermission('VendorOrderApproveRejectRequiredApproval')
}

export async function listVendorOrders(
  token: string,
  statuses: string[],
  pageIndex = 1,
  pageSize = 20,
  poNumber = '',
) {
  const { data } = await request<OrderSummary[]>('VendorOrder/List', {
    method: 'POST',
    token,
    body: {
      PageSize: pageSize,
      PurchaseOrderNumber: poNumber,
      OperatorCompanyIds: [],
      CreatedDateFrom: null,
      CreatedDateTo: null,
      Status: statuses,
      PageIndex: pageIndex,
    },
  })
  return Array.isArray(data) ? data : []
}

export async function getVendorOrder(token: string, id: number) {
  const { data } = await request<Record<string, unknown>>(`VendorOrder/${id}`, {
    token,
  })
  return normalizeVendorOrderDetail(data, id)
}

function normalizeVendorOrderDetail(
  raw: Record<string, unknown> | null | undefined,
  fallbackId: number,
): OrderDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: fallbackId, orderDetails: [] }
  }

  const status =
    (raw.status as string | undefined) ||
    (raw.orderStatus as string | undefined) ||
    undefined

  const linesRaw =
    raw.orderDetails ??
    raw.OrderDetails ??
    raw.details ??
    raw.Details ??
    []

  const lines = Array.isArray(linesRaw)
    ? linesRaw.map((row) => {
        const r = row as Record<string, unknown>
        const onHandRaw =
          (r.onHandQuantity as string | number | undefined) ??
          (r.quantityOnHand as string | number | undefined)
        const onHand = parseQtyWithUom(onHandRaw)
        const par = parseQtyWithUom(r.parStock as string | number | undefined)
        return {
          orderDetailId: Number(r.orderDetailId ?? r.id) || undefined,
          ingredientId: r.ingredientId as number | undefined,
          productId: r.productId as number | undefined,
          productName:
            (r.productName as string | undefined) ||
            (r.ingredientName as string | undefined) ||
            (r.name as string | undefined),
          productQuantity:
            (r.productQuantity as number | undefined) ??
            (r.quantity as number | undefined),
          productPrice:
            (r.productPrice as number | undefined) ??
            (r.price as number | undefined),
          subtotal: r.subtotal as number | undefined,
          discount: r.discount as number | undefined,
          tax: r.tax as number | undefined,
          deliveryPackage: r.deliveryPackage as string | undefined,
          uom:
            (r.uom as string | undefined) ||
            (r.deliveryPackage as string | undefined),
          recipeUom: recipeUomOf({
            recipeUnit: r.recipeUnit as string | undefined,
            recipeUom: r.recipeUom as string | undefined,
            onHandQuantity: onHandRaw,
            deliveryPackage: r.deliveryPackage as string | undefined,
          }),
          parStock: par.qty ?? undefined,
          onHandQuantity: onHand.qty ?? undefined,
          quantityOnHand: onHand.qty ?? undefined,
        }
      })
    : []

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
    grandTotal:
      (raw.total as number | undefined) ?? (raw.grandTotal as number | undefined),
    total: raw.total as number | undefined,
    isVirtualVendor: Boolean(raw.isVirtualVendor),
    shippingDate: (raw.shippingDate as string | undefined) || undefined,
    orderFrom: (raw.orderFrom as string | undefined) || undefined,
    orderDetails: lines,
    doImageURL:
      (raw.doImageURL as string | undefined) ||
      (raw.doImageUrl as string | undefined) ||
      undefined,
  }
}

/** Update line qty/price before internal Approve (same API Flutter uses). */
export async function updateVendorOrderQuantity(
  token: string,
  orderId: number,
  lines: NonNullable<OrderDetail['orderDetails']>,
) {
  await request(`OperatorOrder/Order/${orderId}/UpdateQuantity`, {
    method: 'POST',
    token,
    body: {
      taxAmount: 0,
      cartDetails: (lines || []).map((d) => ({
        ingredientId: d.ingredientId,
        productId: d.productId,
        quantity: d.productQuantity,
        rrp: d.productPrice,
        ProductType: d.productType,
      })),
    },
  })
}

export async function acceptVendorOrder(token: string, id: number) {
  await request(`VendorOrder/AcceptOrder/${id}`, { method: 'POST', token })
}

export async function rejectVendorOrder(token: string, id: number) {
  await request(`VendorOrder/RejectOrder/${id}`, { method: 'POST', token })
}

export async function vendorApproveOrder(token: string, id: number) {
  await request(`VendorOrder/VendorApprovedOrder/${id}`, { method: 'POST', token })
}

export async function vendorRejectOrder(token: string, id: number) {
  await request(`VendorOrder/VendorRejectedOrder/${id}`, { method: 'POST', token })
}

export async function proceedToDo(
  token: string,
  id: number,
  shippingDate?: string,
) {
  await request(`VendorOrder/ProceedToDO/${id}`, {
    method: 'POST',
    token,
    body: {
      OrderId: id,
      ...(shippingDate ? { ShippingDate: shippingDate } : {}),
    },
  })
}

export async function receiveVendorOrder(token: string, id: number) {
  await request(`VendorOrder/${id}/ReceiveOrder`, { method: 'POST', token })
}

/** Known UAT virtual/test clients when VirtualOutlet returns empty (mirrors Flutter StagingUatFallback).
 * Only used when explicitly requested — never for the shell Location filter. */
const UAT_FALLBACK_CLIENT_IDS = [
  1108, 1109, 1116, 1120, 1214, 1218, 811, 812, 889, 2670,
]

function normalizeOutlet(raw: Record<string, unknown>): Outlet | null {
  const outletId = Number(raw.outletId ?? raw.id)
  if (!Number.isFinite(outletId)) return null
  return {
    outletId,
    name: String(raw.name ?? raw.outletName ?? `Client ${outletId}`),
    isDefault: Boolean(raw.isDefault),
    outletAddress: raw.outletAddress
      ? String(raw.outletAddress)
      : raw.address
        ? String(raw.address)
        : undefined,
  }
}

function normalizeIngredient(raw: Record<string, unknown>): Ingredient {
  const productName =
    (raw.productName as string | undefined) ||
    (raw.ingredientName as string | undefined) ||
    (raw.name as string | undefined)
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
  return {
    ingredientId: raw.ingredientId as number | undefined,
    ingredientName: raw.ingredientName as string | undefined,
    productId: raw.productId as number | undefined,
    productName,
    name: productName,
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
    vendorName: raw.vendorName as string | undefined,
    cartItemId: raw.cartItemId as number | undefined,
    cartQuantity:
      raw.cartQuantity != null ? Number(raw.cartQuantity) : undefined,
  }
}

async function discoverFallbackClients(token: string): Promise<Outlet[]> {
  const discovered = await Promise.all(
    UAT_FALLBACK_CLIENT_IDS.map(async (outletId): Promise<Outlet | null> => {
      try {
        const addresses = await getVendorAddresses(token, outletId)
        if (!addresses.length) return null
        const preferred = addresses.find((a) => a.isDefault) || addresses[0]
        return {
          outletId,
          name: preferred.outletName || `Client ${outletId}`,
          outletAddress: preferred.address,
          isDefault: false,
        } satisfies Outlet
      } catch {
        return null
      }
    }),
  )
  return discovered.filter((o): o is Outlet => o != null)
}

/**
 * Clients/outlets returned by VendorOrder/VirtualOutlet for this account.
 * Does not invent UAT demo clients — use includeUatFallback only for sales-order demos.
 */
export async function getVirtualOutlets(
  token: string,
  options?: { includeUatFallback?: boolean },
) {
  const { data } = await request<unknown>('VendorOrder/VirtualOutlet', { token })
  const list = Array.isArray(data)
    ? data
        .map((row) => normalizeOutlet(row as Record<string, unknown>))
        .filter((o): o is Outlet => o != null)
    : []

  if (list.length > 0) return list
  if (options?.includeUatFallback) return discoverFallbackClients(token)
  return []
}

export async function getVendorAddresses(token: string, outletId: number) {
  const { data } = await request<Address[]>(
    `VendorOrder/Outlet/${outletId}/DeliveryAddress`,
    { token },
  )
  return Array.isArray(data) ? data : []
}

export async function searchVendorIngredients(
  token: string,
  outletId: number,
  keyword = '',
  pageIndex = 1,
  pageSize = 100,
) {
  const { data, recordsCount } = await request<unknown[]>('VendorOrder/Ingredient', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      outletId,
      categoryId: null,
      groupId: null,
      keyword: keyword || null,
    },
  })
  const products = Array.isArray(data)
    ? data.map((row) => normalizeIngredient(row as Record<string, unknown>))
    : []
  return { products, totalCount: recordsCount ?? products.length }
}

export async function getVendorCart(token: string, outletId: number) {
  const { data } = await request(`VendorOrder/Cart?outletId=${outletId}`, {
    token,
  })
  const list = Array.isArray(data) ? data : data ? [data] : []
  return list.map((vendor) => {
    const row = vendor as Record<string, unknown>
    const details = row.details
    const cartItems = row.cartItems
    const lines = Array.isArray(cartItems)
      ? cartItems
      : Array.isArray(details)
        ? details
        : []
    return { ...row, cartItems: lines }
  })
}

export async function updateVendorCart(
  token: string,
  body: Record<string, unknown>,
) {
  const { data } = await request('VendorOrder/Cart/Update', {
    method: 'POST',
    token,
    body,
  })
  return data
}

export async function checkoutVendorCart(
  token: string,
  body: Record<string, unknown>,
) {
  const { data } = await request<unknown>('VendorOrder/Cart/Checkout', {
    method: 'POST',
    token,
    body,
  })
  return data
}

export async function getPoClipboard(token: string, orderId: number) {
  const { data } = await request<unknown>(
    `VendorOrder/GetPOClipboard?id=${orderId}`,
    { token },
  )
  const link = extractPoShareLink(data)
  if (link) return link
  throw new Error('Order link was empty')
}

