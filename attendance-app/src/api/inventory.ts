import { request } from './client'
import type { Outlet } from '../types'

export type InventoryAdjustment = {
  id: number
  createdDate?: string
  stockTakeDate?: string
  createdBy?: string
  createdByRole?: string
  method?: string
  type?: string
  detail?: string
  status?: string
}

export type InventoryFilterOption = {
  fromDate?: string | null
  toDate?: string | null
  inventoryFilterType?: string | null
  inventoryMethod?: string | null
  /** Defaults to AutoCompleted for history list. */
  status?: string | null
}

export type InventoryDetailSummary = {
  ingredientCategory?: string
  ingredientGroup?: string
  actualValue?: number
  systemValue?: number
  variance?: number
}

export type InventoryDetailIngredient = {
  ingredientId?: number
  ingredientName?: string
  ingredientCategory?: string
  ingredientGroup?: string
  ingredientUOM?: string
  actualQuantity?: number
  systemQuantity?: number
  systemValue?: number
  actualValue?: number
  unitPrice?: number
  variance?: number
  location?: string
}

export type InventoryDetail = {
  id: number
  createdDate?: string
  stockTakeDate?: string
  method?: string
  type?: string
  detail?: string
  status?: string
  createdBy?: string
  role?: string
  summary?: InventoryDetailSummary[]
  ingredientDetail?: InventoryDetailIngredient[]
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : []
}

export async function getInventoryOutlets(token: string): Promise<Outlet[]> {
  const { data } = await request<unknown>('InventoryAdjustment/Outlet', { token })
  return asList<Record<string, unknown>>(data).flatMap((row) => {
    const outletId = Number(row.outletId ?? row.id)
    if (!Number.isFinite(outletId)) return []
    return [
      {
        outletId,
        name:
          (row.name as string | undefined) ||
          (row.outletName as string | undefined) ||
          `Outlet ${outletId}`,
        isDefault: Boolean(row.isDefault),
        outletAddress: (row.outletAddress as string | undefined) || undefined,
      } satisfies Outlet,
    ]
  })
}

export async function listInventoryAdjustments(
  token: string,
  outletId: number,
  filter: InventoryFilterOption = {},
  pageIndex = 1,
  pageSize = 20,
): Promise<InventoryAdjustment[]> {
  const { data } = await request<unknown>('InventoryAdjustment/List', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      fromDate: filter.fromDate ?? null,
      toDate: filter.toDate ?? null,
      inventoryFilterType: filter.inventoryFilterType ?? null,
      inventoryMethod: filter.inventoryMethod ?? null,
      status: filter.status ?? 'AutoCompleted',
      outletId,
    },
  })
  return asList<Record<string, unknown>>(data).map((row) => ({
    id: Number(row.id),
    createdDate: row.createdDate as string | undefined,
    stockTakeDate: row.stockTakeDate as string | undefined,
    createdBy: row.createdBy as string | undefined,
    createdByRole: row.createdByRole as string | undefined,
    method: row.method as string | undefined,
    type: row.type as string | undefined,
    detail: row.detail as string | undefined,
    status: row.status as string | undefined,
  }))
}

export async function getInventoryDetail(
  token: string,
  inventoryId: number,
  pageIndex = 1,
  pageSize = 50,
): Promise<InventoryDetail | null> {
  const { data } = await request<Record<string, unknown>>(
    `InventoryAdjustment/${inventoryId}`,
    {
      method: 'POST',
      token,
      body: { pageSize, pageIndex },
    },
  )
  if (!data || typeof data !== 'object') return null
  return {
    id: Number(data.id ?? inventoryId),
    createdDate: data.createdDate as string | undefined,
    stockTakeDate: data.stockTakeDate as string | undefined,
    method: data.method as string | undefined,
    type: data.type as string | undefined,
    detail: data.detail as string | undefined,
    status: data.status as string | undefined,
    createdBy: data.createdBy as string | undefined,
    role: data.role as string | undefined,
    summary: asList<InventoryDetailSummary>(data.summary),
    ingredientDetail: asList<InventoryDetailIngredient>(data.ingredientDetail).map(
      (row) => ({
        ingredientId: row.ingredientId != null ? Number(row.ingredientId) : undefined,
        ingredientName: row.ingredientName as string | undefined,
        ingredientCategory: row.ingredientCategory as string | undefined,
        ingredientGroup: row.ingredientGroup as string | undefined,
        ingredientUOM: row.ingredientUOM as string | undefined,
        actualQuantity:
          row.actualQuantity != null ? Number(row.actualQuantity) : undefined,
        systemQuantity:
          row.systemQuantity != null ? Number(row.systemQuantity) : undefined,
        systemValue: row.systemValue != null ? Number(row.systemValue) : undefined,
        actualValue: row.actualValue != null ? Number(row.actualValue) : undefined,
        unitPrice: row.unitPrice != null ? Number(row.unitPrice) : undefined,
        variance: row.variance != null ? Number(row.variance) : undefined,
        location: row.location as string | undefined,
      }),
    ),
  }
}

/** Load inventory header + all ingredient detail pages. */
export async function getFullInventoryDetail(
  token: string,
  inventoryId: number,
): Promise<InventoryDetail | null> {
  const first = await getInventoryDetail(token, inventoryId, 1, 50)
  if (!first) return null

  const all = [...(first.ingredientDetail || [])]
  let pageIndex = 2
  while (pageIndex <= 40) {
    const page = await getInventoryDetail(token, inventoryId, pageIndex, 50)
    const rows = page?.ingredientDetail || []
    if (rows.length === 0) break
    all.push(...rows)
    if (rows.length < 50) break
    pageIndex += 1
  }

  return { ...first, ingredientDetail: all }
}

export type InventoryOption = {
  id: number
  name: string
  /** Area: number of storages under this location */
  storageQuantity?: number
  /** Storage: number of ingredients in this storage */
  noOfIngredient?: number
  /** Storage parent area/location name from API */
  locationName?: string
  storageLocationName?: string | null
}

export type InventoryPackagingUnit = {
  vendorName?: string
  vendorId?: number
  deliveryPackage?: string
  looseUnit?: string
}

export type InventoryProductInfo = {
  productId?: number
  productName?: string
  vendorName?: string
  deliveryPackage?: string
  supplyUnit?: string
  recipeUnit?: string
  recipeQuantity?: number
}

export type InventoryIngredientRow = {
  id: number
  name: string
  recipeUnit?: string
  systemQuantity?: number
  isLooseCount?: boolean
  packagingUnits?: InventoryPackagingUnit[]
  product?: InventoryProductInfo | null
}

export type InventorySearchOption = {
  method: 'Spot' | 'Full'
  filterType: 'Category' | 'Storage'
  month?: string | null
  outletId: number
  locationId?: number | null
  storageId?: number | null
  categoryId?: number | null
  groupId?: number | null
  keyword?: string | null
}

export type CreateInventoryPayload = {
  inventoryMethod: 'Spot' | 'Full'
  inventoryFilterType: 'Category' | 'Storage'
  month?: string | null
  outletId: number
  locationId?: number | null
  storageId?: number | null
  categoryId?: number | null
  groupId?: number | null
  stockTakeDate: string
  inventories: Array<{
    ingredientId: number
    actualQuantity: number
    remark?: string | null
    location?: string | null
  }>
}

function mapOption(row: Record<string, unknown>): InventoryOption | null {
  const id = Number(
    row.id ?? row.outletStorageLocationId ?? row.storageId ?? row.outletId,
  )
  if (!Number.isFinite(id)) return null
  return {
    id,
    name: String(
      row.name ?? row.locationName ?? row.storageLocationName ?? `Item ${id}`,
    ),
    storageQuantity:
      row.storageQuantity != null ? Number(row.storageQuantity) : undefined,
    noOfIngredient:
      row.noOfIngredient != null ? Number(row.noOfIngredient) : undefined,
    locationName: (row.locationName as string | undefined) || undefined,
    storageLocationName:
      (row.storageLocationName as string | null | undefined) ?? null,
  }
}

export async function getInventoryLocations(
  token: string,
  outletId: number,
): Promise<InventoryOption[]> {
  const { data } = await request<unknown>(
    `InventoryAdjustment/Outlet/${outletId}/Storage/Location`,
    { token },
  )
  const fromLocations = asList<Record<string, unknown>>(data)
    .map(mapOption)
    .filter((o): o is InventoryOption => o != null)

  if (fromLocations.length > 0) return fromLocations

  // Some UAT outlets expose storages without Location rows — derive Areas from storages.
  const storages = await getInventoryStoragesByOutlet(token, outletId)
  const byArea = new Map<number, InventoryOption>()
  for (const row of storages) {
    const areaId = Number(row.outletStorageLocationId ?? row.locationId)
    if (!Number.isFinite(areaId) || byArea.has(areaId)) continue
    byArea.set(areaId, {
      id: areaId,
      name: String(row.locationName || row.storageLocationName || `Area ${areaId}`),
      storageQuantity: storages.filter(
        (s) => Number(s.outletStorageLocationId ?? s.locationId) === areaId,
      ).length,
    })
  }
  return [...byArea.values()]
}

/** All storages for an outlet (not filtered by area). */
export async function getInventoryStoragesByOutlet(
  token: string,
  outletId: number,
): Promise<
  Array<
    InventoryOption & {
      outletStorageLocationId?: number
      locationId?: number
    }
  >
> {
  const { data } = await request<unknown>(
    `InventoryAdjustment/Outlet/${outletId}/Storage`,
    { token },
  )
  return asList<Record<string, unknown>>(data).flatMap((row) => {
    const mapped = mapOption(row)
    if (!mapped) return []
    return [
      {
        ...mapped,
        outletStorageLocationId:
          row.outletStorageLocationId != null
            ? Number(row.outletStorageLocationId)
            : undefined,
        locationId:
          row.outletStorageLocationId != null
            ? Number(row.outletStorageLocationId)
            : row.locationId != null
              ? Number(row.locationId)
              : undefined,
      },
    ]
  })
}

export async function getInventoryStorages(
  token: string,
  outletId: number,
  locationId: number,
): Promise<InventoryOption[]> {
  const { data } = await request<unknown>(
    `InventoryAdjustment/Outlet/${outletId}/Storage/${locationId}`,
    { token },
  )
  const byLocation = asList<Record<string, unknown>>(data)
    .map(mapOption)
    .filter((o): o is InventoryOption => o != null)
  if (byLocation.length > 0) return byLocation

  // Fallback: filter outlet-wide storage list by area id.
  const all = await getInventoryStoragesByOutlet(token, outletId)
  return all.filter(
    (s) => Number(s.outletStorageLocationId ?? s.locationId) === locationId,
  )
}

export async function getInventoryCategories(
  token: string,
): Promise<InventoryOption[]> {
  const { data } = await request<unknown>(
    'InventoryAdjustment/Ingredient/Category',
    { token },
  )
  return asList<Record<string, unknown>>(data)
    .map(mapOption)
    .filter((o): o is InventoryOption => o != null)
}

export async function getInventoryGroups(
  token: string,
  categoryId: number,
): Promise<InventoryOption[]> {
  const { data } = await request<unknown>(
    `InventoryAdjustment/Ingredient/Group/${categoryId}`,
    { token },
  )
  return asList<Record<string, unknown>>(data)
    .map(mapOption)
    .filter((o): o is InventoryOption => o != null)
}

function mapIngredientRow(row: Record<string, unknown>): InventoryIngredientRow | null {
  const id = Number(row.id ?? row.ingredientId)
  if (!Number.isFinite(id)) return null
  const loose =
    row.isLooseCount && row.looseCount && typeof row.looseCount === 'object'
      ? (row.looseCount as Record<string, unknown>)
      : null
  const packaging = asList<Record<string, unknown>>(row.packagingUnits).map(
    (p) => ({
      vendorName: p.vendorName as string | undefined,
      vendorId: p.vendorId != null ? Number(p.vendorId) : undefined,
      deliveryPackage: p.deliveryPackage as string | undefined,
      looseUnit: p.looseUnit as string | undefined,
    }),
  )
  return {
    id,
    name: String(row.name ?? `Ingredient ${id}`),
    recipeUnit: row.recipeUnit as string | undefined,
    systemQuantity:
      row.systemQuantity != null ? Number(row.systemQuantity) : undefined,
    isLooseCount: Boolean(row.isLooseCount),
    packagingUnits: packaging,
    product: loose
      ? {
          productId:
            loose.productId != null ? Number(loose.productId) : undefined,
          productName: (loose.productName as string | undefined) || undefined,
          vendorName: (loose.vendorName as string | undefined) || undefined,
          deliveryPackage:
            (loose.deliveryPackage as string | undefined) || undefined,
          supplyUnit: (loose.supplyUnit as string | undefined) || undefined,
          recipeUnit: (loose.recipeUnit as string | undefined) || undefined,
          recipeQuantity:
            loose.recipeQuantity != null
              ? Number(loose.recipeQuantity)
              : undefined,
        }
      : packaging[0]
        ? {
            productName: packaging[0].vendorName,
            vendorName: packaging[0].vendorName,
            deliveryPackage: packaging[0].deliveryPackage,
            supplyUnit: packaging[0].looseUnit,
          }
        : null,
  }
}

/** UAT sometimes returns the same ingredient id multiple times in one page. */
function dedupeIngredients(
  rows: InventoryIngredientRow[],
): InventoryIngredientRow[] {
  const seen = new Set<number>()
  const out: InventoryIngredientRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export async function listInventoryIngredients(
  token: string,
  option: InventorySearchOption,
  pageIndex = 1,
  pageSize = 20,
): Promise<InventoryIngredientRow[]> {
  const { data } = await request<unknown>('InventoryAdjustment/Ingredient/List', {
    method: 'POST',
    token,
    body: {
      pageSize,
      pageIndex,
      selectedInventoryMethod: option.method,
      selectedInventoryFilterType: option.filterType,
      selectedMonth: option.month ?? null,
      selectedOutletId: option.outletId,
      selectedLocationId: option.locationId ?? null,
      selectedStorageId: option.storageId ?? null,
      selectedCategoryId: option.categoryId ?? null,
      selectedGroupId: option.groupId ?? null,
      keyword: option.keyword ?? null,
    },
  })
  return dedupeIngredients(
    asList<Record<string, unknown>>(data)
      .map(mapIngredientRow)
      .filter((row): row is InventoryIngredientRow => row != null),
  )
}

/** Unique ingredient count for one category/storage filter (paginated). */
export async function countInventoryIngredients(
  token: string,
  option: InventorySearchOption,
  maxPages = 20,
): Promise<number> {
  const seen = new Set<number>()
  for (let page = 1; page <= maxPages; page += 1) {
    const rows = await listInventoryIngredients(token, option, page, 50)
    for (const row of rows) seen.add(row.id)
    if (rows.length < 50) break
  }
  return seen.size
}

export async function createInventoryAdjustment(
  token: string,
  payload: CreateInventoryPayload,
): Promise<void> {
  await request('InventoryAdjustment/CreateInventoryAdjustment', {
    method: 'POST',
    token,
    body: {
      inventoryMethod: payload.inventoryMethod,
      inventoryFilterType: payload.inventoryFilterType,
      month: payload.month ?? null,
      outletId: payload.outletId,
      locationId: payload.locationId ?? null,
      storageId: payload.storageId ?? null,
      categoryId: payload.categoryId ?? null,
      groupId: payload.groupId ?? null,
      inventories: payload.inventories,
      stockTakeDate: payload.stockTakeDate,
    },
  })
}

/** Create a non-final draft inventory (Save). Returns resolved inventory id. */
export async function saveInventoryDraft(
  token: string,
  payload: CreateInventoryPayload,
  opts: {
    existingId?: number | null
    detailName?: string | null
  } = {},
): Promise<number> {
  const lines = payload.inventories.map((row) => ({
    ingredientId: row.ingredientId,
    actualQuantity: row.actualQuantity,
    remark: row.remark ?? null,
    location: row.location ?? null,
  }))

  if (opts.existingId) {
    await request(
      `InventoryAdjustment/UpdateInventoryAdjustment/${opts.existingId}`,
      {
        method: 'POST',
        token,
        body: lines,
      },
    )
    return opts.existingId
  }

  await createInventoryAdjustment(token, payload)

  // Create returns no entity id — resolve newest Draft/Pending match by detail name.
  const candidates = await listInventoryAdjustments(
    token,
    payload.outletId,
    {
      inventoryFilterType: payload.inventoryFilterType,
      inventoryMethod: payload.inventoryMethod,
      status: 'Draft',
    },
    1,
    40,
  )

  const detailName = (opts.detailName || '').trim().toLowerCase()
  const matches = candidates.filter((row) => {
    const status = (row.status || '').toLowerCase()
    if (status !== 'draft' && status !== 'pending') return false
    if (!detailName) return true
    return (row.detail || '').trim().toLowerCase() === detailName
  })

  const match = matches.sort((a, b) => Number(b.id) - Number(a.id))[0]
  if (!match?.id) {
    throw new Error('Saved, but could not resolve draft inventory id')
  }
  return match.id
}

/** Finalize one or more draft inventories (Submit). */
export async function submitInventoryAdjustments(
  token: string,
  inventoryIds: number[],
): Promise<void> {
  const unique = [...new Set(inventoryIds.filter((id) => Number.isFinite(id)))]
  if (unique.length === 0) {
    throw new Error('No saved inventory to submit')
  }
  for (const id of unique) {
    await request(`InventoryAdjustment/Submit/${id}`, {
      method: 'POST',
      token,
    })
  }
}

/**
 * Ingredient ids that belong to a category (InventoryAdjustment taxonomy).
 * Used because OperatorOrder/Ingredient ignores categoryId on UAT.
 */
export async function listIngredientIdsForCategory(
  token: string,
  outletId: number,
  categoryId: number,
): Promise<number[]> {
  const hits = await listSmartIngredientDirectory(token, outletId, {
    categoryId,
  })
  return hits.map((h) => h.id)
}

export type SmartIngredientHit = {
  id: number
  name: string
}

function smartNameFromRow(row: Record<string, unknown>) {
  return String(
    row.name ??
      row.Name ??
      row.ingredientName ??
      row.IngredientName ??
      row.smartIngredientName ??
      row.SmartIngredientName ??
      '',
  ).trim()
}

/**
 * Smart-ingredient id → display name directory from InventoryAdjustment.
 * OperatorOrder/Ingredient often omits ingredientName; use this to fill the
 * “Ingredient …” label on New Order rows.
 */
export async function listSmartIngredientDirectory(
  token: string,
  outletId: number,
  options?: { categoryId?: number | null; keyword?: string },
): Promise<SmartIngredientHit[]> {
  const hits: SmartIngredientHit[] = []
  const seen = new Set<number>()
  const pageSize = 100
  const keyword = (options?.keyword || '').trim()
  const categoryId =
    options?.categoryId != null && Number.isFinite(Number(options.categoryId))
      ? Number(options.categoryId)
      : null

  for (let pageIndex = 1; pageIndex <= 50; pageIndex += 1) {
    const { data } = await request<unknown>('InventoryAdjustment/Ingredient/List', {
      method: 'POST',
      token,
      body: {
        pageSize,
        pageIndex,
        selectedInventoryMethod: categoryId != null || keyword ? 'Spot' : 'Full',
        selectedInventoryFilterType: categoryId != null ? 'Category' : null,
        selectedMonth: null,
        selectedOutletId: outletId,
        selectedLocationId: null,
        selectedStorageId: null,
        selectedCategoryId: categoryId,
        selectedGroupId: null,
        keyword,
      },
    })
    const rows = asList<Record<string, unknown>>(data)
    for (const row of rows) {
      const id = Number(row.id ?? row.ingredientId ?? row.IngredientId)
      if (!Number.isFinite(id) || seen.has(id)) continue
      const name = smartNameFromRow(row)
      if (!name) continue
      seen.add(id)
      hits.push({ id, name })
    }
    if (rows.length < pageSize) break
  }
  return hits
}

/**
 * Search smart ingredients by name (InventoryAdjustment taxonomy).
 * Example: keyword "egg" → "Egg Fresh".
 */
export async function searchSmartIngredients(
  token: string,
  outletId: number,
  keyword: string,
): Promise<SmartIngredientHit[]> {
  const needle = keyword.trim()
  if (!needle) return []
  return listSmartIngredientDirectory(token, outletId, { keyword: needle })
}
