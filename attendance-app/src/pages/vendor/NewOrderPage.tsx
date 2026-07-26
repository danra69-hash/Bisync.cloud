import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canCreateSalesOrder } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  getVendorCart,
  getVirtualOutlets,
  searchVendorIngredients,
  updateVendorCart,
} from '../../api/vendorOrders'
import {
  filterDemoProducts,
  isDemoProduct,
} from '../../data/demoB2bProducts'
import {
  cartItemCount as countCartItems,
  loadSalesCart,
  saveSalesCart,
  type SalesCartLine,
} from '../../data/salesCart'
import { CartButton } from '../../components/CartButton'
import { QtyStepper } from '../../components/QtyStepper'
import {
  deliveryUomOf,
  ProductMeta,
  productNameOf,
  recipeUomOf,
} from '../../components/ProductMeta'
import type { Ingredient } from '../../types'

function money(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function itemLabel(item?: Ingredient) {
  return productNameOf(item || {})
}

export function VendorNewOrderPage() {
  const { token, hasPermission } = useAuth()
  const { selectedLocationId, setSelectedLocationId } = useLocationFilter()
  const canSales = canCreateSalesOrder(hasPermission)
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [clientId, setClientId] = useState<number | ''>(() =>
    selectedLocationId ?? '',
  )
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [pageIndex, setPageIndex] = useState(1)
  const [accumulated, setAccumulated] = useState<Ingredient[]>([])
  const [usingDemoCatalog, setUsingDemoCatalog] = useState(false)
  const [demoCart, setDemoCart] = useState<SalesCartLine[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})

  const selectedClientId = typeof clientId === 'number' ? clientId : null

  const clients = useQuery({
    queryKey: ['vendor-clients', token],
    enabled: !!token && canSales,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getVirtualOutlets(token!, { includeUatFallback: true }),
  })

  const selectedClient = useMemo(
    () => (clients.data || []).find((c) => c.outletId === selectedClientId),
    [clients.data, selectedClientId],
  )

  // Prefer top-bar client when it appears in the client list
  useEffect(() => {
    if (selectedLocationId == null) return
    if (clientId === selectedLocationId) return
    const exists = (clients.data || []).some(
      (c) => c.outletId === selectedLocationId,
    )
    if (exists || !clients.data) {
      setClientId(selectedLocationId)
    }
  }, [selectedLocationId, clients.data, clientId])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300)
    return () => window.clearTimeout(t)
  }, [keyword])

  useEffect(() => {
    setPageIndex(1)
    setAccumulated([])
    setUsingDemoCatalog(false)
    setKeyword('')
    setDebouncedKeyword('')
    setMessage(null)
    if (selectedClientId) {
      setDemoCart(loadSalesCart(selectedClientId))
    } else {
      setDemoCart([])
    }
  }, [selectedClientId])

  useEffect(() => {
    setPageIndex(1)
    setAccumulated([])
    setUsingDemoCatalog(false)
  }, [debouncedKeyword])

  const products = useQuery({
    queryKey: [
      'vendor-b2b-products',
      selectedClientId,
      debouncedKeyword,
      pageIndex,
      token,
    ],
    enabled: !!token && !!selectedClientId && canSales,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () =>
      searchVendorIngredients(
        token!,
        selectedClientId!,
        debouncedKeyword,
        pageIndex,
        100,
      ),
  })

  useEffect(() => {
    if (!products.data || !selectedClientId) return

    if (pageIndex === 1 && products.data.products.length === 0) {
      setAccumulated(filterDemoProducts(debouncedKeyword))
      setUsingDemoCatalog(true)
      return
    }

    setUsingDemoCatalog(false)
    setAccumulated((prev) =>
      pageIndex === 1
        ? products.data.products
        : [...prev, ...products.data.products],
    )
  }, [products.data, pageIndex, selectedClientId, debouncedKeyword])

  const cart = useQuery({
    queryKey: ['vendor-cart', selectedClientId, token],
    enabled: !!token && !!selectedClientId && canSales && !usingDemoCatalog,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getVendorCart(token!, selectedClientId!),
  })

  const cartItemCount = useMemo(() => {
    if (usingDemoCatalog) return countCartItems(demoCart)
    const raw = cart.data
    if (!raw || !Array.isArray(raw)) return 0
    return raw.reduce((sum: number, vendor: { cartItems?: unknown[] }) => {
      return sum + (Array.isArray(vendor?.cartItems) ? vendor.cartItems.length : 0)
    }, 0)
  }, [cart.data, demoCart, usingDemoCatalog])

  const qtyByKey = useMemo(() => {
    const map = new Map<number, number>()
    if (usingDemoCatalog) {
      for (const line of demoCart) map.set(line.productId, line.quantity)
      return map
    }
    const raw = cart.data
    if (!Array.isArray(raw)) return map
    for (const vendor of raw as Array<{
      cartItems?: Array<Record<string, unknown>>
      details?: Array<Record<string, unknown>>
    }>) {
      const lines = vendor.cartItems || vendor.details || []
      for (const item of lines) {
        const qty = Number(item.quantity ?? item.cartQuantity ?? 0)
        if (item.ingredientId != null && Number.isFinite(Number(item.ingredientId))) {
          map.set(Number(item.ingredientId), qty)
        }
        if (item.productId != null && Number.isFinite(Number(item.productId))) {
          map.set(Number(item.productId), qty)
        }
      }
    }
    return map
  }, [cart.data, demoCart, usingDemoCatalog])

  useEffect(() => {
    setQtyOverrides({})
  }, [cart.data, demoCart, selectedClientId])

  function qtyOverrideKey(item: Ingredient) {
    if (item.ingredientId != null) return `i:${item.ingredientId}`
    if (item.productId != null) return `p:${item.productId}`
    return null
  }

  function qtyForItem(item: Ingredient) {
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
    if (usingDemoCatalog || cart.isFetched) return 0
    return Number(item.cartQuantity ?? 0)
  }

  const setQty = useMutation({
    mutationFn: async ({
      item,
      quantity,
    }: {
      item: Ingredient
      quantity: number
    }) => {
      const productId = item.productId ?? item.ingredientId ?? 0
      if (isDemoProduct(item) || usingDemoCatalog) {
        if (!selectedClientId) throw new Error('Select a client')
        let next = [...loadSalesCart(selectedClientId)]
        const existing = next.find((l) => l.productId === productId)
        if (quantity <= 0) {
          next = next.filter((l) => l.productId !== productId)
        } else if (existing) {
          existing.quantity = quantity
        } else {
          next.push({
            productId,
            productName: itemLabel(item),
            quantity,
            price: Number(item.price ?? 0),
            uom: item.deliveryPackage || item.uom,
            deliveryPackage: item.deliveryPackage || item.uom,
            recipeUom: recipeUomOf(item),
            parStock: item.parStock,
            quantityOnHand: item.quantityOnHand ?? item.onHandQuantity,
          })
        }
        saveSalesCart(selectedClientId, next)
        setDemoCart(next)
        return { item, quantity }
      }

      await updateVendorCart(token!, {
        cartItemId: item.cartItemId ?? 0,
        ingredientId: item.ingredientId,
        outletId: selectedClientId,
        productId: item.productId,
        quantity,
        rrp: item.price,
        promotionDetailId: item.promotionDetailId,
        productType: item.type,
      })
      return { item, quantity }
    },
    onMutate: ({ item, quantity }) => {
      const key = qtyOverrideKey(item)
      if (key != null) {
        setQtyOverrides((prev) => ({ ...prev, [key]: quantity }))
      }
    },
    onSuccess: async ({ item, quantity }) => {
      // Qty 0 = not ordering that product. Cancel only when the cart is emptied.
      if (quantity <= 0) {
        const lineCount = usingDemoCatalog
          ? demoCart.length
          : Array.isArray(cart.data)
            ? (cart.data as Array<{ cartItems?: unknown[] }>).reduce(
                (n, v) => n + (v.cartItems?.length ?? 0),
                0,
              )
            : 0
        setMessage(
          lineCount <= 1
            ? 'Order cancelled — all quantities are zero'
            : `Not ordering ${itemLabel(item)} (qty 0)`,
        )
      } else {
        setMessage(`Updated ${itemLabel(item)} × ${quantity}`)
      }
      if (!isDemoProduct(item) && !usingDemoCatalog) {
        await qc.invalidateQueries({
          queryKey: ['vendor-cart', selectedClientId],
        })
      }
    },
    onError: (err, { item }) => {
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

  function onClientChange(value: string) {
    const next = value ? Number(value) : ''
    setClientId(next)
    setMessage(null)
    if (typeof next === 'number') {
      setSelectedLocationId(next)
    }
  }

  function openCartReview() {
    if (!selectedClientId || cartItemCount <= 0) return
    const params = new URLSearchParams({
      clientId: String(selectedClientId),
      clientName: selectedClient?.name || `Client ${selectedClientId}`,
      demo: usingDemoCatalog ? '1' : '0',
    })
    navigate(`/vendor/new-order/review?${params.toString()}`)
  }

  if (!canSales) {
    return (
      <div className="stack">
        <PermissionDenied
          title="New Sales Order unavailable"
          message="Sales permission is required to create sales orders."
        />
      </div>
    )
  }

  const totalCount = usingDemoCatalog
    ? accumulated.length
    : (products.data?.totalCount ?? accumulated.length)
  const canLoadMore = !usingDemoCatalog && accumulated.length < totalCount

  return (
    <div className="stack">
      <div className="order-card-row">
        <div>
          <h2 style={{ margin: '0 0 4px' }}>New Sales Order</h2>
          <p className="muted" style={{ margin: 0 }}>
            Select a client, then add B2B products to the cart
          </p>
        </div>
        <CartButton count={cartItemCount} onClick={openCartReview} />
      </div>

      <div className="card stack">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Client</span>
          <select
            value={clientId}
            onChange={(e) => onClientChange(e.target.value)}
            disabled={clients.isLoading}
          >
            <option value="">
              {clients.isLoading ? 'Loading clients…' : 'Select client'}
            </option>
            {(clients.data || []).map((client) => (
              <option key={client.outletId} value={client.outletId}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        {clients.isError && (
          <p className="error-text">
            {(clients.error as Error).message || 'Failed to load clients'}
          </p>
        )}
        {!clients.isLoading && (clients.data || []).length === 0 && (
          <p className="muted">No clients found for this vendor account.</p>
        )}
      </div>

      {selectedClientId && (
        <>
          <div className="card stack">
            <div className="order-card-row">
              <div>
                <strong>B2B products</strong>
                <div className="muted">
                  For {selectedClient?.name || `client #${selectedClientId}`}
                </div>
              </div>
              <span className="badge">{totalCount} available</span>
            </div>

            {usingDemoCatalog && (
              <p className="muted" style={{ margin: 0 }}>
                UAT live catalog is empty. Showing{' '}
                <strong>demo B2B products</strong> for testing.
              </p>
            )}

            <label className="field" style={{ marginBottom: 0 }}>
              <span>Filter products</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search by product name…"
              />
            </label>
          </div>

          {products.isLoading && pageIndex === 1 && !usingDemoCatalog && (
            <p className="muted">Loading B2B products…</p>
          )}
          {products.isError && !usingDemoCatalog && (
            <p className="error-text">
              {(products.error as Error).message || 'Failed to load products'}
            </p>
          )}

          <div className="order-list" key={selectedClientId}>
            {accumulated.map((item, idx) => {
              const rowKey =
                item.ingredientId ?? item.productId ?? item.cartItemId ?? idx
              const qty = qtyForItem(item)
              return (
                <div
                  className="card product-row"
                  key={`${rowKey}-${idx}`}
                >
                  <ProductMeta
                    name={itemLabel(item)}
                    deliveryUom={deliveryUomOf(item)}
                    recipeUom={recipeUomOf(item)}
                    parStock={item.parStock}
                    onHand={item.quantityOnHand ?? item.onHandQuantity}
                    extra={[
                      item.type,
                      isDemoProduct(item) ? 'Demo' : null,
                      item.price != null ? money(item.price) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                  <QtyStepper
                    value={qty}
                    disabled={setQty.isPending}
                    onChange={(next) => {
                      setMessage(null)
                      setQty.mutate({ item, quantity: next })
                    }}
                  />
                </div>
              )
            })}
          </div>

          {!products.isLoading && accumulated.length === 0 && (
            <p className="muted">No B2B products available for this client.</p>
          )}

          {canLoadMore && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={products.isFetching}
            >
              {products.isFetching ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {message && <p className="muted">{message}</p>}
    </div>
  )
}
