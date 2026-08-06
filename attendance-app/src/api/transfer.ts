import { request } from './client'
import type { Outlet } from '../types'

export type TransferInventoryType = 'Ingredient' | 'Product' | 'SubProduct'

export type TransferOutlet = Outlet

export type TransferProduct = {
  id: number
  inventoryType: TransferInventoryType | string
  name: string
  uom?: string
  code?: string
  availableQuantity?: number | null
  unitPrice?: number
  category?: string | null
  group?: string | null
}

export type TransferProductDetail = TransferProduct & {
  recipeUnit?: string
  productionPrice?: number
  averagePrice?: number
  lowPrice?: number
  highPrice?: number
}

export type TransferHistoryRow = {
  id: number
  date?: string
  fromOutletName?: string
  toOutletName?: string
  createdBy?: string
  roleCode?: string
  amount?: string
  status?: string
  number?: string
}

export type TransferDetailItem = {
  type?: string
  name?: string
  category?: string
  group?: string
  uom?: string
  qty?: string
  unitPrice?: string
  total?: string
  remarks?: string
  code?: string
}

export type TransferDetail = {
  id: number
  date?: string
  number?: string
  companyName?: string
  fromOutletId?: number
  fromOutletName?: string
  toOutletId?: number
  toOutletName?: string
  roleCode?: string
  createdBy?: string
  grandTotal?: string
  status?: string
  createdDate?: string
  lastUpdatedDate?: string | null
  /** Undefined when API omitted the flag — UI may fall back to status-only. */
  allowReceive?: boolean
  allowReject?: boolean
  allowCancel?: boolean
  transferItems: TransferDetailItem[]
}

export type TransferLinePayload = {
  inventoryType: string
  itemId: number
  quantity: number
  remarks?: string | null
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function mapOutlet(row: Record<string, unknown>): TransferOutlet | null {
  const outletId = Number(row.outletId ?? row.id)
  if (!Number.isFinite(outletId)) return null
  return {
    outletId,
    name:
      (row.name as string | undefined) ||
      (row.outletName as string | undefined) ||
      `Outlet ${outletId}`,
    isDefault: Boolean(row.isDefault),
    outletAddress:
      (row.outletAddress as string | undefined) ||
      (row.address as string | undefined) ||
      undefined,
  }
}

function mapProduct(row: Record<string, unknown>): TransferProduct | null {
  const id = Number(row.id ?? row.itemId ?? row.ingredientId)
  if (!Number.isFinite(id)) return null
  const name = String(row.name || '').trim()
  if (!name) return null
  return {
    id,
    inventoryType: String(row.inventoryType || row.itemType || 'Ingredient'),
    name,
    uom: (row.uom as string | undefined) || undefined,
    code: (row.code as string | undefined) || undefined,
    availableQuantity: num(row.availableQuantity) ?? null,
    unitPrice: num(row.unitPrice) ?? 0,
    category: (row.category as string | null | undefined) ?? null,
    group: (row.group as string | null | undefined) ?? null,
  }
}

/** From-outlets available for creating a transfer. */
export async function getTransferFromOutlets(
  token: string,
): Promise<TransferOutlet[]> {
  const { data } = await request<unknown>('Transfer/GetOutlet', { token })
  return asList<Record<string, unknown>>(data)
    .map(mapOutlet)
    .filter((o): o is TransferOutlet => o != null)
}

/** Destination outlets for a given from-outlet. */
export async function getTransferToOutlets(
  token: string,
  fromOutletId: number,
): Promise<TransferOutlet[]> {
  const { data } = await request<unknown>(
    `Transfer/GetToOutlet/${fromOutletId}`,
    { token },
  )
  return asList<Record<string, unknown>>(data)
    .map(mapOutlet)
    .filter((o): o is TransferOutlet => o != null)
}

/** Catalog for transfer line picker (requires from + to). */
export async function getTransferGroupProducts(
  token: string,
  fromOutletId: number,
  toOutletId: number,
): Promise<TransferProduct[]> {
  const qs = new URLSearchParams({
    fromOutletId: String(fromOutletId),
    toOutletId: String(toOutletId),
  })
  const { data } = await request<unknown>(
    `Transfer/GetGroupProducts?${qs.toString()}`,
    { token },
  )
  return asList<Record<string, unknown>>(data)
    .map(mapProduct)
    .filter((p): p is TransferProduct => p != null)
}

/** Client-side keyword filter over GetGroupProducts. */
export async function searchTransferCatalog(
  token: string,
  fromOutletId: number,
  toOutletId: number,
  keyword: string,
): Promise<TransferProduct[]> {
  const rows = await getTransferGroupProducts(token, fromOutletId, toOutletId)
  const tokens = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
    .filter((row) => {
      const hay = `${row.name} ${row.code || ''} ${row.inventoryType}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
      return tokens.every((tok) => hay.includes(tok))
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getTransferProductDetail(
  token: string,
  fromOutletId: number,
  toOutletId: number,
  ingredientId: number,
): Promise<TransferProductDetail | null> {
  const qs = new URLSearchParams({
    ingredientId: String(ingredientId),
    returnLowAndHighPrice: 'true',
    outletId: String(fromOutletId),
    toOutletId: String(toOutletId),
  })
  const { data } = await request<unknown>(
    `Transfer/GetGroupProductDetail?${qs.toString()}`,
    { token },
  )
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const base = mapProduct({
    ...row,
    inventoryType: row.inventoryType || row.itemType || 'Ingredient',
    uom: row.recipeUnitString || row.uom,
    code: row.productID || row.code,
    unitPrice:
      row.productionPrice ??
      row.averagePrice ??
      row.lowPrice ??
      row.unitPrice,
  })
  if (!base) return null
  return {
    ...base,
    recipeUnit: (row.recipeUnitString as string | undefined) || base.uom,
    productionPrice: num(row.productionPrice),
    averagePrice: num(row.averagePrice),
    lowPrice: num(row.lowPrice),
    highPrice: num(row.highPrice),
    availableQuantity: num(row.availableQuantity) ?? base.availableQuantity,
    unitPrice:
      num(row.productionPrice) ??
      num(row.averagePrice) ??
      num(row.lowPrice) ??
      base.unitPrice ??
      0,
  }
}

export async function listTransfer(
  token: string,
  fromOutletId?: number | null,
  pageIndex = 1,
  pageSize = 20,
  keyword?: string | null,
): Promise<TransferHistoryRow[]> {
  const { data } = await request<unknown>('Transfer/List', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      searchDate: null,
      fromOutletId: fromOutletId ?? null,
      transfer: null,
      month: null,
      year: null,
      currency: null,
      keyword: keyword || null,
    },
  })
  // API returns oldest-first; newest submissions sit at the end of page 1.
  return asList<Record<string, unknown>>(data)
    .map((row) => ({
      id: Number(row.id),
      date:
        (row.transferDate as string | undefined) ||
        (row.date as string | undefined) ||
        (row.createdDate as string | undefined),
      fromOutletName:
        (row.fromOutletName as string | undefined) ||
        (row.fromOutlet as string | undefined),
      toOutletName:
        (row.toOutletName as string | undefined) ||
        (row.toOutlet as string | undefined),
      createdBy: row.createdBy as string | undefined,
      roleCode: row.roleCode as string | undefined,
      amount: row.amount != null ? String(row.amount) : undefined,
      status: row.status as string | undefined,
      number:
        (row.number as string | undefined) || (row.code as string | undefined),
    }))
    .filter((row) => Number.isFinite(row.id))
    .sort((a, b) => b.id - a.id)
}

export async function getTransferDetail(
  token: string,
  transferId: number,
): Promise<TransferDetail | null> {
  const { data } = await request<unknown>(`Transfer/GetTransfer/${transferId}`, {
    token,
  })
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const id = Number(row.id)
  if (!Number.isFinite(id)) return null

  const itemsRaw =
    row.transferItems ?? row.items ?? row.transferItem ?? row.details

  return {
    id,
    date:
      (row.deliveryDate as string | undefined) ||
      (row.transferDate as string | undefined) ||
      (row.date as string | undefined),
    number:
      (row.number as string | undefined) || (row.code as string | undefined),
    companyName: row.companyName as string | undefined,
    fromOutletId: num(row.fromOutletId),
    fromOutletName:
      (row.fromOutletName as string | undefined) ||
      (row.fromOutlet as string | undefined),
    toOutletId: num(row.toOutletId),
    toOutletName:
      (row.toOutletName as string | undefined) ||
      (row.toOutlet as string | undefined),
    roleCode: row.roleCode as string | undefined,
    createdBy: row.createdBy as string | undefined,
    grandTotal: row.grandTotal != null ? String(row.grandTotal) : undefined,
    status: row.status as string | undefined,
    createdDate: row.createdDate as string | undefined,
    lastUpdatedDate: (row.lastUpdatedDate as string | null | undefined) ?? null,
    allowReceive:
      row.allowAccept == null && row.allowReceive == null
        ? undefined
        : Boolean(row.allowAccept ?? row.allowReceive),
    allowReject: row.allowReject == null ? undefined : Boolean(row.allowReject),
    allowCancel: row.allowCancel == null ? undefined : Boolean(row.allowCancel),
    transferItems: asList<Record<string, unknown>>(itemsRaw).map((item) => ({
      type: (item.type as string | undefined) || (item.inventoryType as string | undefined),
      name: item.name as string | undefined,
      category: item.category as string | undefined,
      group: item.group as string | undefined,
      uom: item.uom as string | undefined,
      qty:
        item.qty != null
          ? String(item.qty)
          : item.quantity != null
            ? String(item.quantity)
            : undefined,
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : undefined,
      total: item.total != null ? String(item.total) : undefined,
      remarks:
        (item.remarks as string | undefined) ||
        (item.remark as string | undefined),
      code: item.code as string | undefined,
    })),
  }
}

export async function addTransfer(
  token: string,
  fromOutletId: number,
  toOutletId: number,
  items: TransferLinePayload[],
  settingDate?: string | null,
): Promise<void> {
  // Mirror wastage: always send a date-time to avoid API 500 on null.
  const date =
    settingDate ||
    (() => {
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      return d.toISOString()
    })()

  await request('Transfer/Add', {
    method: 'POST',
    token,
    body: {
      settingDate: date,
      fromOutletId,
      toOutletId,
      transferItems: items.map((item) => ({
        inventoryType: item.inventoryType,
        itemId: item.itemId,
        quantity: item.quantity,
        remarks: item.remarks || null,
      })),
    },
  })
}

export async function receiveTransfer(token: string, transferId: number) {
  await request(`Transfer/Receive/${transferId}`, {
    method: 'PUT',
    token,
  })
}

export async function rejectTransfer(token: string, transferId: number) {
  await request(`Transfer/Reject/${transferId}`, {
    method: 'PUT',
    token,
  })
}

export async function cancelTransfer(token: string, transferId: number) {
  await request(`Transfer/Cancel/${transferId}`, {
    method: 'PUT',
    token,
  })
}

/** Open statuses where Receive / Reject / Cancel may still apply.
 * UAT keeps allowAccept/allowReject true even after Received — gate on status. */
export function isTransferActionableStatus(status?: string | null): boolean {
  const s = String(status || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!s) return false
  return (
    s === 'processing' ||
    s === 'pending' ||
    s === 'waiting' ||
    s === 'toreceive' ||
    s === 'confirm' ||
    s === 'confirmed'
  )
}
