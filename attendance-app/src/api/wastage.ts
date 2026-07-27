import { request } from './client'

export type WastageInventoryType = 'Ingredient' | 'Product' | 'SubProduct'

export type WastageProduct = {
  id: number
  inventoryType: WastageInventoryType | string
  name: string
  uom?: string
  code?: string
  availableQuantity?: number | null
  unitPrice?: number
  category?: string | null
  group?: string | null
}

export type WastageProductDetail = WastageProduct & {
  recipeUnit?: string
  inventoryUnit?: string
  conversionRate?: number
  productionPrice?: number
  averagePrice?: number
  lowPrice?: number
  highPrice?: number
  availableQuantity?: number | null
}

export type WastageHistoryRow = {
  id: number
  date?: string
  createdBy?: string
  roleCode?: string
  amount?: string
  status?: string
  /** Reason text or id as returned by list / pending APIs. */
  reason?: string
}

export type WastageDetailItem = {
  type?: string
  name?: string
  category?: string
  group?: string
  uom?: string
  qty?: string
  unitPrice?: string
  total?: string
  reason?: string
  code?: string
}

export type WastageDetail = {
  id: number
  date?: string
  companyName?: string
  outletName?: string
  roleCode?: string
  createdBy?: string
  grandTotal?: string
  status?: string
  createdDate?: string
  lastUpdatedDate?: string | null
  allowApprove?: boolean
  allowReject?: boolean
  wastageItems: WastageDetailItem[]
}

export type WastageLinePayload = {
  itemType: string
  itemId: number
  quantity: number
  reason: number
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function mapProduct(row: Record<string, unknown>): WastageProduct | null {
  const id = Number(row.id ?? row.itemId ?? row.ingredientId)
  if (!Number.isFinite(id)) return null
  // dropDownHeader is a UI grouping hint on real items — do not skip those rows.
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

/** Catalog for wastage picker (Product / SubProduct / Ingredient). */
export async function getWastageGroupProducts(
  token: string,
  outletId: number,
): Promise<WastageProduct[]> {
  const { data } = await request<unknown>(
    `Wastage/GetGroupProducts?outletId=${outletId}`,
    { token },
  )
  return asList<Record<string, unknown>>(data)
    .map(mapProduct)
    .filter((p): p is WastageProduct => p != null)
}

/**
 * Ingredient search via InventoryAdjustment (supports keyword).
 * Used to catch ingredients that may be missing or mis-grouped in GetGroupProducts.
 */
export async function searchWastageIngredients(
  token: string,
  outletId: number,
  keyword: string,
): Promise<WastageProduct[]> {
  const { data } = await request<unknown>('InventoryAdjustment/Ingredient/List', {
    method: 'POST',
    token,
    body: {
      pageSize: 50,
      pageIndex: 1,
      selectedInventoryMethod: 'Spot',
      selectedInventoryFilterType: 'Category',
      selectedMonth: null,
      selectedOutletId: outletId,
      selectedLocationId: null,
      selectedStorageId: null,
      selectedCategoryId: null,
      selectedGroupId: null,
      keyword: keyword.trim() || null,
    },
  })
  const seen = new Set<number>()
  const rows: WastageProduct[] = []
  for (const row of asList<Record<string, unknown>>(data)) {
    const id = Number(row.id ?? row.ingredientId)
    if (!Number.isFinite(id) || seen.has(id)) continue
    seen.add(id)
    const name = String(row.name || '').trim()
    if (!name) continue
    rows.push({
      id,
      inventoryType: 'Ingredient',
      name,
      uom:
        (row.recipeUnit as string | undefined) ||
        (row.inventoryUnit as string | undefined) ||
        undefined,
      code: (row.code as string | undefined) || undefined,
      availableQuantity: num(row.systemQuantity) ?? null,
      unitPrice: num(row.unitPrice) ?? 0,
      category: (row.category as string | null | undefined) ?? null,
      group: (row.group as string | null | undefined) ?? null,
    })
  }
  return rows
}

/** Merge group products + ingredient keyword hits; prefer group-product row when duplicate. */
export async function searchWastageCatalog(
  token: string,
  outletId: number,
  keyword: string,
): Promise<WastageProduct[]> {
  const [groupProducts, ingredients] = await Promise.all([
    getWastageGroupProducts(token, outletId),
    searchWastageIngredients(token, outletId, keyword),
  ])
  const byKey = new Map<string, WastageProduct>()
  for (const row of ingredients) {
    byKey.set(`${row.inventoryType}:${row.id}`, row)
  }
  for (const row of groupProducts) {
    byKey.set(`${row.inventoryType}:${row.id}`, row)
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getWastageProductDetail(
  token: string,
  outletId: number,
  ingredientId: number,
): Promise<WastageProductDetail | null> {
  const qs = new URLSearchParams({
    ingredientId: String(ingredientId),
    returnLowAndHighPrice: 'true',
    outletId: String(outletId),
    toOutletId: String(outletId),
  })
  const { data } = await request<unknown>(
    `Wastage/GetGroupProductDetail?${qs.toString()}`,
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
    inventoryUnit: (row.inventoryUnitString as string | undefined) || undefined,
    conversionRate: num(row.conversionRate),
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

export async function listWastage(
  token: string,
  outletId: number | null | undefined,
  pageIndex = 1,
  pageSize = 20,
  keyword?: string | null,
  options?: { enrichReasons?: boolean },
): Promise<WastageHistoryRow[]> {
  const { data } = await request<unknown>('Wastage/List', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      selectedOutletId: outletId ?? null,
      selectedPeriod: null,
      selectedSortBy: null,
      keyword: keyword || null,
    },
  })
  const rows = asList<Record<string, unknown>>(data).map((row) => ({
    id: Number(row.id),
    date: row.date as string | undefined,
    createdBy: row.createdBy as string | undefined,
    roleCode: row.roleCode as string | undefined,
    amount: row.amount != null ? String(row.amount) : undefined,
    status: row.status as string | undefined,
    reason: pickWastageReason(row),
  }))

  // List often omits reason — optionally fill from detail so Recent Wastage
  // shows the reason the user selected when submitting.
  if (options?.enrichReasons) {
    const missing = rows.filter((r) => !r.reason && Number.isFinite(r.id))
    await Promise.all(
      missing.map(async (row) => {
        try {
          const detail = await getWastageDetail(token, row.id)
          if (!detail) return
          const labels = [
            ...new Set(
              detail.wastageItems
                .map((item) => formatWastageReason(item.reason))
                .filter((v): v is string => !!v),
            ),
          ]
          if (labels.length > 0) row.reason = labels.join(', ')
        } catch {
          /* keep row without reason */
        }
      }),
    )
  }

  return rows
}

export async function getWastageDetail(
  token: string,
  wastageId: number,
): Promise<WastageDetail | null> {
  const { data } = await request<unknown>(`Wastage/GetWastage/${wastageId}`, {
    token,
  })
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const id = Number(row.id)
  if (!Number.isFinite(id)) return null
  return {
    id,
    date: row.date as string | undefined,
    companyName: row.companyName as string | undefined,
    outletName: row.outletName as string | undefined,
    roleCode: row.roleCode as string | undefined,
    createdBy: row.createdBy as string | undefined,
    grandTotal: row.grandTotal != null ? String(row.grandTotal) : undefined,
    status: row.status as string | undefined,
    createdDate: row.createdDate as string | undefined,
    lastUpdatedDate: (row.lastUpdatedDate as string | null | undefined) ?? null,
    allowApprove: Boolean(row.allowApprove),
    allowReject: Boolean(row.allowReject),
    wastageItems: asList<Record<string, unknown>>(row.wastageItems).map(
      (item) => ({
        type: item.type as string | undefined,
        name: item.name as string | undefined,
        category: item.category as string | undefined,
        group: item.group as string | undefined,
        uom: item.uom as string | undefined,
        qty: item.qty != null ? String(item.qty) : undefined,
        unitPrice: item.unitPrice != null ? String(item.unitPrice) : undefined,
        total: item.total != null ? String(item.total) : undefined,
        reason: formatWastageReason(
          item.reason ?? item.reasonId ?? item.remarks ?? item.reasonName,
        ),
        code: item.code as string | undefined,
      }),
    ),
  }
}

/** Pending wastage entries awaiting approval (Home → To Approve). */
export async function listPendingWastage(
  token: string,
  outletId?: number | null,
): Promise<WastageHistoryRow[]> {
  const rows = await listWastage(token, outletId ?? null, 1, 50)
  return rows
    .filter((row) => String(row.status || '').toLowerCase() === 'pending')
    .sort((a, b) => a.id - b.id)
}

export async function approveWastage(token: string, wastageId: number) {
  await request(`Wastage/Approve/${wastageId}`, {
    method: 'PUT',
    token,
  })
}

export async function rejectWastage(token: string, wastageId: number) {
  await request(`Wastage/Reject/${wastageId}`, {
    method: 'PUT',
    token,
  })
}

export async function addWastage(
  token: string,
  outletId: number,
  items: WastageLinePayload[],
  settingDate?: string | null,
): Promise<void> {
  // UAT rejects null settingDate with HTTP 500 — always send a date-time.
  const date =
    settingDate ||
    (() => {
      const d = new Date()
      d.setHours(12, 0, 0, 0)
      return d.toISOString()
    })()

  await request('Wastage/Add', {
    method: 'POST',
    token,
    body: {
      settingDate: date,
      selectedOutletId: outletId,
      wastageItems: items.map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        quantity: item.quantity,
        reason: item.reason,
      })),
    },
  })
}

/** UI labels ↔ API reason int (labels match known UAT wastage text). */
export const WASTAGE_REASONS: { id: number; label: string }[] = [
  { id: 1, label: 'Food Expiry' },
  { id: 2, label: 'Food Testing' },
  { id: 3, label: 'Spoilage' },
  { id: 4, label: 'Damage' },
  { id: 5, label: 'Preparation Waste' },
  { id: 6, label: 'Theft / Loss' },
  { id: 0, label: 'Other' },
]

/** Map API reason id/enum/string to the label the user selected. */
export function formatWastageReason(raw: unknown): string | undefined {
  if (raw == null || raw === '') return undefined
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const hit = WASTAGE_REASONS.find((r) => r.id === Number(raw))
    return hit?.label ?? String(raw)
  }
  const text = String(raw).trim()
  if (!text) return undefined
  // Numeric string from API ("1", "3")
  if (/^\d+$/.test(text)) {
    const hit = WASTAGE_REASONS.find((r) => r.id === Number(text))
    return hit?.label ?? text
  }
  // Enum-style tokens (FoodExpiry → Food Expiry) when they match known labels
  const compact = text.replace(/[\s_/-]+/g, '').toLowerCase()
  const byLabel = WASTAGE_REASONS.find(
    (r) => r.label.replace(/[\s_/-]+/g, '').toLowerCase() === compact,
  )
  if (byLabel) return byLabel.label
  return text
}

function pickWastageReason(row: Record<string, unknown>): string | undefined {
  const direct = formatWastageReason(
    row.reason ??
      row.reasonName ??
      row.remarks ??
      row.wastageReason ??
      row.reasonId ??
      row.Reason ??
      row.Remarks,
  )
  if (direct) return direct

  // Some list payloads nest line reasons under wastageItems / items.
  const nested = asList<Record<string, unknown>>(
    row.wastageItems ?? row.items ?? row.details,
  )
  const labels = nested
    .map((item) =>
      formatWastageReason(
        item.reason ?? item.reasonId ?? item.remarks ?? item.reasonName,
      ),
    )
    .filter((v): v is string => !!v)
  if (labels.length === 0) return undefined
  // Unique reasons in selection order (e.g. "Spoilage, Damage")
  return [...new Set(labels)].join(', ')
}
