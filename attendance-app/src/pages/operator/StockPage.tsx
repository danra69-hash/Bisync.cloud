import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  canEditInventory,
  canViewInventory,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  listInventoryAdjustments,
  type InventoryFilterOption,
} from '../../api/inventory'
import {
  formatDateRangeDisplay,
  inventoryDateLabel,
  roleClass,
  roleLabel,
  statusClass,
} from '../../utils/inventoryLabels'

const METHODS = ['Spot', 'Full'] as const
const TYPES = ['Category', 'Storage'] as const

type FilterDraft = {
  fromDate: string
  toDate: string
  methods: string[]
  types: string[]
}

function emptyDraft(): FilterDraft {
  return {
    fromDate: '',
    toDate: '',
    methods: [...METHODS],
    types: [...TYPES],
  }
}

function draftToFilter(draft: FilterDraft): InventoryFilterOption {
  const fromDate = draft.fromDate
    ? new Date(`${draft.fromDate}T00:00:00`).toISOString()
    : null
  let toDate: string | null = null
  if (draft.toDate) {
    const end = new Date(`${draft.toDate}T23:59:59`)
    toDate = end.toISOString()
  }
  return {
    fromDate,
    toDate,
    inventoryMethod: draft.methods.length === 1 ? draft.methods[0] : null,
    inventoryFilterType: draft.types.length === 1 ? draft.types[0] : null,
  }
}

function toggleValue(list: string[], value: string, fallback: readonly string[]) {
  const next = list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
  return next.length === 0 ? [...fallback] : next
}

export function OperatorStockPage() {
  const { token, hasPermission } = useAuth()
  const { selectedLocationId, selectedLocation } = useLocationFilter()
  const navigate = useNavigate()
  const canView = canViewInventory(hasPermission)
  const canAdd = canEditInventory(hasPermission)

  const outletId = selectedLocationId
  const [filter, setFilter] = useState<InventoryFilterOption>({})
  const [showFilter, setShowFilter] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(emptyDraft)

  // Outlet change: reset filter UI so history matches the new location cleanly.
  useEffect(() => {
    setFilter({})
    setDraft(emptyDraft())
    setShowFilter(false)
  }, [outletId])

  const list = useInfiniteQuery({
    queryKey: ['inventory-list', token, outletId, filter],
    enabled: !!token && outletId != null && canView,
    initialPageParam: 1,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: ({ pageParam }) =>
      listInventoryAdjustments(token!, outletId!, filter, pageParam),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < 20 ? undefined : lastPageParam + 1,
  })

  const items = useMemo(
    () => list.data?.pages.flatMap((page) => page) ?? [],
    [list.data],
  )

  const dateDisplay = formatDateRangeDisplay(filter.fromDate, filter.toDate)

  function openFilter() {
    setDraft({
      fromDate: filter.fromDate?.split('T')[0] || '',
      toDate: filter.toDate?.split('T')[0] || '',
      methods: filter.inventoryMethod
        ? [filter.inventoryMethod]
        : [...METHODS],
      types: filter.inventoryFilterType
        ? [filter.inventoryFilterType]
        : [...TYPES],
    })
    setShowFilter(true)
  }

  function applyFilter() {
    setFilter(draftToFilter(draft))
    setShowFilter(false)
  }

  function resetFilter() {
    setDraft(emptyDraft())
  }

  return (
    <div className="stack inventory-page">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/operator/stock')}
      >
        ← Stock
      </button>
      <div className="inventory-header">
        <h2 style={{ margin: 0 }}>Inventory</h2>
        {canView && canAdd && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/operator/stock/new')}
          >
            + New
          </button>
        )}
      </div>

      {!canView ? (
        <PermissionDenied
          title="Inventory unavailable"
          message="Inventory view permission is required."
        />
      ) : (
        <>
      <div className="card stack">
        <p className="muted" style={{ margin: 0 }}>
          {selectedLocation?.name
            ? `Showing inventory for ${selectedLocation.name}`
            : 'Select a location in the top bar'}
        </p>

        <div className="inventory-filter-row">
          <div className="inventory-date-box">
            <span className="muted">Inventory Date</span>
            <strong>{dateDisplay || '—'}</strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary inventory-filter-btn"
            onClick={openFilter}
            aria-label="Filter inventory"
            disabled={outletId == null}
          >
            Filter
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="card stack inventory-filter-panel">
          <div className="order-card-row">
            <h3 style={{ margin: 0 }}>Filter</h3>
            <button type="button" className="btn btn-ghost" onClick={resetFilter}>
              Reset
            </button>
          </div>

          <div className="inventory-filter-grid">
            <label className="field">
              <span>From</span>
              <input
                type="date"
                value={draft.fromDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, fromDate: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                type="date"
                value={draft.toDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, toDate: e.target.value }))
                }
              />
            </label>
          </div>

          <fieldset className="inventory-check-group">
            <legend>Method</legend>
            {METHODS.map((method) => (
              <label key={method}>
                <input
                  type="checkbox"
                  checked={draft.methods.includes(method)}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      methods: toggleValue(prev.methods, method, METHODS),
                    }))
                  }
                />
                {method} Inventory
              </label>
            ))}
          </fieldset>

          <fieldset className="inventory-check-group">
            <legend>Inventory type</legend>
            {TYPES.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={draft.types.includes(type)}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      types: toggleValue(prev.types, type, TYPES),
                    }))
                  }
                />
                {type}
              </label>
            ))}
          </fieldset>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowFilter(false)}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={applyFilter}>
              Show Results
            </button>
          </div>
        </div>
      )}

      {list.isLoading && <p className="muted">Loading inventory…</p>}
      {list.isError && (
        <p className="error-text">
          {(list.error as Error).message || 'Failed to load inventory'}
        </p>
      )}
      {outletId == null && (
        <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
          Select a location in the top bar to view inventory
        </p>
      )}
      {outletId != null && !list.isLoading && !list.isError && items.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', padding: 24 }}>
          No inventory found
        </p>
      )}

      <div className="inventory-list" key={outletId ?? 'none'}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="card inventory-item inventory-item-clickable"
            title="Open inventory detail"
            onClick={() =>
              navigate(`/operator/stock/${item.id}`, {
                state: { inventory: item },
              })
            }
          >
            <div className="inventory-item-top">
              <div className="inventory-item-who">
                {roleLabel(item.createdByRole) ? (
                  <span className={`role-badge ${roleClass(item.createdByRole)}`}>
                    {roleLabel(item.createdByRole)}
                  </span>
                ) : null}
                <strong>{item.createdBy || '—'}</strong>
              </div>
              {item.status ? (
                <span className={`status-chip ${statusClass(item.status)}`}>
                  {item.status}
                </span>
              ) : null}
            </div>
            <div className="inventory-item-meta">
              <div>Date: {inventoryDateLabel(item)}</div>
              <div>Method: {item.method || '—'}</div>
              <div>Type: {item.type || '—'}</div>
              <div>Detail: {item.detail || '—'}</div>
            </div>
            <div className="inventory-item-hint muted">Tap to view detail</div>
          </button>
        ))}
      </div>

      {list.hasNextPage && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
        </>
      )}
    </div>
  )
}
