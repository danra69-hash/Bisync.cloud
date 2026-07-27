import { useState } from 'react'

export type OrderTotalsValues = {
  discount: number
  deliveryCharge: number
  rounding: number
  tax: number
}

type EditableField = keyof OrderTotalsValues

function money(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function computeGrandTotal(
  subtotal: number,
  totals: OrderTotalsValues,
) {
  return roundMoney(
    subtotal -
      (Number(totals.discount) || 0) +
      (Number(totals.deliveryCharge) || 0) +
      (Number(totals.rounding) || 0) +
      (Number(totals.tax) || 0),
  )
}

const FIELD_LABELS: Record<EditableField, string> = {
  discount: 'Total Discount',
  deliveryCharge: 'Delivery Charge',
  rounding: 'Rounding',
  tax: 'Tax',
}

export function OrderTotalsBox({
  subtotal,
  itemCount,
  totals,
  editable = false,
  onChange,
}: {
  subtotal: number
  /** Number of line items (product rows), not sum of quantities. */
  itemCount: number
  totals: OrderTotalsValues
  editable?: boolean
  onChange?: (next: OrderTotalsValues) => void
}) {
  const [editing, setEditing] = useState<EditableField | null>(null)
  const [draft, setDraft] = useState('')
  const grandTotal = computeGrandTotal(subtotal, totals)

  function startEdit(field: EditableField) {
    if (!editable || !onChange) return
    setEditing(field)
    setDraft(String(Number(totals[field]) || 0))
  }

  function commitEdit() {
    if (!editing || !onChange) {
      setEditing(null)
      return
    }
    const parsed = Number(draft)
    const value = Number.isFinite(parsed) ? Math.max(0, roundMoney(parsed)) : 0
    onChange({ ...totals, [editing]: value })
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
    setDraft('')
  }

  function renderEditableRow(field: EditableField, showAsNegative = false) {
    const amount = Number(totals[field]) || 0
    const isEditing = editing === field
    return (
      <div className="order-totals-row" key={field}>
        <span className="order-totals-label">{FIELD_LABELS[field]}</span>
        <div className="order-totals-value-wrap">
          {editable && onChange && !isEditing && (
            <button
              type="button"
              className="btn-link order-totals-edit"
              onClick={() => startEdit(field)}
            >
              Edit
            </button>
          )}
          {isEditing ? (
            <div className="order-totals-edit-inline">
              <input
                className="price-input order-totals-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={draft}
                autoFocus
                aria-label={FIELD_LABELS[field]}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitEdit()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary order-totals-done"
                onClick={commitEdit}
              >
                Done
              </button>
            </div>
          ) : (
            <strong className="order-totals-amount">
              {showAsNegative ? `− ${money(amount)}` : money(amount)}
            </strong>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card order-totals-box">
      <h3 className="order-totals-title">Total Order</h3>
      <div className="order-totals-rows">
        <div className="order-totals-row">
          <span className="order-totals-label">Subtotal</span>
          <strong className="order-totals-amount">{money(subtotal)}</strong>
        </div>
        {renderEditableRow('discount', true)}
        {renderEditableRow('deliveryCharge')}
        {renderEditableRow('rounding')}
        {renderEditableRow('tax')}
        <div className="order-totals-divider" role="presentation" />
        <div className="order-totals-row order-totals-grand">
          <span className="order-totals-label">
            Grand Total{' '}
            <span className="order-totals-item-count">
              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
            </span>
          </span>
          <strong className="order-totals-amount">{money(grandTotal)}</strong>
        </div>
      </div>
    </div>
  )
}
