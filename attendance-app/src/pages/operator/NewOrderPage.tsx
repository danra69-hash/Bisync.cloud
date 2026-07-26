import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canCreateOperatorOrder } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import { useLocationFilter } from '../../auth/LocationProvider'
import { listIngredientIdsForCategory, listSmartIngredientDirectory, searchSmartIngredients } from '../../api/inventory'
import {
  checkoutOperatorCart,
  getIngredientCategories,
  getIngredientVendors,
  getOperatorAddresses,
  getOperatorCart,
  getOrderTemplates,
  importOrderTemplate,
  searchAllOperatorIngredients,
  updateOperatorCart,
} from '../../api/operatorOrders'
import { CartButton } from '../../components/CartButton'
import { QtyStepper } from '../../components/QtyStepper'
import {
  deliveryUomOf,
  ProductMeta,
  recipeUomOf,
} from '../../components/ProductMeta'
import type { CartItem, CartVendor, Ingredient, IngredientTab } from '../../types'

type ViewBy = 'category' | 'vendor'
/** null = not chosen yet (no product fetch). 'all' = every category. */
type TabSelection = number | 'all' | null

const ALL_TAB: IngredientTab = { id: -1, name: 'All' }

function smartIngredientName(item?: Ingredient | CartItem) {
  const name = (item?.ingredientName || '').trim()
  return name || undefined
}

function vendorProductName(item?: Ingredient | CartItem) {
  const row = item || {}
  const product = (row.productName || '').trim()
  if (product) return product
  if ('name' in row && typeof row.name === 'string' && row.name.trim()) {
    return row.name.trim()
  }
  return smartIngredientName(row) || 'Product'
}

function itemLabel(item?: Ingredient | CartItem) {
  const smart = smartIngredientName(item)
  const product = vendorProductName(item)
  if (smart && product && smart.toLowerCase() !== product.toLowerCase()) {
    return `${smart} · ${product}`
  }
  return product || smart || 'Product'
}

function withSmartIngredientName(
  item: Ingredient,
  nameById: Map<number, string>,
): Ingredient {
  const existing = (item.ingredientName || '').trim()
  if (existing) return { ...item, ingredientName: existing }
  const id = Number(item.ingredientId)
  const fromDir = Number.isFinite(id) ? nameById.get(id) : undefined
  return {
    ...item,
    ingredientName: fromDir || undefined,
  }
}

/**
 * Search matches smart ingredient name only (e.g. "Egg Fresh").
 * Results are every vendor product tagged to those smart ingredients
 * (e.g. Weissbura + K.L. Fruits "Egg - Telur").
 */
function matchesTaggedSmartIngredient(
  item: Ingredient,
  keyword: string,
  matchedSmartIds: Set<number>,
) {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true
  const smart = (item.ingredientName || '').trim().toLowerCase()
  if (smart.includes(needle)) return true
  const id = Number(item.ingredientId)
  return Number.isFinite(id) && matchedSmartIds.has(id)
}

function money(value?: number) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function toYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Calendar next day (tomorrow) — default preferred delivery date. */
function nextDayYmd(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  return toYmd(d)
}

function todayYmd() {
  return toYmd(new Date())
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  const withPicker = input as HTMLInputElement & { showPicker?: () => void }
  if (typeof withPicker.showPicker === 'function') {
    try {
      withPicker.showPicker()
      return
    } catch {
      /* fall through — some browsers require a gesture on the input itself */
    }
  }
  input.focus()
  input.click()
}

function TemplateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h11M8 12h11M8 17h11M5 7h.01M5 12h.01M5 17h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M10 11v6M14 11v6M8 7V5h8v2M9 7l1 12h4l1-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function OperatorNewOrderPage() {
  const { token, hasPermission } = useAuth()
  const { selectedLocationId } = useLocationFilter()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [viewBy, setViewBy] = useState<ViewBy>('category')
  const [tabId, setTabId] = useState<TabSelection>('all')
  const [keyword, setKeyword] = useState('')
  /** Applied only when Search is clicked — typing alone does not load. */
  const [appliedKeyword, setAppliedKeyword] = useState<string | null>(null)
  const [searchRunId, setSearchRunId] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showTabPicker, setShowTabPicker] = useState(false)
  const [tabPickerQuery, setTabPickerQuery] = useState('')
  const [phase, setPhase] = useState<'shop' | 'review'>('shop')
  /** Vendors the user manually ticked to confirm purchase (review / cart). */
  const [confirmedVendorKeys, setConfirmedVendorKeys] = useState<
    Record<string, boolean>
  >({})
  /** Preferred delivery date per vendor (yyyy-MM-dd), default next day. */
  const [deliveryDates, setDeliveryDates] = useState<Record<string, string>>(
    {},
  )
  const [editLine, setEditLine] = useState<CartItem | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [deleteLine, setDeleteLine] = useState<CartItem | null>(null)
  const selectedOutletId = selectedLocationId
  const canIssue = canCreateOperatorOrder(hasPermission)
  // Category always has an effective selection (All). Vendor must be picked.
  const effectiveTabId: TabSelection =
    viewBy === 'category' ? tabId ?? 'all' : tabId
  const filterChosen = effectiveTabId !== null
  const searchSubmitted = appliedKeyword !== null

  useEffect(() => {
    setViewBy('category')
    setTabId('all')
    setKeyword('')
    setAppliedKeyword(null)
    setSearchRunId(0)
    setMessage(null)
    setShowTabPicker(false)
    setShowTemplates(false)
    setPhase('shop')
    setConfirmedVendorKeys({})
    setDeliveryDates({})
    setEditLine(null)
    setDeleteLine(null)
  }, [selectedOutletId])

  // Keep Category on All when switching back from Vendor.
  useEffect(() => {
    setTabId(viewBy === 'category' ? 'all' : null)
    setKeyword('')
    setAppliedKeyword(null)
    setSearchRunId(0)
    setShowTabPicker(false)
    setMessage(null)
    void qc.removeQueries({ queryKey: ['operator-ingredients'] })
    void qc.removeQueries({ queryKey: ['operator-category-member-ids'] })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when view mode changes
  }, [viewBy])

  const categories = useQuery({
    queryKey: ['operator-ingredient-categories', token, selectedOutletId],
    enabled: !!token && viewBy === 'category',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const rows = await getIngredientCategories(token!)
      return rows.map(
        (t): IngredientTab => ({
          id: t.id != null ? Number(t.id) : undefined,
          parentId: t.parentId != null ? Number(t.parentId) : undefined,
          name: t.name,
          description: t.description,
        }),
      )
    },
  })

  const vendors = useQuery({
    queryKey: ['operator-ingredient-vendors', selectedOutletId, token],
    enabled: !!token && !!selectedOutletId && viewBy === 'vendor',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getIngredientVendors(token!, selectedOutletId!),
  })

  const tabs: IngredientTab[] =
    viewBy === 'category'
      ? [ALL_TAB, ...(categories.data || [])]
      : vendors.data || []

  const selectedTab = useMemo(() => {
    if (effectiveTabId === 'all') return ALL_TAB
    if (effectiveTabId == null) return null
    return tabs.find((t) => Number(t.id) === Number(effectiveTabId)) || null
  }, [tabs, effectiveTabId])

  const tabsLoading =
    viewBy === 'category' ? categories.isLoading : vendors.isLoading

  const categoryMemberIds = useQuery({
    queryKey: [
      'operator-category-member-ids',
      selectedOutletId,
      effectiveTabId,
      token,
    ],
    enabled:
      !!token &&
      !!selectedOutletId &&
      viewBy === 'category' &&
      typeof effectiveTabId === 'number',
    queryFn: () =>
      listIngredientIdsForCategory(
        token!,
        selectedOutletId!,
        effectiveTabId as number,
      ),
  })

  /** Smart ingredient names — OperatorOrder/Ingredient often leaves ingredientName blank. */
  const smartDirectory = useQuery({
    queryKey: [
      'operator-smart-ingredient-directory',
      selectedOutletId,
      token,
    ],
    enabled: !!token && !!selectedOutletId,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      listSmartIngredientDirectory(token!, selectedOutletId!, {
        categoryId: null,
      }),
  })

  const smartNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const hit of smartDirectory.data || []) {
      map.set(hit.id, hit.name)
    }
    return map
  }, [smartDirectory.data])

  const ingredients = useQuery({
    queryKey: [
      'operator-ingredients',
      selectedOutletId,
      viewBy,
      effectiveTabId,
      selectedTab?.name ?? null,
      appliedKeyword,
      searchRunId,
      viewBy === 'category' && typeof effectiveTabId === 'number'
        ? categoryMemberIds.data
        : null,
      token,
    ],
    enabled:
      phase === 'shop' &&
      !!token &&
      !!selectedOutletId &&
      filterChosen &&
      searchSubmitted &&
      (viewBy === 'vendor'
        ? typeof effectiveTabId === 'number'
        : effectiveTabId === 'all' ||
          (typeof effectiveTabId === 'number' && categoryMemberIds.isSuccess)),
    staleTime: 60_000,
    refetchOnMount: false,
    queryFn: async () => {
      // 1) Load vendor-product rows for the current category/vendor filter.
      //    Do NOT send keyword to OperatorOrder/Ingredient — that API matches
      //    vendor productName, not smart ingredient name.
      // 2) Resolve smart ingredients matching the keyword (e.g. "Egg Fresh").
      // 3) Keep every vendor product tagged to those smart ingredients.
      // 4) Fill blank ingredientName from InventoryAdjustment directory.
      const needle = (appliedKeyword || '').trim()

      async function loadVendorProducts(): Promise<Ingredient[]> {
        if (viewBy === 'vendor') {
          const vendorId = Number(effectiveTabId)
          const vendorName = (
            (vendors.data || []).find((v) => Number(v.id) === vendorId)?.name ||
            selectedTab?.name ||
            ''
          )
            .trim()
            .toLowerCase()
          const rows = await searchAllOperatorIngredients(token!, {
            outletId: selectedOutletId!,
            keyword: '',
            vendorIds: Number.isFinite(vendorId) ? [vendorId] : null,
            categoryId: null,
          })
          // Prefer name match within the vendor-filtered page set only —
          // never fall back to loading the full outlet catalog (hangs with
          // many vendors / large catalogs).
          if (vendorName) {
            const matched = rows.filter(
              (item) =>
                (item.vendorName || '').trim().toLowerCase() === vendorName,
            )
            if (matched.length > 0) return matched
          }
          return rows
        }
        if (effectiveTabId === 'all') {
          return searchAllOperatorIngredients(token!, {
            outletId: selectedOutletId!,
            keyword: '',
            categoryId: null,
            vendorIds: null,
          })
        }
        const rows = await searchAllOperatorIngredients(token!, {
          outletId: selectedOutletId!,
          keyword: '',
          categoryId: null,
          vendorIds: null,
        })
        const idSet = new Set(
          (categoryMemberIds.data || []).map(Number).filter(Number.isFinite),
        )
        return rows.filter((item) => {
          const id = Number(item.ingredientId)
          return Number.isFinite(id) && idSet.has(id)
        })
      }

      const products = await loadVendorProducts()
      const directoryHits =
        smartDirectory.data ||
        (await listSmartIngredientDirectory(token!, selectedOutletId!, {
          categoryId: null,
        }))
      const nameById = new Map(directoryHits.map((h) => [h.id, h.name] as const))

      if (!needle) {
        return products.map((item) => withSmartIngredientName(item, nameById))
      }

      const smartHits = await searchSmartIngredients(
        token!,
        selectedOutletId!,
        needle,
      )
      const matchedSmartIds = new Set(smartHits.map((h) => h.id))
      for (const hit of smartHits) nameById.set(hit.id, hit.name)

      return products
        .filter((item) =>
          matchesTaggedSmartIngredient(item, needle, matchedSmartIds),
        )
        .map((item) => withSmartIngredientName(item, nameById))
    },
  })

  const productRows = useMemo(() => {
    if (!searchSubmitted || !filterChosen || ingredients.isPending) return []
    return (ingredients.data || []).map((item) =>
      withSmartIngredientName(item, smartNameById),
    )
  }, [
    searchSubmitted,
    filterChosen,
    ingredients.isPending,
    ingredients.data,
    smartNameById,
  ])

  const ingredientsLoading =
    searchSubmitted &&
    filterChosen &&
    (ingredients.isPending ||
      ingredients.isFetching ||
      (viewBy === 'category' &&
        typeof effectiveTabId === 'number' &&
        categoryMemberIds.isFetching))

  const cart = useQuery({
    queryKey: ['operator-cart', selectedOutletId, token],
    enabled: !!token && !!selectedOutletId,
    staleTime: 15_000,
    refetchOnMount: true,
    queryFn: () => getOperatorCart(token!, selectedOutletId!),
  })

  const templates = useQuery({
    queryKey: ['operator-order-templates', selectedOutletId, token],
    enabled: !!token && !!selectedOutletId && showTemplates,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getOrderTemplates(token!, selectedOutletId!),
  })

  const addresses = useQuery({
    queryKey: ['operator-addresses', selectedOutletId, token],
    enabled: !!token && !!selectedOutletId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getOperatorAddresses(token!, selectedOutletId!),
  })

  const cartVendors: CartVendor[] = useMemo(() => {
    const raw = cart.data
    const vendors = Array.isArray(raw)
      ? (raw as CartVendor[])
      : raw
        ? [raw as CartVendor]
        : []
    return vendors.map((vendor) => ({
      ...vendor,
      cartItems: (vendor.cartItems || []).map((item) => {
        const existing = (item.ingredientName || '').trim()
        if (existing) return { ...item, ingredientName: existing }
        const id = Number(item.ingredientId)
        const fromDir = Number.isFinite(id) ? smartNameById.get(id) : undefined
        return { ...item, ingredientName: fromDir || undefined }
      }),
    }))
  }, [cart.data, smartNameById])

  const vendorsWithLines = useMemo(
    () => cartVendors.filter((v) => (v.cartItems || []).length > 0),
    [cartVendors],
  )

  function vendorConfirmKey(vendor: CartVendor, idx: number) {
    if (vendor.vendorId != null) return `id:${vendor.vendorId}`
    const name = (vendor.vendorName || '').trim()
    if (name) return `name:${name.toLowerCase()}`
    return `idx:${idx}`
  }

  const confirmedVendors = useMemo(
    () =>
      vendorsWithLines.filter(
        (v, idx) => confirmedVendorKeys[vendorConfirmKey(v, idx)],
      ),
    // vendorConfirmKey is stable for given vendor+idx
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorsWithLines, confirmedVendorKeys],
  )

  const cartLines = useMemo(() => {
    const lines: Array<{ vendorName?: string; item: CartItem }> = []
    for (const vendor of cartVendors) {
      for (const item of vendor.cartItems || []) {
        lines.push({ vendorName: vendor.vendorName, item })
      }
    }
    return lines
  }, [cartVendors])

  const defaultAddressId = useMemo(() => {
    const list = addresses.data || []
    const preferred = list.find((a) => a.isDefault) || list[0]
    return preferred?.id ?? preferred?.addressId ?? 0
  }, [addresses.data])

  // Optimistic qty so 1→0 shows immediately (cart refetch / stale cartQuantity
  // on search rows previously snapped the stepper back to 1).
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})

  useEffect(() => {
    setQtyOverrides({})
  }, [cart.data, selectedOutletId])

  function qtyOverrideKey(item: Ingredient | CartItem) {
    if (item.ingredientId != null) return `i:${item.ingredientId}`
    if (item.productId != null) return `p:${item.productId}`
    return null
  }

  // Cart productId often differs from ingredient-list productId; ingredientId is stable.
  const qtyByKey = useMemo(() => {
    const map = new Map<number, number>()
    for (const { item } of cartLines) {
      const qty = Number(item.quantity ?? 0)
      if (item.ingredientId != null && Number.isFinite(Number(item.ingredientId))) {
        map.set(Number(item.ingredientId), qty)
      }
      if (item.productId != null && Number.isFinite(Number(item.productId))) {
        map.set(Number(item.productId), qty)
      }
    }
    return map
  }, [cartLines])

  function qtyForItem(item: Ingredient | CartItem) {
    const overrideKey = qtyOverrideKey(item)
    if (overrideKey != null && Object.prototype.hasOwnProperty.call(qtyOverrides, overrideKey)) {
      return qtyOverrides[overrideKey]
    }
    if (item.ingredientId != null) {
      const byIng = qtyByKey.get(Number(item.ingredientId))
      if (byIng != null) return byIng
    }
    if (item.productId != null) {
      const byProd = qtyByKey.get(Number(item.productId))
      if (byProd != null) return byProd
    }
    // Once cart has loaded, missing line = 0. Do not fall back to stale
    // ingredient.cartQuantity (that made − from 1 appear broken).
    if (cart.isFetched) return 0
    return Number(
      (item as Ingredient).cartQuantity ?? (item as CartItem).quantity ?? 0,
    )
  }

  const setQty = useMutation({
    mutationFn: async ({
      item,
      quantity,
      cartItemId,
    }: {
      item: Ingredient | CartItem
      quantity: number
      cartItemId?: number
    }) => {
      if (!selectedOutletId) throw new Error('Select a location first')
      const productId = item.productId ?? item.ingredientId
      if (productId == null) throw new Error('Product id missing')
      const resolvedCartItemId =
        cartItemId ??
        (item as Ingredient).cartItemId ??
        (item as CartItem).cartItemId ??
        0
      await updateOperatorCart(token!, {
        cartItemId: resolvedCartItemId,
        ingredientId: item.ingredientId ?? productId,
        outletId: selectedOutletId,
        productId,
        quantity,
        rrp: (item as Ingredient).price ?? (item as CartItem).rrp ?? 0,
        promotionDetailId: (item as Ingredient).promotionDetailId ?? 0,
        productType: (item as Ingredient).type ?? (item as CartItem).productType,
      })
      return { item, quantity }
    },
    onMutate: ({ item, quantity }) => {
      const key = qtyOverrideKey(item)
      if (key != null) {
        setQtyOverrides((prev) => ({ ...prev, [key]: quantity }))
      }
      const cartKey = ['operator-cart', selectedOutletId, token] as const
      const previous = qc.getQueryData(cartKey)
      const matchId = (row: CartItem) => {
        if (
          item.cartItemId != null &&
          row.cartItemId != null &&
          Number(row.cartItemId) === Number(item.cartItemId)
        ) {
          return true
        }
        if (
          item.ingredientId != null &&
          row.ingredientId != null &&
          Number(row.ingredientId) === Number(item.ingredientId)
        ) {
          return true
        }
        return (
          item.productId != null &&
          row.productId != null &&
          Number(row.productId) === Number(item.productId)
        )
      }
      qc.setQueryData(cartKey, (old: unknown) => {
        const vendors = Array.isArray(old)
          ? (old as CartVendor[])
          : old
            ? [old as CartVendor]
            : []
        return vendors
          .map((vendor) => ({
            ...vendor,
            cartItems: (vendor.cartItems || [])
              .map((row) =>
                matchId(row) ? { ...row, quantity } : row,
              )
              .filter((row) => Number(row.quantity ?? 0) > 0),
          }))
          .filter((vendor) => (vendor.cartItems || []).length > 0)
      })
      return { previous, cartKey }
    },
    onSuccess: ({ item, quantity }) => {
      // Qty 0 = not ordering that product. Only “cancel” when the cart is emptied.
      if (quantity <= 0) {
        const emptyingCart = cartLines.length <= 1
        setMessage(
          emptyingCart
            ? 'Order cancelled — all quantities are zero'
            : `Not ordering ${itemLabel(item)} (qty 0)`,
        )
        setEditLine(null)
        setDeleteLine(null)
        if (emptyingCart) setPhase('shop')
      } else {
        setMessage(`Updated ${itemLabel(item)} × ${quantity}`)
        setEditLine(null)
      }
      // Background refresh — do not block the UI on multi-vendor carts.
      void qc.invalidateQueries({ queryKey: ['operator-cart', selectedOutletId] })
    },
    onError: (err, { item }, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(context.cartKey, context.previous)
      }
      const key = qtyOverrideKey(item)
      if (key != null) {
        setQtyOverrides((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
      }
      setMessage((err as Error).message)
    },
  })

  const applyTemplate = useMutation({
    mutationFn: async (orderTemplateId: number) => {
      if (!selectedOutletId) throw new Error('Select an outlet first')
      await importOrderTemplate(token!, selectedOutletId, orderTemplateId)
    },
    onSuccess: async () => {
      setShowTemplates(false)
      setMessage('Template loaded into cart — adjust quantities below')
      await qc.invalidateQueries({ queryKey: ['operator-cart', selectedOutletId] })
      await qc.invalidateQueries({ queryKey: ['operator-ingredients'] })
    },
    onError: (err) => setMessage((err as Error).message),
  })

  const checkout = useMutation({
    mutationFn: async () => {
      if (!selectedOutletId) throw new Error('Select an outlet')
      if (!defaultAddressId) throw new Error('No delivery address')
      if (confirmedVendors.length === 0) {
        throw new Error('Tick each vendor you want to purchase from')
      }
      const missingDate = confirmedVendors.some((vendor) => {
        const vendorIdx = cartVendors.indexOf(vendor)
        const key = vendorConfirmKey(vendor, vendorIdx >= 0 ? vendorIdx : 0)
        return !(deliveryDates[key] || '').trim()
      })
      if (missingDate) {
        throw new Error('Select a preferred delivery date for each vendor')
      }
      await checkoutOperatorCart(
        token!,
        selectedOutletId,
        Number(defaultAddressId),
        confirmedVendors.map((vendor) => {
          const vendorIdx = cartVendors.indexOf(vendor)
          const key = vendorConfirmKey(vendor, vendorIdx >= 0 ? vendorIdx : 0)
          return {
            vendorId: vendor.vendorId,
            deliveryDate: deliveryDates[key] || nextDayYmd(),
            deliveryNote: '',
          }
        }),
      )
    },
    onSuccess: async () => {
      setPhase('shop')
      setConfirmedVendorKeys({})
      setDeliveryDates({})
      setEditLine(null)
      setDeleteLine(null)
      await qc.invalidateQueries({ queryKey: ['operator-cart', selectedOutletId] })
      await qc.invalidateQueries({ queryKey: ['operator-orders'] })
      navigate(
        `/operator?tab=toApprove&changed=${encodeURIComponent(
          canIssue
            ? 'Requested — awaiting approval'
            : 'Requested — approvers notified',
        )}`,
        { replace: true },
      )
    },
  })

  const cartItemCount = cartLines.length

  function openCartReview() {
    if (cartItemCount <= 0) return
    setMessage(null)
    // Require a fresh manual confirm each time the cart is opened.
    setConfirmedVendorKeys({})
    const next = nextDayYmd()
    const dates: Record<string, string> = {}
    cartVendors.forEach((vendor, idx) => {
      if ((vendor.cartItems || []).length === 0) return
      dates[vendorConfirmKey(vendor, idx)] = next
    })
    setDeliveryDates(dates)
    setEditLine(null)
    setDeleteLine(null)
    // Stop in-flight catalog fetches so Review stays responsive with many vendors.
    void qc.cancelQueries({ queryKey: ['operator-ingredients'] })
    setPhase('review')
  }

  function toggleVendorConfirm(key: string) {
    setConfirmedVendorKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    if (!filterChosen) {
      setMessage(
        viewBy === 'vendor'
          ? 'Select a vendor before searching.'
          : 'Select a category before searching.',
      )
      return
    }
    setMessage(null)
    setAppliedKeyword(keyword.trim())
    setSearchRunId((n) => n + 1)
  }

  function openTabPicker(next: ViewBy) {
    if (viewBy !== next) {
      setViewBy(next)
      setTabId(next === 'category' ? 'all' : null)
    }
    setMessage(null)
    setTabPickerQuery('')
    setShowTabPicker(true)
  }

  function closeTabPicker() {
    setShowTabPicker(false)
    setTabPickerQuery('')
  }

  function selectTab(id: number | 'all' | null) {
    if (id === 'all' || id === -1) {
      setTabId('all')
    } else if (id != null && Number.isFinite(Number(id))) {
      setTabId(Number(id))
    } else {
      setTabId(null)
    }
    setAppliedKeyword(null)
    setSearchRunId(0)
    closeTabPicker()
    // Drop cached ingredient pages so the list always reloads for the new filter.
    void qc.removeQueries({ queryKey: ['operator-ingredients'] })
  }

  const tabPickerTitle = viewBy === 'category' ? 'Select category' : 'Select vendor'
  const tabPickerEmpty =
    viewBy === 'category' ? 'No categories available.' : 'No vendors available.'
  const tabPickerNeedle = tabPickerQuery.trim().toLowerCase()
  const filteredTabs = tabPickerNeedle
    ? tabs.filter((tab) =>
        (tab.name || '').toLowerCase().includes(tabPickerNeedle),
      )
    : tabs
  const tabPickerNoMatches =
    !tabsLoading && tabs.length > 0 && filteredTabs.length === 0

  const filterLabel =
    selectedTab?.name ||
    (viewBy === 'category'
      ? 'All'
      : tabsLoading
        ? 'Loading…'
        : 'Select vendor')

  const awaitingFilter =
    !!selectedOutletId &&
    viewBy === 'vendor' &&
    !filterChosen &&
    phase === 'shop'

  const awaitingSearch =
    !!selectedOutletId &&
    filterChosen &&
    !searchSubmitted &&
    phase === 'shop'

  if (!canIssue) {
    return (
      <div className="stack">
        <PermissionDenied
          title="New order unavailable"
          message="Create order permission (CreateOrderAddEdit) is required."
        />
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="order-card-row">
        <div>
          <h2 style={{ margin: '0 0 4px' }}>
            {phase === 'review' ? 'Order summary' : 'New order'}
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {phase === 'review'
              ? 'Set delivery date, edit lines if needed, tick vendors, then submit'
              : selectedOutletId
                ? 'View by category or vendor, add quantities, then review'
                : 'Select a location in the top bar to start ordering'}
          </p>
        </div>
        {phase === 'shop' && (
          <CartButton
            count={cartItemCount}
            disabled={!selectedOutletId}
            onClick={openCartReview}
          />
        )}
      </div>

      {phase === 'review' ? (
        <div className="stack">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPhase('shop')}
            disabled={checkout.isPending}
          >
            ← Back to products
          </button>

          <div className="card stack">
            <h3 style={{ margin: 0 }}>
              Summarized order ({cartLines.length} line
              {cartLines.length === 1 ? '' : 's'})
            </h3>
            {cartLines.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Cart is empty.
              </p>
            ) : (
              <div className="stack">
                {vendorsWithLines.length > 1 && (
                  <p className="muted" style={{ margin: 0 }}>
                    Each vendor creates its own PO. Tick the vendors you want to
                    purchase from ({confirmedVendors.length} of{' '}
                    {vendorsWithLines.length} confirmed).
                  </p>
                )}
                {cartVendors.map((vendor, vendorIdx) => {
                  const lines = vendor.cartItems || []
                  if (lines.length === 0) return null
                  const confirmKey = vendorConfirmKey(vendor, vendorIdx)
                  const confirmed = !!confirmedVendorKeys[confirmKey]
                  const vendorLabel =
                    vendor.vendorName || `Vendor ${vendorIdx + 1}`
                  const vendorTotal =
                    vendor.grandTotal ??
                    vendor.subTotal ??
                    lines.reduce((sum, item) => {
                      const qty = Number(item.quantity ?? 0)
                      const price = Number(item.price ?? item.rrp ?? 0)
                      const lineTotal =
                        item.total ??
                        item.subtotal ??
                        (Number.isFinite(qty * price) ? qty * price : 0)
                      return sum + Number(lineTotal || 0)
                    }, 0)
                  return (
                    <section
                      className={`vendor-order-block${confirmed ? ' vendor-order-confirmed' : ''}`}
                      key={confirmKey}
                    >
                      <label className="vendor-confirm-row">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          disabled={checkout.isPending}
                          onChange={() => toggleVendorConfirm(confirmKey)}
                          aria-label={`Confirm purchase from ${vendorLabel}`}
                        />
                        <span className="vendor-confirm-copy">
                          <strong className="vendor-order-heading">
                            {vendorLabel}
                          </strong>
                          <span className="muted">
                            {confirmed
                              ? 'Confirmed — will create a PO'
                              : 'Tick to confirm purchase'}
                          </span>
                        </span>
                      </label>
                      <div className="table-scroll">
                        <table className="line-table summary-order-table">
                          <thead>
                            <tr>
                              <th scope="col">Product</th>
                              <th scope="col" className="col-qty">
                                Qty
                              </th>
                              <th scope="col" className="col-delivery">
                                Delivery unit
                              </th>
                              <th scope="col" className="col-amount">
                                Amount
                              </th>
                              <th scope="col" className="col-actions">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((item, idx) => {
                              const qty = Number(item.quantity ?? 0)
                              const price = Number(item.price ?? item.rrp ?? 0)
                              const amount =
                                item.total ??
                                item.subtotal ??
                                (Number.isFinite(qty * price)
                                  ? qty * price
                                  : undefined)
                              return (
                                <tr
                                  key={`${item.cartItemId ?? item.productId}-${idx}`}
                                >
                                  <td>
                                    {smartIngredientName(item) ? (
                                      <div className="product-meta-ingredient">
                                        <span className="product-meta-ingredient-mark">
                                          Ingredient
                                        </span>
                                        {smartIngredientName(item)}
                                      </div>
                                    ) : null}
                                    <strong className="product-meta-name">
                                      {vendorProductName(item)}
                                    </strong>
                                  </td>
                                  <td className="col-qty">{qty || '—'}</td>
                                  <td className="col-delivery">
                                    {deliveryUomOf(item) || '—'}
                                  </td>
                                  <td className="col-amount">{money(amount)}</td>
                                  <td className="col-actions">
                                    <div className="summary-line-actions">
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        disabled={
                                          checkout.isPending || setQty.isPending
                                        }
                                        aria-label={`Edit quantity for ${vendorProductName(item)}`}
                                        onClick={() => {
                                          setMessage(null)
                                          setDeleteLine(null)
                                          setEditLine(item)
                                          setEditQty(
                                            Math.max(1, Number(item.quantity ?? 1)),
                                          )
                                        }}
                                      >
                                        <EditIcon />
                                      </button>
                                      <button
                                        type="button"
                                        className="icon-btn icon-btn-danger"
                                        disabled={
                                          checkout.isPending || setQty.isPending
                                        }
                                        aria-label={`Delete ${vendorProductName(item)}`}
                                        onClick={() => {
                                          setMessage(null)
                                          setEditLine(null)
                                          setDeleteLine(item)
                                        }}
                                      >
                                        <DeleteIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3}>
                                <strong>Vendor total</strong>
                              </td>
                              <td className="col-amount">
                                <strong>{money(vendorTotal)}</strong>
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="preferred-delivery-box">
                        <label className="field preferred-delivery-field">
                          <span>Preferred delivery date</span>
                          <div className="preferred-delivery-row">
                            <input
                              type="date"
                              value={deliveryDates[confirmKey] || nextDayYmd()}
                              min={todayYmd()}
                              disabled={checkout.isPending}
                              onChange={(e) => {
                                const value = e.target.value
                                setDeliveryDates((prev) => ({
                                  ...prev,
                                  [confirmKey]: value,
                                }))
                              }}
                            />
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={checkout.isPending}
                              aria-label="Open calendar"
                              onClick={(e) => {
                                const row = e.currentTarget.closest(
                                  '.preferred-delivery-row',
                                )
                                const input = row?.querySelector(
                                  'input[type="date"]',
                                ) as HTMLInputElement | null
                                openDatePicker(input)
                              }}
                            >
                              <CalendarIcon />
                            </button>
                          </div>
                        </label>
                      </div>
                    </section>
                  )
                })}
              </div>
            )}

            <p className="muted" style={{ margin: 0 }}>
              Submitting creates a <strong>Requested</strong> PO under To Approve
              for each confirmed vendor. Approvers are notified when you do not
              have issue rights; after approval the initiator is notified to
              Issue and share the link.
            </p>

            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={checkout.isPending}
                onClick={() => setPhase('shop')}
              >
                Edit cart
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  checkout.isPending ||
                  cartLines.length === 0 ||
                  confirmedVendors.length === 0
                }
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending
                  ? 'Submitting…'
                  : confirmedVendors.length === 0
                    ? 'Tick vendors to submit'
                    : confirmedVendors.length === vendorsWithLines.length
                      ? 'Submit for approval'
                      : `Submit ${confirmedVendors.length} of ${vendorsWithLines.length} vendors`}
              </button>
            </div>
          </div>

          {checkout.error && (
            <p className="error-text">{(checkout.error as Error).message}</p>
          )}
        </div>
      ) : (
        <>
      <div className="view-by-row">
        <div className="view-by-group">
          <span className="view-by-label">View by</span>
          <button
            type="button"
            className={`chip${viewBy === 'category' ? ' active' : ''}`}
            onClick={() => openTabPicker('category')}
            disabled={!selectedOutletId}
          >
            Category
          </button>
          <button
            type="button"
            className={`chip${viewBy === 'vendor' ? ' active' : ''}`}
            onClick={() => openTabPicker('vendor')}
            disabled={!selectedOutletId}
          >
            Vendor
          </button>
        </div>
        <button
          type="button"
          className="icon-btn"
          title="Purchase templates"
          aria-label="Purchase templates"
          disabled={!selectedOutletId}
          onClick={() => {
            setMessage(null)
            setShowTemplates(true)
          }}
        >
          <TemplateIcon />
        </button>
      </div>

      {selectedOutletId && (
        <>
          <button
            type="button"
            className="tab-picker-trigger"
            onClick={() => setShowTabPicker(true)}
            aria-haspopup="dialog"
            aria-expanded={showTabPicker}
          >
            <span className="muted">
              {viewBy === 'category' ? 'Category' : 'Vendor'}
            </span>
            <strong>
              {filterLabel}
            </strong>
            <span className="tab-picker-chevron" aria-hidden>
              ▾
            </span>
          </button>

          <form className="card stack" onSubmit={onSearch}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Search ingredients</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search smart ingredient (e.g. egg)…"
              />
            </label>
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>

          {awaitingFilter && (
            <p className="muted" style={{ margin: 0 }}>
              Select a vendor before searching.
            </p>
          )}

          {awaitingSearch && (
            <p className="muted" style={{ margin: 0 }}>
              Search by <strong>smart ingredient</strong> name (e.g. egg → Egg
              Fresh), then tap <strong>Search</strong>. Matching vendor products
              tagged to that ingredient are listed.
            </p>
          )}

          {searchSubmitted && ingredientsLoading && (
            <p className="muted">Loading ingredients…</p>
          )}

          {searchSubmitted && ingredients.isError && (
            <p className="error-text">
              {(ingredients.error as Error)?.message ||
                'Could not search ingredients'}
            </p>
          )}

          {searchSubmitted && filterChosen && (
          <div className="order-list" key={`${viewBy}-${effectiveTabId}-${appliedKeyword}-${searchRunId}`}>
            {productRows.map((item, idx) => {
              const rowKey =
                item.ingredientId ?? item.productId ?? item.cartItemId ?? idx
              const qty = qtyForItem(item)
              return (
                <div className="card product-row" key={`${rowKey}-${idx}`}>
                  <ProductMeta
                    name={vendorProductName(item)}
                    ingredientName={smartIngredientName(item)}
                    deliveryUom={deliveryUomOf(item)}
                    recipeUom={recipeUomOf(item)}
                    parStock={item.parStock}
                    onHand={item.quantityOnHand ?? item.onHandQuantity}
                    extra={
                      viewBy === 'vendor'
                        ? item.price != null
                          ? String(item.price)
                          : null
                        : [item.vendorName, item.price != null ? String(item.price) : null]
                            .filter(Boolean)
                            .join(' · ') || null
                    }
                  />
                  <QtyStepper
                    value={qty}
                    disabled={!selectedOutletId}
                    onChange={(next) => {
                      setMessage(null)
                      setQty.mutate({
                        item,
                        quantity: next,
                        cartItemId: item.cartItemId ?? 0,
                      })
                    }}
                  />
                </div>
              )
            })}
            {!ingredientsLoading && productRows.length === 0 && (
              <p className="muted">
                No smart ingredients matched
                {appliedKeyword ? ` “${appliedKeyword}”` : ''}. Try another
                keyword, or leave blank and Search to list all vendor products.
              </p>
            )}
          </div>
          )}

          <div className="card stack">
            <h3 style={{ margin: 0 }}>
              Cart{cartLines.length > 0 ? ` (${cartLines.length})` : ''}
            </h3>
            {cartLines.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Cart is empty. Add quantities or open a purchase template.
              </p>
            ) : (
              <div className="order-list">
                {cartLines.map(({ vendorName, item }, idx) => (
                  <div
                    className="order-card-row"
                    key={`${item.cartItemId ?? item.productId}-${idx}`}
                  >
                    <div>
                      <ProductMeta
                        name={vendorProductName(item)}
                        ingredientName={smartIngredientName(item)}
                        deliveryUom={deliveryUomOf(item)}
                        recipeUom={recipeUomOf(item)}
                        parStock={item.parStock}
                        onHand={item.quantityOnHand ?? item.onHandQuantity}
                        extra={vendorName}
                      />
                    </div>
                    <QtyStepper
                      value={Number(item.quantity ?? 0)}
                      disabled={!selectedOutletId}
                      onChange={(next) => {
                        setMessage(null)
                        setQty.mutate({
                          item,
                          quantity: next,
                          cartItemId: item.cartItemId ?? 0,
                        })
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={cartLines.length === 0}
              onClick={openCartReview}
            >
              Review order
            </button>
          </div>
        </>
      )}
        </>
      )}

      {(message || setQty.error || applyTemplate.error) && (
        <p
          className={
            setQty.error || applyTemplate.error ? 'error-text' : 'muted'
          }
        >
          {message ||
            (setQty.error as Error)?.message ||
            (applyTemplate.error as Error)?.message}
        </p>
      )}

      {showTemplates && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !applyTemplate.isPending && setShowTemplates(false)}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-card-row">
              <h3 id="template-dialog-title" style={{ margin: 0 }}>
                Purchase templates
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={applyTemplate.isPending}
                onClick={() => setShowTemplates(false)}
              >
                Close
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Select an admin template to load items into your cart, then adjust
              quantities.
            </p>
            {templates.isLoading && <p className="muted">Loading templates…</p>}
            {!templates.isLoading && (templates.data || []).length === 0 && (
              <p className="muted">No purchase templates for this outlet.</p>
            )}
            <div className="order-list">
              {(templates.data || []).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="card template-option"
                  disabled={applyTemplate.isPending || !tpl.id}
                  onClick={() => {
                    if (tpl.id == null) return
                    setMessage(null)
                    applyTemplate.mutate(tpl.id)
                  }}
                >
                  <strong>{tpl.name || `Template ${tpl.id}`}</strong>
                  <span className="muted">
                    {applyTemplate.isPending ? 'Importing…' : 'Open template'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTabPicker && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeTabPicker}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tab-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-card-row">
              <h3 id="tab-picker-title" style={{ margin: 0 }}>
                {tabPickerTitle}
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeTabPicker}
              >
                Close
              </button>
            </div>
            <div className="tab-picker-search">
              <input
                type="search"
                value={tabPickerQuery}
                onChange={(e) => setTabPickerQuery(e.target.value)}
                placeholder={
                  viewBy === 'vendor'
                    ? 'Search vendor…'
                    : 'Search category…'
                }
                autoFocus
                autoComplete="off"
                enterKeyHint="search"
                aria-label={
                  viewBy === 'vendor' ? 'Search vendors' : 'Search categories'
                }
              />
            </div>
            {tabsLoading && <p className="muted">Loading…</p>}
            {!tabsLoading && tabs.length === 0 && (
              <p className="muted">{tabPickerEmpty}</p>
            )}
            {tabPickerNoMatches && (
              <p className="muted">No matches for “{tabPickerQuery.trim()}”.</p>
            )}
            <div className="order-list tab-picker-list" role="listbox">
              {filteredTabs.map((tab) => {
                const isAll = Number(tab.id) === -1
                const selected = isAll
                  ? effectiveTabId === 'all'
                  : Number(tab.id) === Number(effectiveTabId)
                return (
                  <button
                    key={`${viewBy}-${tab.id}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`card template-option${selected ? ' selected' : ''}`}
                    onClick={() =>
                      selectTab(isAll ? 'all' : (tab.id ?? null))
                    }
                  >
                    <strong>{tab.name || `Item ${tab.id}`}</strong>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {editLine && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !setQty.isPending && setEditLine(null)}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-qty-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-card-row">
              <h3 id="edit-qty-title" style={{ margin: 0 }}>
                Adjust quantity
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={setQty.isPending}
                onClick={() => setEditLine(null)}
              >
                Close
              </button>
            </div>
            {smartIngredientName(editLine) ? (
              <div className="product-meta-ingredient">
                <span className="product-meta-ingredient-mark">Ingredient</span>
                {smartIngredientName(editLine)}
              </div>
            ) : null}
            <strong className="product-meta-name">
              {vendorProductName(editLine)}
            </strong>
            {deliveryUomOf(editLine) ? (
              <p className="muted" style={{ margin: 0 }}>
                {deliveryUomOf(editLine)}
              </p>
            ) : null}
            <div className="edit-qty-stepper-row">
              <QtyStepper
                value={editQty}
                min={1}
                disabled={setQty.isPending}
                onChange={setEditQty}
              />
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={setQty.isPending}
                onClick={() => setEditLine(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={setQty.isPending || editQty < 1}
                onClick={() => {
                  setQty.mutate({
                    item: editLine,
                    quantity: editQty,
                    cartItemId: editLine.cartItemId ?? 0,
                  })
                }}
              >
                {setQty.isPending ? 'Saving…' : 'Save quantity'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteLine && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => !setQty.isPending && setDeleteLine(null)}
        >
          <div
            className="modal-panel stack"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-line-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-line-title" style={{ margin: 0 }}>
              Delete {vendorProductName(deleteLine)}?
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              This removes the line from your order.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={setQty.isPending}
                onClick={() => setDeleteLine(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={setQty.isPending}
                onClick={() => {
                  setQty.mutate({
                    item: deleteLine,
                    quantity: 0,
                    cartItemId: deleteLine.cartItemId ?? 0,
                  })
                }}
              >
                {setQty.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
