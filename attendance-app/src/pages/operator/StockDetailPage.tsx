import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { canViewInventory } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  getFullInventoryDetail,
  type InventoryAdjustment,
  type InventoryDetailIngredient,
  type InventoryDetailSummary,
} from '../../api/inventory'
import {
  inventoryDateLabel,
  roleClass,
  roleLabel,
  statusClass,
} from '../../utils/inventoryLabels'

function money(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function qty(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function sameText(a?: string | null, b?: string | null) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

function IngredientRow({
  row,
  storage,
}: {
  row: InventoryDetailIngredient
  storage: boolean
}) {
  return (
    <div className="inventory-detail-row">
      <div>
        <strong>{row.ingredientName || '—'}</strong>
        <div className="muted">
          {[
            row.ingredientGroup,
            row.ingredientUOM,
            storage ? row.location : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {(row.actualValue != null || row.systemValue != null) && (
          <div className="muted">
            Value: {money(row.actualValue)} / {money(row.systemValue)}
          </div>
        )}
      </div>
      <div className="inventory-detail-nums">
        <span>{qty(row.actualQuantity)}</span>
        <span className="muted">{qty(row.systemQuantity)}</span>
      </div>
      <div className="inventory-detail-var">{qty(row.variance)}</div>
    </div>
  )
}

export function OperatorStockDetailPage() {
  const { id } = useParams()
  const inventoryId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const { token, hasPermission } = useAuth()
  const canView = canViewInventory(hasPermission)
  const passed = (location.state as { inventory?: InventoryAdjustment } | null)
    ?.inventory

  const [selectedSummary, setSelectedSummary] =
    useState<InventoryDetailSummary | null>(null)

  const detail = useQuery({
    queryKey: ['inventory-detail-full', token, inventoryId],
    enabled: !!token && Number.isFinite(inventoryId) && canView,
    queryFn: () => getFullInventoryDetail(token!, inventoryId),
  })

  const header: InventoryAdjustment = {
    id: inventoryId,
    createdDate: detail.data?.createdDate || passed?.createdDate,
    stockTakeDate: detail.data?.stockTakeDate || passed?.stockTakeDate,
    createdBy: detail.data?.createdBy || passed?.createdBy,
    createdByRole: detail.data?.role || passed?.createdByRole,
    method: detail.data?.method || passed?.method,
    type: detail.data?.type || passed?.type,
    detail: detail.data?.detail || passed?.detail,
    status: detail.data?.status || passed?.status,
  }

  const isStorage = (header.type || '').toLowerCase() === 'storage'
  const summary = detail.data?.summary || []
  const ingredients = detail.data?.ingredientDetail || []

  const popupIngredients = useMemo(() => {
    if (!selectedSummary) return []
    const matched = ingredients.filter(
      (row) =>
        sameText(row.ingredientCategory, selectedSummary.ingredientCategory) &&
        sameText(row.ingredientGroup, selectedSummary.ingredientGroup),
    )
    if (matched.length > 0) return matched
    // Fallback if category/group labels are missing on rows: match group only
    return ingredients.filter((row) =>
      sameText(row.ingredientGroup, selectedSummary.ingredientGroup),
    )
  }, [ingredients, selectedSummary])

  if (!canView) {
    return (
      <div className="stack inventory-page">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <PermissionDenied
          title="Inventory unavailable"
          message="Inventory view permission is required."
        />
      </div>
    )
  }

  return (
    <div className="stack inventory-page">
      <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h2 style={{ margin: 0 }}>Inventory History</h2>

      <div className="inventory-status-banner">
        Current status: {header.status || '—'}
      </div>

      <div className="card inventory-item">
        <div className="inventory-item-top">
          <div className="inventory-item-who">
            {roleLabel(header.createdByRole) ? (
              <span className={`role-badge ${roleClass(header.createdByRole)}`}>
                {roleLabel(header.createdByRole)}
              </span>
            ) : null}
            <strong>{header.createdBy || '—'}</strong>
          </div>
          {header.status ? (
            <span className={`status-chip ${statusClass(header.status)}`}>
              {header.status}
            </span>
          ) : null}
        </div>
        <div className="inventory-item-meta">
          <div>Date: {inventoryDateLabel(header)}</div>
          <div>Method: {header.method || '—'}</div>
          <div>Type: {header.type || '—'}</div>
          <div>Detail: {header.detail || '—'}</div>
        </div>
      </div>

      {detail.isLoading && <p className="muted">Loading detail…</p>}
      {detail.isError && (
        <p className="error-text">
          {(detail.error as Error).message || 'Failed to load inventory detail'}
        </p>
      )}

      {!detail.isLoading && !detail.isError && (
        <section className="card inventory-section">
          <h3 style={{ marginTop: 0 }}>Summary</h3>
          <p className="muted" style={{ margin: 0 }}>
            Tap a category / group to view the full ingredient list
          </p>
          <div className="inventory-detail-head">
            <span>Category / Group</span>
            <span>Actual / System value</span>
            <span>Variance</span>
          </div>
          {summary.length === 0 ? (
            <p className="muted">No summary rows</p>
          ) : (
            summary.map((row, idx) => (
              <button
                key={`${row.ingredientCategory}-${row.ingredientGroup}-${idx}`}
                type="button"
                className="inventory-summary-btn"
                onClick={() => setSelectedSummary(row)}
              >
                <div className="inventory-detail-row">
                  <div>
                    <strong>{row.ingredientCategory || '—'}</strong>
                    <div className="muted">{row.ingredientGroup || '—'}</div>
                  </div>
                  <div className="inventory-detail-nums">
                    <span>{money(row.actualValue)}</span>
                    <span className="muted">{money(row.systemValue)}</span>
                  </div>
                  <div className="inventory-detail-var">{money(row.variance)}</div>
                </div>
              </button>
            ))
          )}
        </section>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => navigate('/operator/stock/inventory')}
      >
        Close
      </button>

      {selectedSummary && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelectedSummary(null)}
        >
          <div
            className="modal-panel stack inventory-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-summary-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="order-card-row">
              <div>
                <h3 id="inventory-summary-modal-title" style={{ margin: 0 }}>
                  {selectedSummary.ingredientCategory || 'Category'}
                </h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {selectedSummary.ingredientGroup || 'Group'} ·{' '}
                  {popupIngredients.length} item(s)
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedSummary(null)}
              >
                Close
              </button>
            </div>

            <div className="inventory-detail-head">
              <span>
                {isStorage
                  ? 'Name / Group / UOM / Location'
                  : 'Name / Group / UOM'}
              </span>
              <span>Actual / System qty</span>
              <span>Variance</span>
            </div>

            <div className="inventory-summary-modal-list">
              {popupIngredients.length === 0 ? (
                <p className="muted">No ingredient rows for this summary.</p>
              ) : (
                popupIngredients.map((row, idx) => (
                  <IngredientRow
                    key={`${row.ingredientId ?? idx}`}
                    row={row}
                    storage={isStorage}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
