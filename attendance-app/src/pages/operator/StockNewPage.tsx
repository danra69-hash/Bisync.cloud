import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canEditInventory } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  countInventoryIngredients,
  getInventoryCategories,
  getInventoryLocations,
  getInventoryStorages,
  listInventoryIngredients,
  saveInventoryDraft,
  submitInventoryAdjustments,
  type InventoryIngredientRow,
  type InventoryOption,
} from '../../api/inventory'

type Method = 'Spot' | 'Full'
type FilterType = 'Category' | 'Storage'

type QtyState = {
  recipe: string
  inventory: string
}

type ActiveSection = {
  key: string
  name: string
  categoryId?: number
  locationId?: number
  storageId?: number
}

type SavedDraft = {
  inventoryId: number
  name: string
  categoryId?: number
  locationId?: number
  storageId?: number
  qtyById: Record<number, QtyState>
}

const SESSION_KEY = 'bisync_inventory_session_drafts_v1'

type SessionBag = {
  outletId: number
  method: Method
  filterType: FilterType
  month: string
  stockTakeDate: string
  drafts: Record<string, SavedDraft>
}

function readSessionBag(outletId: number | null | undefined): SessionBag | null {
  if (outletId == null || typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY}:${outletId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionBag
    if (!parsed || parsed.outletId !== outletId || typeof parsed.drafts !== 'object') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeSessionBag(bag: SessionBag | null) {
  if (typeof sessionStorage === 'undefined') return
  if (!bag) return
  sessionStorage.setItem(`${SESSION_KEY}:${bag.outletId}`, JSON.stringify(bag))
}

function clearSessionBag(outletId: number | null | undefined) {
  if (outletId == null || typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(`${SESSION_KEY}:${outletId}`)
}

function categoryKey(id: number) {
  return `category:${id}`
}

function storageKey(locationId: number, storageId: number) {
  return `storage:${locationId}:${storageId}`
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatQty(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function parseNum(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** conversionRate = inventory units per 1 recipe unit */
function recipeToInventory(recipeQty: number, rate?: number) {
  if (!rate || rate <= 0) return recipeQty
  return recipeQty * rate
}

function inventoryToRecipe(inventoryQty: number, rate?: number) {
  if (!rate || rate <= 0) return inventoryQty
  return inventoryQty / rate
}

function systemInInventory(systemRecipe?: number, rate?: number) {
  if (systemRecipe == null) return null
  return recipeToInventory(systemRecipe, rate)
}

function formatEditable(n: number) {
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n * 100) / 100)
}

export function OperatorStockNewPage() {
  const { token, hasPermission } = useAuth()
  const { selectedLocationId, selectedLocation } = useLocationFilter()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const canAdd = canEditInventory(hasPermission)
  const outletId = selectedLocationId

  const [method, setMethod] = useState<Method>('Spot')
  const [filterType, setFilterType] = useState<FilterType>('Category')
  const [month, setMonth] = useState('')
  /** Area = outlet storage location */
  const [areaId, setAreaId] = useState<number | ''>('')
  /** Storage within the selected Area */
  const [storageId, setStorageId] = useState<number | ''>('')
  const [stockTakeDate, setStockTakeDate] = useState(todayYmd)
  const [active, setActive] = useState<ActiveSection | null>(null)
  const [ingredients, setIngredients] = useState<InventoryIngredientRow[]>([])
  const [qtyById, setQtyById] = useState<Record<number, QtyState>>({})
  /** Category mode: which category boxes are ticked. */
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
  /** Cache of ingredients per category so reticking does not refetch. */
  const [categoryRowsCache, setCategoryRowsCache] = useState<
    Record<number, InventoryIngredientRow[]>
  >({})
  /** Maps ingredient id → category id it was loaded from. */
  const [ingredientCategoryById, setIngredientCategoryById] = useState<
    Record<number, number>
  >({})
  const [savedDrafts, setSavedDrafts] = useState<Record<string, SavedDraft>>(
    () => readSessionBag(selectedLocationId)?.drafts || {},
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loadingSection, setLoadingSection] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [hydratedOutletId, setHydratedOutletId] = useState<number | null>(
    selectedLocationId ?? null,
  )

  // Restore / switch session drafts when outlet changes.
  useEffect(() => {
    if (outletId == null) {
      setSavedDrafts({})
      setHydratedOutletId(null)
      return
    }
    if (hydratedOutletId === outletId) return
    const bag = readSessionBag(outletId)
    setSavedDrafts(bag?.drafts || {})
    if (bag) {
      setMethod(bag.method)
      setFilterType(bag.filterType)
      setMonth(bag.month || '')
      setStockTakeDate(bag.stockTakeDate || todayYmd())
    }
    setHydratedOutletId(outletId)
    setActive(null)
    setIngredients([])
    setQtyById({})
    setSelectedCategoryIds([])
    setCategoryRowsCache({})
    setIngredientCategoryById({})
    setAreaId('')
    setStorageId('')
    setError(null)
    setMessage(null)
    setShowSubmitConfirm(false)
  }, [outletId, hydratedOutletId])

  // Persist drafts in sessionStorage until Submit.
  useEffect(() => {
    if (outletId == null || hydratedOutletId !== outletId) return
    if (Object.keys(savedDrafts).length === 0) {
      clearSessionBag(outletId)
      return
    }
    writeSessionBag({
      outletId,
      method,
      filterType,
      month,
      stockTakeDate,
      drafts: savedDrafts,
    })
  }, [
    outletId,
    hydratedOutletId,
    method,
    filterType,
    month,
    stockTakeDate,
    savedDrafts,
  ])

  useEffect(() => {
    setActive(null)
    setIngredients([])
    setQtyById({})
    setSelectedCategoryIds([])
    setCategoryRowsCache({})
    setIngredientCategoryById({})
    setError(null)
    setMessage(null)
    setShowSubmitConfirm(false)
  }, [method, filterType, month, stockTakeDate])

  useEffect(() => {
    if (filterType === 'Category') {
      setAreaId('')
      setStorageId('')
      setActive(null)
    } else {
      setActive(null)
      setSelectedCategoryIds([])
      setCategoryRowsCache({})
      setIngredientCategoryById({})
      setIngredients([])
      setQtyById({})
    }
  }, [filterType])

  useEffect(() => {
    setStorageId('')
  }, [areaId])

  useEffect(() => {
    if (method === 'Spot') setMonth('')
  }, [method])

  const categories = useQuery({
    queryKey: ['inventory-categories', token],
    enabled: !!token && filterType === 'Category',
    queryFn: () => getInventoryCategories(token!),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const categoryCounts = useQuery({
    queryKey: [
      'inventory-category-counts',
      outletId,
      method,
      month,
      token,
      (categories.data || []).map((c) => c.id).join(','),
    ],
    enabled:
      !!token &&
      !!outletId &&
      filterType === 'Category' &&
      (categories.data || []).length > 0 &&
      (method !== 'Full' || !!month),
    queryFn: async () => {
      const list = categories.data || []
      const entries = await Promise.all(
        list.map(async (cat) => {
          try {
            const count = await countInventoryIngredients(token!, {
              method,
              filterType: 'Category',
              month: method === 'Full' ? month || null : null,
              outletId: outletId!,
              categoryId: cat.id,
              groupId: null,
              locationId: null,
              storageId: null,
              keyword: null,
            })
            return [cat.id, count] as const
          } catch {
            return [cat.id, null] as const
          }
        }),
      )
      return Object.fromEntries(entries) as Record<number, number | null>
    },
    staleTime: 0,
  })

  const areas = useQuery({
    queryKey: ['inventory-locations', outletId, token],
    enabled: !!token && !!outletId && filterType === 'Storage',
    queryFn: () => getInventoryLocations(token!, outletId!),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const storages = useQuery({
    queryKey: ['inventory-storages', outletId, areaId, token],
    enabled:
      !!token &&
      !!outletId &&
      filterType === 'Storage' &&
      typeof areaId === 'number',
    queryFn: () => getInventoryStorages(token!, outletId!, areaId as number),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Auto-select the only Area when the outlet has exactly one.
  useEffect(() => {
    if (filterType !== 'Storage') return
    if (typeof areaId === 'number') return
    const list = areas.data || []
    if (list.length === 1) setAreaId(list[0].id)
  }, [filterType, areaId, areas.data])

  const savedCount = Object.keys(savedDrafts).length

  const totals = useMemo(() => {
    let recipeTotal = 0
    let inventoryTotal = 0
    let systemRecipeTotal = 0
    for (const row of ingredients) {
      const qty = qtyById[row.id]
      recipeTotal += parseNum(qty?.recipe ?? '0')
      inventoryTotal += parseNum(qty?.inventory ?? '0')
      systemRecipeTotal += Number(row.systemQuantity ?? 0)
    }
    return {
      recipeTotal,
      inventoryTotal,
      systemRecipeTotal,
      difference: recipeTotal - systemRecipeTotal,
    }
  }, [ingredients, qtyById])

  function setRecipeQty(row: InventoryIngredientRow, value: string) {
    setQtyById((prev) => ({
      ...prev,
      [row.id]: {
        recipe: value,
        inventory: formatEditable(
          recipeToInventory(parseNum(value), row.conversionRate),
        ),
      },
    }))
  }

  function setInventoryQty(row: InventoryIngredientRow, value: string) {
    setQtyById((prev) => ({
      ...prev,
      [row.id]: {
        inventory: value,
        recipe: formatEditable(
          inventoryToRecipe(parseNum(value), row.conversionRate),
        ),
      },
    }))
  }

  async function loadIngredients(option: {
    categoryId?: number | null
    locationId?: number | null
    storageId?: number | null
  }) {
    if (!token || outletId == null) return []
    const all: InventoryIngredientRow[] = []
    for (let page = 1; page <= 40; page += 1) {
      const rows = await listInventoryIngredients(
        token,
        {
          method,
          filterType,
          month: method === 'Full' ? month || null : null,
          outletId,
          categoryId: option.categoryId ?? null,
          groupId: null,
          locationId: option.locationId ?? null,
          storageId: option.storageId ?? null,
          keyword: null,
        },
        page,
        50,
      )
      all.push(...rows)
      if (rows.length < 50) break
    }
    return all
  }

  function validateSetup(): string | null {
    if (!outletId) return 'Select a location in the top bar'
    if (method === 'Full' && !month) return 'Please select a month'
    if (!stockTakeDate) return 'Please select a stock take date'
    return null
  }

  function qtyFromDraft(
    key: string,
    rows: InventoryIngredientRow[],
  ): Record<number, QtyState> {
    const saved = savedDrafts[key]?.qtyById
    const nextQty: Record<number, QtyState> = {}
    for (const row of rows) {
      nextQty[row.id] = saved?.[row.id] || { recipe: '0', inventory: '0' }
    }
    return nextQty
  }

  function rebuildCategoryIngredients(
    ids: number[],
    cache: Record<number, InventoryIngredientRow[]>,
    prevQty: Record<number, QtyState>,
  ) {
    const seen = new Set<number>()
    const rows: InventoryIngredientRow[] = []
    const source: Record<number, number> = {}
    const nextQty: Record<number, QtyState> = { ...prevQty }

    for (const catId of ids) {
      const catRows = cache[catId] || []
      const draft = qtyFromDraft(categoryKey(catId), catRows)
      for (const row of catRows) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        rows.push(row)
        source[row.id] = catId
        if (!nextQty[row.id]) {
          nextQty[row.id] = draft[row.id] || { recipe: '0', inventory: '0' }
        }
      }
    }
    return { rows, source, nextQty }
  }

  async function toggleCategory(category: InventoryOption) {
    const validation = validateSetup()
    if (validation) {
      setError(validation)
      return
    }
    setError(null)

    const already = selectedCategoryIds.includes(category.id)
    if (already) {
      const nextIds = selectedCategoryIds.filter((id) => id !== category.id)
      setSelectedCategoryIds(nextIds)
      const built = rebuildCategoryIngredients(
        nextIds,
        categoryRowsCache,
        qtyById,
      )
      setIngredients(built.rows)
      setIngredientCategoryById(built.source)
      setQtyById(built.nextQty)
      return
    }

    setLoadingSection(true)
    try {
      let rows = categoryRowsCache[category.id]
      if (!rows) {
        rows = await loadIngredients({ categoryId: category.id })
      }
      const nextCache = { ...categoryRowsCache, [category.id]: rows }
      setCategoryRowsCache(nextCache)
      const nextIds = [...selectedCategoryIds, category.id]
      setSelectedCategoryIds(nextIds)
      const built = rebuildCategoryIngredients(nextIds, nextCache, qtyById)
      setIngredients(built.rows)
      setIngredientCategoryById(built.source)
      setQtyById(built.nextQty)
      setMessage(null)
    } catch (err) {
      setError((err as Error).message || 'Failed to load ingredients')
    } finally {
      setLoadingSection(false)
    }
  }

  async function openStorageCount(storage: InventoryOption) {
    if (typeof areaId !== 'number') {
      setError('Please select an area (location)')
      return
    }
    const validation = validateSetup()
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setLoadingSection(true)
    try {
      const key = storageKey(Number(areaId), storage.id)
      const rows = await loadIngredients({
        locationId: Number(areaId),
        storageId: storage.id,
      })
      setIngredients(rows)
      setQtyById(qtyFromDraft(key, rows))
      setActive({
        key,
        name: storage.name,
        locationId: Number(areaId),
        storageId: storage.id,
      })
      setMessage(null)
    } catch (err) {
      setError((err as Error).message || 'Failed to load ingredients')
    } finally {
      setLoadingSection(false)
    }
  }

  function onStorageSelected(nextStorageId: number | '') {
    setStorageId(nextStorageId)
    if (typeof nextStorageId !== 'number') return
    const storage = (storages.data || []).find((s) => s.id === nextStorageId)
    if (storage) void openStorageCount(storage)
  }

  const areaName =
    typeof areaId === 'number'
      ? (areas.data || []).find((a) => a.id === areaId)?.name
      : undefined

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token || !outletId) {
        throw new Error('Select a location first')
      }

      if (filterType === 'Category') {
        if (selectedCategoryIds.length === 0) {
          throw new Error('Tick at least one category')
        }
        if (ingredients.length === 0) {
          throw new Error('No ingredients to save')
        }
        const results: Array<SavedDraft & { key: string }> = []
        for (const catId of selectedCategoryIds) {
          const catIngredients = ingredients.filter(
            (row) => ingredientCategoryById[row.id] === catId,
          )
          if (catIngredients.length === 0) continue
          const cat = (categories.data || []).find((c) => c.id === catId)
          const key = categoryKey(catId)
          const existingId = savedDrafts[key]?.inventoryId
          const name = cat?.name || `Category ${catId}`
          const inventoryId = await saveInventoryDraft(
            token,
            {
              inventoryMethod: method,
              inventoryFilterType: filterType,
              month: method === 'Full' ? month : null,
              outletId,
              locationId: null,
              storageId: null,
              categoryId: catId,
              groupId: null,
              stockTakeDate,
              inventories: catIngredients.map((row) => ({
                ingredientId: row.id,
                actualQuantity: parseNum(qtyById[row.id]?.recipe ?? '0'),
                remark: null,
                location: null,
              })),
            },
            {
              existingId,
              detailName: name,
            },
          )
          const catQty: Record<number, QtyState> = {}
          for (const row of catIngredients) {
            catQty[row.id] = qtyById[row.id] || {
              recipe: '0',
              inventory: '0',
            }
          }
          results.push({
            key: key,
            inventoryId,
            name,
            categoryId: catId,
            qtyById: catQty,
          })
        }
        if (results.length === 0) {
          throw new Error('No ingredients to save')
        }
        return { mode: 'category' as const, results }
      }

      if (!active) {
        throw new Error('Open a storage first')
      }
      if (ingredients.length === 0) {
        throw new Error('No ingredients to save')
      }
      const existingId = savedDrafts[active.key]?.inventoryId
      const inventoryId = await saveInventoryDraft(
        token,
        {
          inventoryMethod: method,
          inventoryFilterType: filterType,
          month: method === 'Full' ? month : null,
          outletId,
          locationId: active.locationId ?? null,
          storageId: active.storageId ?? null,
          categoryId: active.categoryId ?? null,
          groupId: null,
          stockTakeDate,
          inventories: ingredients.map((row) => ({
            ingredientId: row.id,
            actualQuantity: parseNum(qtyById[row.id]?.recipe ?? '0'),
            remark: null,
            location: null,
          })),
        },
        {
          existingId,
          detailName: active.name,
        },
      )
      return {
        mode: 'storage' as const,
        results: [
          {
            key: active.key,
            inventoryId,
            name: active.name,
            categoryId: active.categoryId,
            locationId: active.locationId,
            storageId: active.storageId,
            qtyById: { ...qtyById },
          },
        ],
      }
    },
    onSuccess: (saved) => {
      setSavedDrafts((prev) => {
        const next = { ...prev }
        for (const item of saved.results) {
          next[item.key] = {
            inventoryId: item.inventoryId,
            name: item.name,
            categoryId: item.categoryId,
            locationId: item.locationId,
            storageId: item.storageId,
            qtyById: item.qtyById,
          }
        }
        return next
      })
      const names = saved.results.map((r) => r.name).join(', ')
      setMessage(
        saved.mode === 'category'
          ? `Saved ${saved.results.length} categor${saved.results.length === 1 ? 'y' : 'ies'}: ${names}`
          : `Saved “${names}” (kept until Submit)`,
      )
      setError(null)
      if (saved.mode === 'storage') {
        setActive(null)
        setIngredients([])
        setQtyById({})
      }
    },
    onError: (err) =>
      setError((err as Error).message || 'Failed to save inventory'),
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not signed in')
      const ids = Object.values(savedDrafts).map((d) => d.inventoryId)
      await submitInventoryAdjustments(token, ids)
    },
    onSuccess: async () => {
      setShowSubmitConfirm(false)
      setSubmitted(true)
      setSavedDrafts({})
      clearSessionBag(outletId)
      await qc.invalidateQueries({ queryKey: ['inventory-list'] })
    },
    onError: (err) => {
      setShowSubmitConfirm(false)
      setError((err as Error).message || 'Failed to submit inventory')
    },
  })

  if (!canAdd) {
    return (
      <div className="stack inventory-page">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <PermissionDenied
          title="Create inventory unavailable"
          message="Inventory add/edit permission is required to create inventory."
        />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="stack inventory-page">
        <div className="card stack" style={{ textAlign: 'center', padding: 28 }}>
          <h2 style={{ margin: 0 }}>Inventory Submitted</h2>
          <p className="muted" style={{ margin: 0 }}>
            Your saved inventory counts were submitted successfully.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/operator/stock/inventory')}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  if (active && filterType === 'Storage') {
    const alreadySaved = !!savedDrafts[active.key]
    return (
      <div className="stack inventory-page">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setActive(null)
            setIngredients([])
            setQtyById({})
            setError(null)
          }}
        >
          ← Back
        </button>

        <div>
          <h2 style={{ margin: '0 0 4px' }}>{active.name}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {method} · {filterType}
            {filterType === 'Storage' && areaName ? ` · Area: ${areaName}` : ''}
            {selectedLocation?.name ? ` · ${selectedLocation.name}` : ''}
            {alreadySaved ? ' · Saved draft' : ''}
          </p>
        </div>

        <div className="card inventory-count-summary">
          <div>
            <span className="muted">Total inventory qty</span>
            <strong>{formatQty(totals.inventoryTotal)}</strong>
          </div>
          <div>
            <span className="muted">System qty (recipe)</span>
            <strong>{formatQty(totals.systemRecipeTotal)}</strong>
          </div>
          <div>
            <span className="muted">Difference to system</span>
            <strong
              className={
                totals.difference === 0
                  ? undefined
                  : totals.difference > 0
                    ? 'inventory-diff-pos'
                    : 'inventory-diff-neg'
              }
            >
              {formatQty(totals.difference)}
            </strong>
          </div>
        </div>

        {ingredients.length === 0 && (
          <div className="card stack" style={{ textAlign: 'center', gap: 8 }}>
            <p style={{ margin: 0 }}>No ingredients for this category</p>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              InventoryAdjustment on UAT returned none for{' '}
              <strong>{active.name}</strong>
              {selectedLocation?.name ? ` at ${selectedLocation.name}` : ''}.
              Try FOOD or ASSETS on this outlet, or switch to an outlet with
              stocked inventory (e.g. TEST 1 OUTLET #2).
            </p>
          </div>
        )}

        <div className="stack" style={{ gap: 10 }}>
          {ingredients.map((row) => {
            const qty = qtyById[row.id] || { recipe: '0', inventory: '0' }
            const recipeActual = parseNum(qty.recipe)
            const system = Number(row.systemQuantity ?? 0)
            const diff = recipeActual - system
            const systemInv = systemInInventory(system, row.conversionRate)
            const products = [
              ...(row.product?.productName ? [row.product] : []),
              ...(row.packagingUnits || [])
                .filter((p) => p.deliveryPackage || p.vendorName)
                .map((p) => ({
                  productName: p.deliveryPackage || 'Product',
                  vendorName: p.vendorName,
                  deliveryPackage: p.deliveryPackage,
                  supplyUnit: p.looseUnit,
                })),
            ]

            return (
              <article key={row.id} className="card inventory-count-card">
                <strong className="inventory-count-name">{row.name}</strong>

                {products.length > 0 && (
                  <div className="inventory-count-products">
                    {products.map((p, idx) => (
                      <div key={`${row.id}-p-${idx}`} className="muted">
                        {[p.productName, p.vendorName, p.deliveryPackage]
                          .filter(Boolean)
                          .join(' · ')}
                        {p.supplyUnit ? ` (${p.supplyUnit})` : ''}
                      </div>
                    ))}
                  </div>
                )}

                <div className="inventory-count-system muted">
                  System qty: {formatQty(row.systemQuantity)}{' '}
                  {row.recipeUnit || ''}
                  {systemInv != null && row.inventoryUnit
                    ? ` · ${formatQty(systemInv)} ${row.inventoryUnit}`
                    : ''}
                </div>

                <div className="inventory-count-qty-grid">
                  <label className="inventory-count-qty">
                    <span>
                      Recipe UOM
                      {row.recipeUnit ? ` (${row.recipeUnit})` : ''}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={qty.recipe}
                      onChange={(e) => setRecipeQty(row, e.target.value)}
                    />
                  </label>
                  <label className="inventory-count-qty">
                    <span>
                      Inventory UOM
                      {row.inventoryUnit ? ` (${row.inventoryUnit})` : ''}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={qty.inventory}
                      onChange={(e) => setInventoryQty(row, e.target.value)}
                    />
                  </label>
                </div>

                <div className="inventory-count-footer">
                  <span className="muted">
                    Inventory qty: {formatQty(parseNum(qty.inventory))}{' '}
                    {row.inventoryUnit || ''}
                  </span>
                  <span
                    className={
                      diff === 0
                        ? 'muted'
                        : diff > 0
                          ? 'inventory-diff-pos'
                          : 'inventory-diff-neg'
                    }
                  >
                    Diff: {formatQty(diff)} {row.recipeUnit || ''}
                  </span>
                </div>
              </article>
            )
          })}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="btn-row inventory-create-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActive(null)
              setIngredients([])
              setQtyById({})
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveMutation.isPending || ingredients.length === 0}
            onClick={() => {
              setError(null)
              saveMutation.mutate()
            }}
          >
            {saveMutation.isPending
              ? 'Saving…'
              : alreadySaved
                ? 'Save again'
                : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack inventory-page">
      <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div>
        <h2 style={{ margin: '0 0 4px' }}>Create New Inventory</h2>
        <p className="muted" style={{ margin: 0 }}>
          {selectedLocation?.name
            ? `Outlet: ${selectedLocation.name}`
            : 'Select a location in the top bar'}
        </p>
      </div>

      <div className="card stack">
        <div className="view-by-group">
          <span className="view-by-label">Method</span>
          <button
            type="button"
            className={`chip${method === 'Spot' ? ' active' : ''}`}
            onClick={() => setMethod('Spot')}
          >
            Spot Inventory
          </button>
          <button
            type="button"
            className={`chip${method === 'Full' ? ' active' : ''}`}
            onClick={() => setMethod('Full')}
          >
            Full Inventory
          </button>
        </div>

        <label className="inventory-inline-field">
          <span>Inventory type</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
          >
            <option value="Category">Category</option>
            <option value="Storage">Storage</option>
          </select>
        </label>

        {method === 'Full' && (
          <label className="inventory-inline-field">
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">— Please select —</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="inventory-inline-field">
          <span>Stock take date</span>
          <input
            type="date"
            value={stockTakeDate}
            max={todayYmd()}
            min="2020-01-01"
            onChange={(e) => setStockTakeDate(e.target.value)}
          />
        </label>

        {filterType === 'Storage' && (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Using outlet:{' '}
              <strong>{selectedLocation?.name || 'none selected'}</strong>
              {outletId != null ? ` (#${outletId})` : ''}. Areas are loaded for
              this outlet only — switch outlet in the top bar if your new Area
              is under a different outlet.
            </p>

            <label className="inventory-inline-field">
              <span>Area</span>
              <select
                value={areaId}
                onChange={(e) => {
                  setAreaId(e.target.value ? Number(e.target.value) : '')
                  setStorageId('')
                }}
                disabled={!outletId || areas.isLoading}
              >
                <option value="">
                  {!outletId
                    ? 'Select outlet first'
                    : areas.isLoading
                      ? 'Loading…'
                      : areas.isError
                        ? 'Failed to load areas'
                        : (areas.data || []).length === 0
                          ? 'No area for this outlet'
                          : '— Select area (location) —'}
                </option>
                {(areas.data || []).map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                    {area.storageQuantity != null
                      ? ` (${area.storageQuantity} storage${area.storageQuantity === 1 ? '' : 's'})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            {areas.isError && (
              <p className="error-text" style={{ margin: 0 }}>
                {(areas.error as Error)?.message || 'Failed to load areas'}{' '}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void areas.refetch()}
                >
                  Retry
                </button>
              </p>
            )}

            {!areas.isLoading &&
              !areas.isError &&
              outletId != null &&
              (areas.data || []).length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  No Area found for this outlet on UAT. Add a storage{' '}
                  <em>location</em> (Area) under this outlet in the cloud site,
                  or switch to an outlet that has areas (e.g. TEST 3 OUTLET #1 →
                  Fatimah, or TEST 2 OUTLET #2 → WEILIK UAT).
                </p>
              )}

            <label className="inventory-inline-field">
              <span>Storage</span>
              <select
                value={storageId}
                onChange={(e) =>
                  onStorageSelected(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
                disabled={typeof areaId !== 'number' || storages.isLoading}
              >
                <option value="">
                  {typeof areaId !== 'number'
                    ? 'Select area first'
                    : storages.isLoading
                      ? 'Loading…'
                      : (storages.data || []).length === 0
                        ? 'No storage in this area'
                        : '— Select storage —'}
                </option>
                {(storages.data || []).map((storage) => (
                  <option key={storage.id} value={storage.id}>
                    {storage.name}
                    {storage.noOfIngredient != null
                      ? ` (${storage.noOfIngredient} item${storage.noOfIngredient === 1 ? '' : 's'})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Area = location. Storage = storage inside that area.
            </p>
          </>
        )}
      </div>

      {filterType === 'Category' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="order-card-row">
            <h3 style={{ margin: 0, fontSize: 15 }}>Categories</h3>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={categories.isFetching || categoryCounts.isFetching}
              onClick={() => {
                void categories.refetch()
                void categoryCounts.refetch()
              }}
            >
              {categories.isFetching || categoryCounts.isFetching
                ? 'Refreshing…'
                : 'Refresh'}
            </button>
          </div>
          {categories.isLoading && <p className="muted">Loading categories…</p>}
          {!categories.isLoading && outletId != null && (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Tick one or more categories to list their ingredients below.
              Counts come from UAT inventory for this outlet.
            </p>
          )}
          <div className="inventory-category-grid">
            {(categories.data || []).map((cat) => {
              const saved = savedDrafts[categoryKey(cat.id)]
              const ticked = selectedCategoryIds.includes(cat.id)
              const count = categoryCounts.data?.[cat.id]
              const countLabel =
                count == null
                  ? categoryCounts.isFetching
                    ? 'Counting…'
                    : '—'
                  : count === 0
                    ? 'No ingredients'
                    : `${count} ingredient${count === 1 ? '' : 's'}`
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`card inventory-category-box${ticked ? ' inventory-category-ticked' : ''}${saved ? ' inventory-category-saved' : ''}${count === 0 ? ' inventory-category-empty' : ''}`}
                  disabled={loadingSection || !outletId}
                  aria-pressed={ticked}
                  onClick={() => void toggleCategory(cat)}
                >
                  <span
                    className={`inventory-category-tick${ticked ? ' is-on' : ''}`}
                    aria-hidden
                  >
                    {ticked ? '✓' : ''}
                  </span>
                  <strong>{cat.name}</strong>
                  <span className="muted">
                    {saved ? `Saved · ${countLabel}` : countLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {filterType === 'Category' && selectedCategoryIds.length > 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="order-card-row">
            <h3 style={{ margin: 0, fontSize: 15 }}>
              Ingredients
              {selectedCategoryIds.length > 0
                ? ` (${selectedCategoryIds.length} categor${selectedCategoryIds.length === 1 ? 'y' : 'ies'})`
                : ''}
            </h3>
          </div>

          <div className="card inventory-count-summary">
            <div>
              <span className="muted">Total inventory qty</span>
              <strong>{formatQty(totals.inventoryTotal)}</strong>
            </div>
            <div>
              <span className="muted">System qty (recipe)</span>
              <strong>{formatQty(totals.systemRecipeTotal)}</strong>
            </div>
            <div>
              <span className="muted">Difference to system</span>
              <strong
                className={
                  totals.difference === 0
                    ? undefined
                    : totals.difference > 0
                      ? 'inventory-diff-pos'
                      : 'inventory-diff-neg'
                }
              >
                {formatQty(totals.difference)}
              </strong>
            </div>
          </div>

          {!loadingSection && ingredients.length === 0 && (
            <div className="card stack" style={{ textAlign: 'center', gap: 8 }}>
              <p style={{ margin: 0 }}>No ingredients for the ticked categories</p>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Try other categories, or switch to an outlet with stocked
                inventory.
              </p>
            </div>
          )}

          <div className="stack" style={{ gap: 10 }}>
            {ingredients.map((row) => {
              const qty = qtyById[row.id] || { recipe: '0', inventory: '0' }
              const recipeActual = parseNum(qty.recipe)
              const system = Number(row.systemQuantity ?? 0)
              const diff = recipeActual - system
              const systemInv = systemInInventory(system, row.conversionRate)
              const sourceCatId = ingredientCategoryById[row.id]
              const sourceCatName =
                (categories.data || []).find((c) => c.id === sourceCatId)
                  ?.name || null
              const products = [
                ...(row.product?.productName ? [row.product] : []),
                ...(row.packagingUnits || [])
                  .filter((p) => p.deliveryPackage || p.vendorName)
                  .map((p) => ({
                    productName: p.deliveryPackage || 'Product',
                    vendorName: p.vendorName,
                    deliveryPackage: p.deliveryPackage,
                    supplyUnit: p.looseUnit,
                  })),
              ]

              return (
                <article key={row.id} className="card inventory-count-card">
                  <strong className="inventory-count-name">{row.name}</strong>
                  {sourceCatName ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {sourceCatName}
                    </div>
                  ) : null}

                  {products.length > 0 && (
                    <div className="inventory-count-products">
                      {products.map((p, idx) => (
                        <div key={`${row.id}-p-${idx}`} className="muted">
                          {[p.productName, p.vendorName, p.deliveryPackage]
                            .filter(Boolean)
                            .join(' · ')}
                          {p.supplyUnit ? ` (${p.supplyUnit})` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="inventory-count-system muted">
                    System qty: {formatQty(row.systemQuantity)}{' '}
                    {row.recipeUnit || ''}
                    {systemInv != null && row.inventoryUnit
                      ? ` · ${formatQty(systemInv)} ${row.inventoryUnit}`
                      : ''}
                  </div>

                  <div className="inventory-count-qty-grid">
                    <label className="inventory-count-qty">
                      <span>
                        Recipe UOM
                        {row.recipeUnit ? ` (${row.recipeUnit})` : ''}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={qty.recipe}
                        onChange={(e) => setRecipeQty(row, e.target.value)}
                      />
                    </label>
                    <label className="inventory-count-qty">
                      <span>
                        Inventory UOM
                        {row.inventoryUnit ? ` (${row.inventoryUnit})` : ''}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={qty.inventory}
                        onChange={(e) => setInventoryQty(row, e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="inventory-count-footer">
                    <span className="muted">
                      Inventory qty: {formatQty(parseNum(qty.inventory))}{' '}
                      {row.inventoryUnit || ''}
                    </span>
                    <span
                      className={
                        diff === 0
                          ? 'muted'
                          : diff > 0
                            ? 'inventory-diff-pos'
                            : 'inventory-diff-neg'
                      }
                    >
                      Diff: {formatQty(diff)} {row.recipeUnit || ''}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="btn-row inventory-create-actions">
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={saveMutation.isPending || ingredients.length === 0}
              onClick={() => {
                setError(null)
                saveMutation.mutate()
              }}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : selectedCategoryIds.some(
                      (id) => !!savedDrafts[categoryKey(id)],
                    )
                  ? 'Save again'
                  : 'Save'}
            </button>
          </div>
        </div>
      )}

      {filterType === 'Storage' && typeof areaId === 'number' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="order-card-row">
            <h3 style={{ margin: 0, fontSize: 15 }}>
              Storages in {areaName || 'this area'}
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={storages.isFetching || areas.isFetching}
              onClick={() => {
                void areas.refetch()
                void storages.refetch()
              }}
            >
              {storages.isFetching || areas.isFetching
                ? 'Refreshing…'
                : 'Refresh'}
            </button>
          </div>
          {storages.isLoading && <p className="muted">Loading storages…</p>}
          {!storages.isLoading && (storages.data || []).length === 0 && (
            <p className="muted">No storages in this area</p>
          )}
          <div className="inventory-category-grid">
            {(storages.data || []).map((storage) => {
              const key = storageKey(Number(areaId), storage.id)
              const saved = savedDrafts[key]
              return (
                <button
                  key={storage.id}
                  type="button"
                  className={`card inventory-category-box${saved ? ' inventory-category-saved' : ''}`}
                  disabled={loadingSection || !outletId}
                  onClick={() => {
                    setStorageId(storage.id)
                    void openStorageCount(storage)
                  }}
                >
                  <strong>{storage.name}</strong>
                  <span className="muted">
                    {storage.noOfIngredient != null
                      ? `${storage.noOfIngredient} ingredient${storage.noOfIngredient === 1 ? '' : 's'}`
                      : 'Tap to count'}
                    {saved ? ' · Saved' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loadingSection && <p className="muted">Loading ingredients…</p>}
      {message && <p className="muted">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="btn-row inventory-create-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1 }}
          disabled={savedCount === 0 || submitMutation.isPending}
          onClick={() => {
            setError(null)
            setShowSubmitConfirm(true)
          }}
        >
          Submit{savedCount > 0 ? ` (${savedCount})` : ''}
        </button>
      </div>

      {showSubmitConfirm && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !submitMutation.isPending && setShowSubmitConfirm(false)}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-submit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="inventory-submit-title" style={{ margin: 0 }}>
              Confirm submission
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              Submit finalizes inventory numbers. Ensure your inventory for each
              category or each storage is done and saved before you confirm.
            </p>
            <p style={{ margin: 0 }}>
              You have <strong>{savedCount}</strong> saved
              {savedCount === 1 ? ' section' : ' sections'} ready to submit:
            </p>
            <ul className="inventory-submit-list">
              {Object.values(savedDrafts).map((d) => (
                <li key={d.inventoryId}>{d.name}</li>
              ))}
            </ul>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submitMutation.isPending}
                onClick={() => setShowSubmitConfirm(false)}
              >
                Go back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending
                  ? 'Submitting…'
                  : 'Confirm submission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
