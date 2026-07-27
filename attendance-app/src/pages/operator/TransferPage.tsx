import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useLocationFilter } from '../../auth/LocationProvider'
import { canEditTransfer, canViewTransfer } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  addTransfer,
  getTransferFromOutlets,
  getTransferProductDetail,
  getTransferToOutlets,
  listTransfer,
  searchTransferCatalog,
  type TransferInventoryType,
  type TransferProduct,
} from '../../api/transfer'

type TypeFilter = 'All' | TransferInventoryType

type TransferLine = {
  key: string
  itemId: number
  itemType: string
  name: string
  code?: string
  recipeUom: string
  unitPrice: number
  availableQuantity?: number | null
  qty: string
  remarks: string
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

function matchesType(item: TransferProduct, filter: TypeFilter) {
  if (filter === 'All') return true
  const t = String(item.inventoryType || '').toLowerCase().replace(/[\s_-]+/g, '')
  if (filter === 'SubProduct') return t === 'subproduct'
  return t === filter.toLowerCase()
}

export function OperatorTransferPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { token, hasPermission } = useAuth()
  const { selectedLocationId, selectedLocation } = useLocationFilter()
  const canView = canViewTransfer(hasPermission)
  const canEdit = canEditTransfer(hasPermission)

  const [fromOutletId, setFromOutletId] = useState<number | null>(null)
  const [toOutletId, setToOutletId] = useState<number | null>(null)
  const [transferDate, setTransferDate] = useState(todayYmd)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState<{ keyword: string; type: TypeFilter } | null>(
    null,
  )
  const [lines, setLines] = useState<TransferLine[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const fromOutlets = useQuery({
    queryKey: ['transfer-from-outlets', token],
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getTransferFromOutlets(token!),
  })

  // Seed From from the top-bar location once; only re-sync when the top bar changes.
  // Do not reset when the user picks a different From outlet in this form.
  const prevTopBarOutletRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const rows = fromOutlets.data || []
    if (rows.length === 0) return

    const topBarChanged =
      prevTopBarOutletRef.current !== undefined &&
      prevTopBarOutletRef.current !== selectedLocationId
    prevTopBarOutletRef.current = selectedLocationId

    const topBarIsValidFrom =
      selectedLocationId != null &&
      rows.some((o) => Number(o.outletId) === Number(selectedLocationId))

    if (fromOutletId == null) {
      setFromOutletId(
        topBarIsValidFrom ? Number(selectedLocationId) : rows[0]!.outletId,
      )
      return
    }

    if (topBarChanged && topBarIsValidFrom) {
      setFromOutletId(Number(selectedLocationId))
    }
  }, [fromOutlets.data, fromOutletId, selectedLocationId])

  const toOutlets = useQuery({
    queryKey: ['transfer-to-outlets', token, fromOutletId],
    enabled: !!token && fromOutletId != null,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => getTransferToOutlets(token!, fromOutletId!),
  })

  // Clear destination when from changes or to is no longer valid.
  useEffect(() => {
    const rows = toOutlets.data || []
    if (toOutletId == null) return
    if (!rows.some((o) => o.outletId === toOutletId)) {
      setToOutletId(null)
    }
  }, [toOutlets.data, toOutletId])

  useEffect(() => {
    setQuery(null)
    setLines([])
    setKeyword('')
    setError(null)
    setMessage(null)
  }, [fromOutletId, toOutletId])

  // Live type chip refilters current catalog without waiting for a new search.
  useEffect(() => {
    setQuery((prev) => {
      if (!prev || prev.type === typeFilter) return prev
      return { ...prev, type: typeFilter }
    })
  }, [typeFilter])

  const catalog = useQuery({
    queryKey: [
      'transfer-search',
      token,
      fromOutletId,
      toOutletId,
      query?.keyword ?? '',
      query?.type ?? 'All',
    ],
    enabled:
      !!token && fromOutletId != null && toOutletId != null && query != null,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () =>
      searchTransferCatalog(
        token!,
        fromOutletId!,
        toOutletId!,
        query!.keyword,
      ),
  })

  const historyOutletId = fromOutletId ?? selectedLocationId

  const history = useQuery({
    queryKey: ['transfer-list', token, historyOutletId],
    enabled: !!token && historyOutletId != null,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => listTransfer(token!, historyOutletId!, 1, 50),
  })

  const results = useMemo(() => {
    const rows = catalog.data || []
    return rows.filter((row) => matchesType(row, typeFilter))
  }, [catalog.data, typeFilter])

  const submit = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Not signed in')
      if (!canEdit) throw new Error('Transfer add/edit permission is required')
      if (fromOutletId == null || toOutletId == null) {
        throw new Error('Select from and to outlets')
      }
      if (fromOutletId === toOutletId) {
        throw new Error('From and to outlets must be different')
      }
      if (lines.length === 0) throw new Error('Add at least one item')
      const missingQty = lines.find((line) => parseQty(line.qty) <= 0)
      if (missingQty) {
        throw new Error(`Enter qty for ${missingQty.name}`)
      }
      if (!transferDate) throw new Error('Please select the transfer date')
      await addTransfer(
        token,
        fromOutletId,
        toOutletId,
        lines.map((line) => ({
          inventoryType: line.itemType,
          itemId: line.itemId,
          quantity: parseQty(line.qty),
          remarks: line.remarks.trim() || null,
        })),
        ymdToIsoNoon(transferDate),
      )
    },
    onSuccess: async () => {
      setLines([])
      setMessage('Transfer submitted')
      setError(null)
      await qc.invalidateQueries({ queryKey: ['transfer-list'] })
      // Refetch for the From outlet used on submit (List is from-outlet scoped).
      await qc.refetchQueries({
        queryKey: ['transfer-list', token, fromOutletId],
      })
    },
    onError: (err) => {
      setMessage(null)
      setError((err as Error).message || 'Failed to submit transfer')
    },
  })

  function runSearch(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    setMessage(null)
    if (fromOutletId == null || toOutletId == null) {
      setError('Select from and to outlets first')
      return
    }
    setQuery({ keyword: keyword.trim(), type: typeFilter })
  }

  async function addItem(item: TransferProduct) {
    if (!token || fromOutletId == null || toOutletId == null) {
      setError('Select from and to outlets first')
      return
    }
    const already = lines.some(
      (l) => l.itemId === item.id && l.itemType === item.inventoryType,
    )
    if (already) {
      setError(`${item.name} is already in the transfer list`)
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
        const detail = await getTransferProductDetail(
          token,
          fromOutletId,
          toOutletId,
          item.id,
        )
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
          remarks: '',
        },
      ])
      setMessage(`Added ${item.name}`)
    } finally {
      setAddingId(null)
    }
  }

  function updateLine(key: string, patch: Partial<TransferLine>) {
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

  const outletsReady = fromOutletId != null && toOutletId != null

  return (
    <div className="stack inventory-page transfer-page">
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/operator/stock')}
      >
        ← Stock
      </button>

      <div className="inventory-header">
        <div>
          <h2 style={{ margin: 0 }}>Transfer</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Internal outlet stock transfer
            {selectedLocation?.name ? ` · ${selectedLocation.name}` : ''}
          </p>
        </div>
      </div>

      {!canView ? (
        <PermissionDenied
          title="Transfer unavailable"
          message="Transfer view permission is required."
        />
      ) : null}

      {canView && !canEdit ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            You can view transfers. Transfer add/edit permission is required to
            create a request.
          </p>
        </div>
      ) : null}

      {canEdit && (
      <>
      <div className="card stack transfer-setup">
        <label className="field wastage-date-field">
          <span>Transfer date</span>
          <input
            type="date"
            value={transferDate}
            max={todayYmd()}
            onChange={(e) => setTransferDate(e.target.value)}
          />
        </label>

        <div className="transfer-outlet-grid">
          <label className="field">
            <span>From outlet</span>
            <select
              value={fromOutletId ?? ''}
              disabled={fromOutlets.isLoading}
              onChange={(e) => {
                const v = Number(e.target.value)
                setFromOutletId(Number.isFinite(v) ? v : null)
                setToOutletId(null)
              }}
            >
              <option value="">Select…</option>
              {(fromOutlets.data || []).map((o) => (
                <option key={o.outletId} value={o.outletId}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>To outlet</span>
            <select
              value={toOutletId ?? ''}
              disabled={fromOutletId == null || toOutlets.isLoading}
              onChange={(e) => {
                const v = Number(e.target.value)
                setToOutletId(Number.isFinite(v) ? v : null)
              }}
            >
              <option value="">Select…</option>
              {(toOutlets.data || []).map((o) => (
                <option key={o.outletId} value={o.outletId}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {fromOutlets.isError && (
          <p className="error-text" style={{ margin: 0 }}>
            {(fromOutlets.error as Error).message || 'Failed to load from outlets'}
          </p>
        )}
        {toOutlets.isError && (
          <p className="error-text" style={{ margin: 0 }}>
            {(toOutlets.error as Error).message || 'Failed to load to outlets'}
          </p>
        )}
      </div>

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
              disabled={!outletsReady}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!outletsReady || catalog.isFetching}
            >
              {catalog.isFetching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </label>

        {!outletsReady && (
          <p className="muted" style={{ margin: 0 }}>
            Select from and to outlets to search transferable stock.
          </p>
        )}

        {catalog.isError && (
          <p className="error-text">
            {(catalog.error as Error).message || 'Failed to load catalog'}
          </p>
        )}
      </form>

      {query && (
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
            <p className="muted">No matching items for these outlets.</p>
          ) : (
            <ul className="wastage-result-list">
              {results.map((item) => (
                <li
                  key={`${item.inventoryType}-${item.id}`}
                  className="wastage-result-row"
                >
                  <div className="wastage-result-main">
                    <strong>{item.name}</strong>
                    <span className="muted">
                      {item.inventoryType}
                      {item.code ? ` · ${item.code}` : ''}
                      {item.uom ? ` · ${item.uom}` : ''}
                      {item.availableQuantity != null
                        ? ` · avail ${item.availableQuantity}`
                        : ''}
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

      <div className="card stack wastage-lines">
        <div className="inventory-header">
          <strong>Transfer list</strong>
          <span className="muted">{lines.length} item(s)</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Add items first, then enter QTY (and optional remarks) before submit.
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
                        {line.availableQuantity != null
                          ? ` · avail ${line.availableQuantity}`
                          : ''}
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
                    <input
                      className="transfer-remarks"
                      aria-label={`Remarks for ${line.name}`}
                      placeholder="Remarks (optional)"
                      value={line.remarks}
                      onChange={(e) =>
                        updateLine(line.key, { remarks: e.target.value })
                      }
                    />
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
              {submit.isPending ? 'Submitting…' : 'Submit transfer'}
            </button>
          </div>
        )}
      </div>
      </>
      )}

      {canEdit && error && <p className="error-text">{error}</p>}
      {canEdit && message && <p className="muted">{message}</p>}

      {canView && (
      <div className="card stack">
        <strong>Recent transfers</strong>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Showing transfers from{' '}
          {(fromOutlets.data || []).find((o) => o.outletId === historyOutletId)
            ?.name ||
            (historyOutletId != null ? `outlet #${historyOutletId}` : '…')}
        </p>
        {historyOutletId == null ? (
          <p className="muted">Select a From outlet to load history.</p>
        ) : history.isLoading ? (
          <p className="muted">Loading…</p>
        ) : history.isError ? (
          <p className="error-text">
            {(history.error as Error).message || 'Failed to load transfers'}
          </p>
        ) : (history.data || []).length === 0 ? (
          <p className="muted">No transfer history for this from-outlet.</p>
        ) : (
          <ul className="wastage-history-list">
            {(history.data || []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="wastage-history-row"
                  onClick={() => navigate(`/operator/stock/transfer/${row.id}`)}
                >
                  <div>
                    <strong>#{row.id}</strong>
                    <span className="muted">
                      {' '}
                      · {row.date || '—'}
                      {row.fromOutletName || row.toOutletName
                        ? ` · ${row.fromOutletName || '?'} → ${row.toOutletName || '?'}`
                        : ''}
                    </span>
                  </div>
                  <div>
                    <span>
                      {row.amount != null
                        ? formatMoney(Number(row.amount))
                        : '—'}
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
      )}
    </div>
  )
}
