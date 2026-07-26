import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { canEditWastage, canViewWastage } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  WASTAGE_REASONS,
  addWastage,
  getWastageProductDetail,
  listWastage,
  searchWastageCatalog,
  type WastageInventoryType,
  type WastageProduct,
} from '../../api/wastage'

type TypeFilter = 'All' | WastageInventoryType

type WastageLine = {
  key: string
  itemId: number
  itemType: string
  name: string
  code?: string
  recipeUom: string
  unitPrice: number
  availableQuantity?: number | null
  qty: string
  reasonId: number
}

const TYPE_FILTERS: TypeFilter[] = ['All', 'Product', 'SubProduct', 'Ingredient']

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function parseQty(raw: string) {
  const n = Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdToIsoNoon(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return new Date().toISOString()
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
}

function matchesType(item: WastageProduct, filter: TypeFilter) {
  if (filter === 'All') return true
  const t = String(item.inventoryType || '').toLowerCase().replace(/[\s_-]+/g, '')
  if (filter === 'SubProduct') return t === 'subproduct'
  return t === filter.toLowerCase()
}

function matchesKeyword(item: WastageProduct, keyword: string) {
  const tokens = normalizeSearch(keyword).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const hay = normalizeSearch(
    `${item.name} ${item.code || ''} ${item.inventoryType}`,
  )
  return tokens.every((tok) => hay.includes(tok))
}

export function OperatorWastagePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { token, hasPermission } = useAuth()
  const { selectedLocationId, selectedLocation } = useLocationFilter()
  const outletId = selectedLocationId
  const canView = canViewWastage(hasPermission)
  const canEdit = canEditWastage(hasPermission)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [keyword, setKeyword] = useState('')
  const [wastageDate, setWastageDate] = useState(todayYmd)
  const [query, setQuery] = useState<{ keyword: string; type: TypeFilter } | null>(
    null,
  )
  const [lines, setLines] = useState<WastageLine[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Outlet change: drop cart/search so we never submit another outlet's lines.
  useEffect(() => {
    setQuery(null)
    setLines([])
    setKeyword('')
    setTypeFilter('All')
    setError(null)
    setMessage(null)
    setAddingId(null)
  }, [outletId])

  const catalog = useQuery({
    queryKey: [
      'wastage-search-v2',
      token,
      outletId,
      query?.keyword ?? '',
      query?.type ?? 'All',
    ],
    enabled: !!token && outletId != null && query != null,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => searchWastageCatalog(token!, outletId!, query!.keyword),
  })

  const history = useQuery({
    queryKey: ['wastage-list', token, outletId],
    enabled: !!token && outletId != null && canView,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () =>
      listWastage(token!, outletId!, 1, 20, null, { enrichReasons: true }),
  })

  const results = useMemo(() => {
    const rows = catalog.data || []
    // Always use live chips so changing type after search refilters immediately.
    return rows.filter(
      (row) =>
        matchesType(row, typeFilter) &&
        matchesKeyword(row, query?.keyword ?? keyword),
    )
  }, [catalog.data, typeFilter, query, keyword])

  // Keep last search's type in sync with the chip (client-side filter only).
  useEffect(() => {
    setQuery((prev) => {
      if (!prev || prev.type === typeFilter) return prev
      return { ...prev, type: typeFilter }
    })
  }, [typeFilter])

  const submit = useMutation({
    mutationFn: async () => {
      if (!token || outletId == null) throw new Error('Select an outlet')
      if (!canEdit) throw new Error('Wastage add/edit permission is required')
      if (lines.length === 0) throw new Error('Add at least one item')
      const missingQty = lines.find((line) => parseQty(line.qty) <= 0)
      if (missingQty) {
        throw new Error(`Enter recipe qty for ${missingQty.name}`)
      }
      const payload = lines.map((line) => ({
        itemType: line.itemType,
        itemId: line.itemId,
        quantity: parseQty(line.qty),
        reason: line.reasonId,
      }))
      if (!wastageDate) throw new Error('Please select the date this wastage happened')
      await addWastage(token, outletId, payload, ymdToIsoNoon(wastageDate))
    },
    onSuccess: async () => {
      setLines([])
      setMessage(
        'Wastage submitted. If approval is required, it appears under Home → To Approve.',
      )
      setError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['wastage-list', token, outletId] }),
        qc.invalidateQueries({ queryKey: ['wastage-pending-approvals'] }),
      ])
      await history.refetch()
    },
    onError: (err) => {
      setMessage(null)
      setError((err as Error).message || 'Failed to submit wastage')
    },
  })

  function runSearch(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    setMessage(null)
    if (outletId == null) {
      setError('Select a location in the top bar')
      return
    }
    setQuery({ keyword: keyword.trim(), type: typeFilter })
  }

  async function addItem(item: WastageProduct) {
    if (!token || outletId == null) {
      setError('Select a location in the top bar')
      return
    }
    const already = lines.some(
      (l) => l.itemId === item.id && l.itemType === item.inventoryType,
    )
    if (already) {
      setError(`${item.name} is already in the wastage list`)
      return
    }
    setAddingId(item.id)
    setError(null)
    setMessage(null)
    try {
      let unitPrice = item.unitPrice ?? 0
      let recipeUom = item.uom || 'UOM'
      let availableQuantity = item.availableQuantity
      try {
        const detail = await getWastageProductDetail(token, outletId, item.id)
        if (detail) {
          unitPrice = detail.unitPrice ?? unitPrice
          recipeUom = detail.recipeUnit || recipeUom
          availableQuantity = detail.availableQuantity ?? availableQuantity
        }
      } catch {
        // List price / UOM is enough to keep adding lines.
      }
      setLines((prev) => [
        ...prev,
        {
          key: `${item.inventoryType}:${item.id}:${Date.now()}`,
          itemId: item.id,
          itemType: String(item.inventoryType || 'Ingredient'),
          name: item.name,
          code: item.code,
          recipeUom,
          unitPrice,
          availableQuantity,
          qty: '',
          reasonId: WASTAGE_REASONS[0]?.id ?? 1,
        },
      ])
      setMessage(`Added ${item.name}`)
    } finally {
      setAddingId(null)
    }
  }

  function updateLine(key: string, patch: Partial<WastageLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    )
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key))
  }

  const lineTotal = lines.reduce(
    (sum, line) => sum + parseQty(line.qty) * (line.unitPrice || 0),
    0,
  )

  return (
    <div className="stack inventory-page wastage-page">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/operator/stock')}
      >
        ← Stock
      </button>

      <div className="inventory-header">
        <div>
          <h2 style={{ margin: 0 }}>Wastage</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {selectedLocation?.name
              ? selectedLocation.name
              : 'Select a location in the top bar'}
          </p>
        </div>
      </div>

      {!canView ? (
        <PermissionDenied
          title="Wastage unavailable"
          message="Wastage view permission is required."
        />
      ) : (
        <>
      {!canEdit && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            You can view wastage. Add/edit permission is required to create
            records.
          </p>
        </div>
      )}

      {canEdit && (
      <div className="card wastage-date-card">
        <label className="field wastage-date-field">
          <span>Date this wastage happened</span>
          <input
            type="date"
            value={wastageDate}
            max={todayYmd()}
            onChange={(e) => setWastageDate(e.target.value)}
          />
        </label>
      </div>
      )}

      {canEdit && (
      <form className="card stack wastage-search" onSubmit={runSearch}>
        <div className="wastage-type-row" role="group" aria-label="Search type">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              className={
                typeFilter === t ? 'btn btn-primary' : 'btn btn-secondary'
              }
              onClick={() => {
                setTypeFilter(t)
                if (query) setQuery({ keyword: query.keyword, type: t })
              }}
            >
              {t === 'SubProduct' ? 'Sub-product' : t}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Search product / sub-product / ingredient</span>
          <div className="wastage-search-row">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Name or code"
              disabled={outletId == null}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={outletId == null || catalog.isFetching}
            >
              {catalog.isFetching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </label>

        {catalog.isError && (
          <p className="error-text">
            {(catalog.error as Error).message || 'Failed to load catalog'}
          </p>
        )}
      </form>
      )}

      {canEdit && query && (
        <div className="card stack wastage-results">
          <div className="inventory-header">
            <strong>
              Results
              {query.type !== 'All'
                ? ` · ${query.type === 'SubProduct' ? 'Sub-product' : query.type}`
                : ''}
              {query.keyword ? ` · “${query.keyword}”` : ''}
            </strong>
            <span className="muted">{results.length} found</span>
          </div>

          {catalog.isLoading || catalog.isFetching ? (
            <p className="muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="muted">No matching items for this outlet.</p>
          ) : (
            <ul className="wastage-result-list">
              {results.map((item) => (
                <li key={`${item.inventoryType}-${item.id}`} className="wastage-result-row">
                  <div className="wastage-result-main">
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {item.inventoryType}
                      {item.code ? ` · ${item.code}` : ''}
                      {item.uom ? ` · ${item.uom}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!canEdit || addingId === item.id}
                    onClick={() => void addItem(item)}
                  >
                    {addingId === item.id ? 'Adding…' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canEdit && (
      <div className="card stack wastage-lines">
        <div className="inventory-header">
          <strong>Wastage list</strong>
          <span className="muted">{lines.length} item(s)</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Add items first, then enter QTY and reason before submit.
        </p>

        {lines.length === 0 ? (
          <p className="muted">No items yet. Search and tap Add.</p>
        ) : (
          <div className="wastage-list">
            <div className="wastage-list-head" aria-hidden>
              <span>Name</span>
              <span>UOM</span>
              <span>QTY</span>
              <span>Value</span>
            </div>
            {lines.map((line) => {
              const value = parseQty(line.qty) * (line.unitPrice || 0)
              return (
                <article key={line.key} className="wastage-list-item">
                  <div className="wastage-row">
                    <div className="wastage-col wastage-col-item">
                      <div className="wastage-name" title={line.name}>
                        {line.name}
                      </div>
                      <div className="wastage-id">
                        ID {line.code || line.itemId}
                      </div>
                    </div>

                    <div className="wastage-col wastage-col-uom">
                      <div className="wastage-uom">{line.recipeUom}</div>
                      <div className="wastage-price">
                        @ {formatMoney(line.unitPrice)}
                      </div>
                    </div>

                    <div className="wastage-col wastage-col-qty">
                      <input
                        inputMode="decimal"
                        aria-label={`Quantity for ${line.name}`}
                        value={line.qty}
                        placeholder="0"
                        onChange={(e) =>
                          updateLine(line.key, { qty: e.target.value })
                        }
                      />
                    </div>

                    <div className="wastage-col wastage-col-total">
                      <div className="wastage-value">{formatMoney(value)}</div>
                    </div>
                  </div>

                  <div className="wastage-reason-row">
                    <select
                      aria-label={`Reason for ${line.name}`}
                      value={line.reasonId}
                      onChange={(e) =>
                        updateLine(line.key, {
                          reasonId: Number(e.target.value),
                        })
                      }
                    >
                      {WASTAGE_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="wastage-remove"
                      aria-label={`Remove ${line.name}`}
                      title="Remove"
                      onClick={() => removeLine(line.key)}
                    >
                      ×
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {lines.length > 0 && (
          <div className="wastage-submit-row">
            <div>
              <span className="muted">Estimated total</span>
              <strong style={{ display: 'block' }}>{formatMoney(lineTotal)}</strong>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canEdit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Submitting…' : 'Submit wastage'}
            </button>
          </div>
        )}
      </div>
      )}

      {canEdit && error && <p className="error-text">{error}</p>}
      {canEdit && message && <p className="muted">{message}</p>}

      <div className="card stack">
        <strong>Recent wastage</strong>
        {history.isLoading ? (
          <p className="muted">Loading…</p>
        ) : (history.data || []).length === 0 ? (
          <p className="muted">No wastage history for this outlet.</p>
        ) : (
          <ul className="wastage-history-list">
            {(history.data || []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="wastage-history-row"
                  onClick={() => navigate(`/operator/stock/wastage/${row.id}`)}
                >
                  <div>
                    <strong>#{row.id}</strong>
                    <span className="muted">
                      {' '}
                      · {row.date || '—'} · {row.createdBy || '—'}
                    </span>
                    {row.reason ? (
                      <div className="wastage-history-reason">
                        Reason: {row.reason}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <span>
                      {row.amount != null ? formatMoney(Number(row.amount)) : '—'}
                    </span>
                    {row.status ? (
                      <span className="muted"> · {row.status}</span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}
    </div>
  )
}
