import type { ReactNode } from 'react'
import type { OrderDetail as OrderDetailType, OrderLine } from '../types'
import { useAuth } from '../auth/AuthProvider'
import { formatOrderStatus, orderStatusHint } from '../utils/statusLabels'
import { QtyStepper } from './QtyStepper'
import { deliveryUomOf, ProductMeta, recipeUomOf } from './ProductMeta'
import {
  OrderTotalsBox,
  type OrderTotalsValues,
} from './OrderTotalsBox'

function money(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function linesSubtotal(lines: OrderLine[]) {
  return lines.reduce((sum, line) => {
    const qty = Number(line.productQuantity ?? 0)
    const price = Number(line.productPrice ?? 0)
    const sub = line.subtotal ?? qty * price
    return sum + (Number.isFinite(Number(sub)) ? Number(sub) : 0)
  }, 0)
}

export function OrderDetailView({
  order,
  actions,
  lines,
  editableLines = false,
  onLineQtyChange,
  onLinePriceChange,
  totals,
  totalsEditable = false,
  onTotalsChange,
  showTotals = true,
  allowAddItem = false,
  onAddItem,
  allowLineChargesEdit = false,
  onEditLineCharges,
}: {
  order: OrderDetailType
  actions?: ReactNode
  /** Override lines (e.g. local edits before receive). */
  lines?: OrderLine[]
  editableLines?: boolean
  onLineQtyChange?: (orderDetailId: number, quantity: number) => void
  onLinePriceChange?: (orderDetailId: number, price: number) => void
  totals?: OrderTotalsValues
  totalsEditable?: boolean
  onTotalsChange?: (next: OrderTotalsValues) => void
  showTotals?: boolean
  /** Show + Add Item for receive / consolidate extras. */
  allowAddItem?: boolean
  onAddItem?: () => void
  /** Receive / consolidate: Edit opens discount & tax popup. */
  allowLineChargesEdit?: boolean
  onEditLineCharges?: (line: OrderLine) => void
}) {
  const { usageRole } = useAuth()
  const role = usageRole === 'vendor' ? 'vendor' : 'operator'
  const hint = orderStatusHint(order.status, role)
  const displayLines = lines ?? order.orderDetails ?? []
  const subtotal = linesSubtotal(displayLines)
  const resolvedTotals: OrderTotalsValues = totals ?? {
    discount: Number(order.totalDiscount ?? 0) || 0,
    deliveryCharge: Number(order.deliveryCharge ?? 0) || 0,
    rounding: Number(order.rounding ?? 0) || 0,
    tax: Number(order.tax ?? 0) || 0,
  }
  // Item count = product rows, not sum of quantities.
  const itemCount = displayLines.length

  return (
    <div className="stack">
      <div className="card">
        <div className="order-card-row">
          <div>
            <h2 style={{ margin: 0 }}>{order.poNumber || `#${order.id}`}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {order.outletName || order.outlet || order.operatorCompanyName}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge">{formatOrderStatus(order.status, role)}</span>
            {hint && (
              <div className="muted" style={{ fontSize: '11px', marginTop: 4 }}>
                {hint}
              </div>
            )}
          </div>
        </div>

        <dl className="detail-grid" style={{ marginTop: 16 }}>
          <div>
            <dt>Vendor / Supplier</dt>
            <dd>{order.vendorName || order.supplier || '—'}</dd>
          </div>
          <div>
            <dt>Delivery address</dt>
            <dd>{order.deliveryAddress || '—'}</dd>
          </div>
          <div>
            <dt>Remarks</dt>
            <dd>{order.remarks || '—'}</dd>
          </div>
        </dl>

        {/* Keep actions in the header when totals are not being edited. */}
        {!totalsEditable && actions}
      </div>

      <div className="card">
        <div className="order-card-row" style={{ alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0 }}>Line items</h3>
          {allowAddItem && onAddItem && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onAddItem}
            >
              + Add Item
            </button>
          )}
        </div>
        {editableLines && (
          <p className="muted" style={{ margin: '0 0 8px' }}>
            {onLinePriceChange
              ? 'Adjust quantities and prices. Qty 0 skips that product (not ordered). Zero every line to cancel the order.'
              : 'Adjust quantities only. Qty 0 skips that product (not ordered). Zero every line to cancel the order.'}{' '}
            {allowAddItem
              ? 'Use + Add Item to include more vendor products.'
              : null}{' '}
            {allowLineChargesEdit
              ? 'Use Edit on a line to set discount (amount or %) and tax — totals update automatically.'
              : null}
          </p>
        )}

        {displayLines.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No line items returned for this PO
          </p>
        ) : (
          <ul className="line-item-list">
            {displayLines.map((line, idx) => {
              const qty = Number(line.productQuantity ?? 0)
              const price = Number(line.productPrice ?? 0)
              const sub =
                line.subtotal ??
                (Number.isFinite(qty) && Number.isFinite(price)
                  ? qty * price
                  : undefined)
              const discount = Number(line.discount ?? 0) || 0
              const tax = Number(line.tax ?? 0) || 0
              const lineId = line.orderDetailId
              const deliveryUom = deliveryUomOf(line)
              const canEditCharges =
                allowLineChargesEdit &&
                !!onEditLineCharges &&
                (lineId != null || line.productId != null)
              const rowKey =
                lineId != null
                  ? `od-${lineId}`
                  : `extra-${line.productId ?? line.ingredientId ?? idx}`
              return (
                <li className="line-item-card" key={rowKey}>
                  <div className="line-item-card-head">
                    <ProductMeta
                      name={line.productName || `Item ${idx + 1}`}
                      ingredientName={line.ingredientName}
                      recipeUom={recipeUomOf(line)}
                      parStock={line.parStock}
                      onHand={line.onHandQuantity ?? line.quantityOnHand}
                    />
                    <div className="line-item-head-actions">
                      {line.isExtra && (
                        <span className="badge line-extra-badge">Extra</span>
                      )}
                      {canEditCharges && (
                        <button
                          type="button"
                          className="btn btn-secondary line-charges-edit-btn"
                          onClick={() => onEditLineCharges(line)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="line-item-metrics">
                    <div className="line-item-field">
                      <span className="line-item-label">
                        Qty
                        {deliveryUom ? ` · ${deliveryUom}` : ''}
                      </span>
                      <div className="line-item-control">
                        {editableLines && lineId != null && onLineQtyChange ? (
                          <QtyStepper
                            value={qty}
                            min={0}
                            onChange={(next) => onLineQtyChange(lineId, next)}
                          />
                        ) : (
                          <span className="line-item-value">
                            {line.productQuantity ?? '—'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="line-item-field">
                      <span className="line-item-label">Price</span>
                      <div className="line-item-control">
                        {editableLines && lineId != null && onLinePriceChange ? (
                          <input
                            className="price-input"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={Number.isFinite(price) ? price : 0}
                            aria-label={`Price for ${line.productName || `item ${idx + 1}`}`}
                            onChange={(e) => {
                              const raw = e.target.value
                              if (raw === '') {
                                onLinePriceChange(lineId, 0)
                                return
                              }
                              const n = Number(raw)
                              if (Number.isFinite(n)) {
                                onLinePriceChange(lineId, Math.max(0, n))
                              }
                            }}
                          />
                        ) : (
                          <span className="line-item-value">
                            {money(line.productPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="line-item-field line-item-field-subtotal">
                      <span className="line-item-label">Subtotal</span>
                      <div className="line-item-control">
                        <span className="line-item-value line-item-subtotal">
                          {money(sub)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(discount > 0 || tax > 0) && (
                    <div className="line-item-charges">
                      {discount > 0 && (
                        <span className="muted">Discount −{money(discount)}</span>
                      )}
                      {tax > 0 && (
                        <span className="muted">Tax {money(tax)}</span>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showTotals && (
        <OrderTotalsBox
          subtotal={subtotal}
          itemCount={itemCount}
          totals={resolvedTotals}
          editable={totalsEditable}
          onChange={onTotalsChange}
        />
      )}

      {/* Receive / consolidate: edit Total Order, then confirm below it. */}
      {totalsEditable && actions ? (
        <div className="card">{actions}</div>
      ) : null}
    </div>
  )
}
