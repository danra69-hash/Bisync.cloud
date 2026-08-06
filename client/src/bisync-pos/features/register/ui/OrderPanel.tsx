import type { CartLine, OrderCharges, Product } from '../domain/types'
import { cartGrandTotal, cartSubtotal, removeLine } from '../domain/cart'
import { saleDetailExtraChargeCents } from '../domain/saleDetail'
import { formatPosCheckNumber } from '../domain/checkNumber'
import { formatMoney } from '../../../core/types/money'
import { ColGroup } from '../../../../components/shared/SortableTableHead'
import './OrderPanel.css'

type Props = {
  checkNumber: number
  cover: number
  lines: CartLine[]
  products: Product[]
  charges: OrderCharges
  dining: string
  table: string
  pickupLabel?: string
  onDiningChange: (value: string) => void
  onTableChange: (value: string) => void
  onCoverChange: (cover: number) => void
  onChange: (lines: CartLine[]) => void
  onChargesChange: (charges: OrderCharges) => void
  /** Opens PosConfig discount type picker (percentage + optional reason). */
  onEditDiscount?: () => void
  onSwapLine?: (line: CartLine) => void
  /** When set, intercepts trash instead of silently removing the line. */
  onRemoveLine?: (line: CartLine) => void
  selectedLineKey?: string | null
  /** Multi-highlight for Move Product (falls back to selectedLineKey). */
  selectedLineKeys?: string[]
  onSelectLine?: (line: CartLine) => void
  onOpenHistory: () => void
  onOpenPickup?: () => void
  onAction: (
    action: 'ok' | 'print' | 'payment' | 'cancel' | 'changeTable' | 'moveProduct',
  ) => void
  /** Opened floor table label (Cancel discards unsaved edits only). */
  activeTableLabel?: string | null
  /** True while a payment charge is in flight. */
  paymentBusy?: boolean
  /** Floor-plan tables for the location (replaces demo T1/T5 list). */
  tableOptions?: Array<{ id: string; label: string }>
}

export function OrderPanel({
  checkNumber,
  cover,
  lines,
  products,
  charges,
  dining,
  table,
  pickupLabel,
  onDiningChange,
  onTableChange,
  onCoverChange,
  onChange,
  onChargesChange,
  onEditDiscount,
  onSwapLine,
  onRemoveLine,
  selectedLineKey = null,
  selectedLineKeys,
  onSelectLine,
  onOpenHistory,
  onOpenPickup,
  onAction,
  activeTableLabel = null,
  paymentBusy = false,
  tableOptions = [],
}: Props) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const subtotal = cartSubtotal(lines, products)
  const grandTotal = cartGrandTotal(lines, products, charges)
  const hasItems = lines.length > 0
  const hasHighlightedLines = (selectedLineKeys?.length ?? 0) > 0
    || Boolean(selectedLineKey)

  function editCents(
    key: 'discountCents' | 'serviceCents' | 'taxRegularCents' | 'taxAlcoholCents',
    label: string,
  ) {
    const raw = window.prompt(label, String(charges[key] / 100))
    if (raw == null) return
    const dollars = Number(raw)
    if (Number.isFinite(dollars) && dollars >= 0) {
      onChargesChange({ ...charges, [key]: Math.round(dollars * 100) })
    }
  }

  return (
    <aside className="order-panel">
      <button
        type="button"
        className="order-panel__history-btn"
        onClick={onOpenHistory}
      >
        History
      </button>

      <div className="order-panel__selects">
        <select value={dining} onChange={(e) => onDiningChange(e.target.value)}>
          <option value="">Select Dining</option>
          <option value="dine-in">Dine In</option>
          <option value="takeaway">Takeaway</option>
          <option value="delivery">Delivery</option>
        </select>
        <select value={table} onChange={(e) => onTableChange(e.target.value)}>
          <option value="">Select Table</option>
          {activeTableLabel && table && !tableOptions.some(t => t.id === table) ? (
            <option value={table}>{activeTableLabel}</option>
          ) : null}
          {tableOptions.length > 0
            ? tableOptions.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))
            : (
              <>
                <option value="t1">Table 1</option>
                <option value="t2">Table 2</option>
                <option value="t5">Table 5</option>
              </>
            )}
        </select>
      </div>

      {dining === 'takeaway' && pickupLabel ? (
        <button
          type="button"
          className="order-panel__pickup"
          onClick={onOpenPickup}
          title="Change pick up time"
        >
          {pickupLabel}
        </button>
      ) : null}

      <div className="order-panel__heading">
        <div className="order-panel__heading-main">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M6 7h12l-1 12H7L6 7z" />
            <path d="M9 7V5a3 3 0 016 0v2" />
          </svg>
          <h2>Check #{formatPosCheckNumber(checkNumber)}</h2>
        </div>
        <label className="order-panel__cover">
          Cover
          <input
            type="number"
            min={1}
            max={99}
            value={cover}
            onChange={(e) =>
              onCoverChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
            }
          />
        </label>
      </div>

      <div className="order-panel__lines">
        {lines.length === 0 ? (
          <p className="order-panel__empty">Add products to start this order.</p>
        ) : (
          <table className="order-lines-table">
            <ColGroup widths={['36%', '12%', '18%', '18%', 120]} />
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">QTY</th>
                <th scope="col">Unit Price</th>
                <th scope="col">Total</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const product = byId.get(line.productId)
                if (!product) return null
                const extraCents = saleDetailExtraChargeCents(line.saleDetail)
                const lineTotal = product.priceCents * line.quantity + extraCents
                const qtyLabel = product.pricedByWeight && product.weightUom
                  ? `${line.quantity} ${product.weightUom}`
                  : String(line.quantity)
                const unitLabel = product.pricedByWeight && product.weightUom
                  ? `${formatMoney(product.priceCents)}/${product.weightUom}`
                  : formatMoney(product.priceCents)
                const canSwap = Boolean(
                  onSwapLine
                  && product.isVariableComponent
                  && (product.variableComponentSlots?.length ?? 0) > 0,
                )
                const rowKey = line.lineKey ?? `${line.productId}-${index}`
                const selectionKey = line.lineKey ?? `pid:${line.productId}`
                const selectedKeys = selectedLineKeys ?? (selectedLineKey ? [selectedLineKey] : [])
                const isSelected = selectedKeys.includes(selectionKey)
                return (
                  <tr
                    key={rowKey}
                    className={isSelected ? 'is-selected' : undefined}
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => onSelectLine?.(line)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      onSelectLine?.(line)
                    }}
                  >
                    <td className="order-lines-table__product">
                      <div>{product.name}</div>
                      {line.note ? (
                        <div className="order-lines-table__note">{line.note}</div>
                      ) : null}
                    </td>
                    <td className="order-lines-table__qty">{qtyLabel}</td>
                    <td className="order-lines-table__price">
                      {unitLabel}
                    </td>
                    <td className="order-lines-table__total">
                      {formatMoney(lineTotal)}
                    </td>
                    <td className="order-lines-table__remove">
                      <div className="order-line__actions">
                        {canSwap ? (
                          <button
                            type="button"
                            className="order-line__swap"
                            aria-label={`Swap components for ${product.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectLine?.(line)
                              onSwapLine?.(line)
                            }}
                          >
                            SWAP
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="order-line__remove"
                          aria-label={`Remove ${product.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onRemoveLine) onRemoveLine(line)
                            else onChange(removeLine(lines, line.productId, line.lineKey))
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                          >
                            <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="order-panel__summary">
        <SummaryRow label="Sub-Total" value={formatMoney(subtotal)} />
        <SummaryRow
          label="Discount"
          value={formatMoney(charges.discountCents)}
          editable
          onEdit={() => {
            if (onEditDiscount) onEditDiscount()
            else editCents('discountCents', 'Discount ($)')
          }}
        />
        <SummaryRow
          label="Service"
          value={formatMoney(charges.serviceCents)}
          editable
          onEdit={() => editCents('serviceCents', 'Service ($)')}
        />
        <SummaryRow
          label="Tax Regular"
          value={formatMoney(charges.taxRegularCents)}
          editable
          onEdit={() => editCents('taxRegularCents', 'Tax Regular ($)')}
        />
        <SummaryRow
          label="Tax Alcohol"
          value={formatMoney(charges.taxAlcoholCents)}
          editable
          onEdit={() => editCents('taxAlcoholCents', 'Tax Alcohol ($)')}
        />
        <div className="order-panel__total">
          <span>Grand Total</span>
          <strong>{formatMoney(grandTotal)}</strong>
        </div>
      </div>

      <div className="order-panel__actions">
        <button
          type="button"
          className="btn btn--change-table"
          disabled={paymentBusy}
          title="Move this check to another table"
          onClick={() => onAction('changeTable')}
        >
          Change Table
        </button>
        <button
          type="button"
          className="btn btn--move-product"
          disabled={!hasItems || !hasHighlightedLines || paymentBusy}
          title={
            hasHighlightedLines
              ? 'Move highlighted product line(s) to another table'
              : 'Highlight one or more line items first'
          }
          onClick={() => onAction('moveProduct')}
        >
          Move Product
        </button>
        <button
          type="button"
          className="btn btn--payment"
          disabled={!hasItems || paymentBusy}
          onClick={() => onAction('payment')}
        >
          {paymentBusy ? 'Paying…' : 'Payment'}
        </button>
        <button
          type="button"
          className="btn btn--print"
          disabled={!hasItems || paymentBusy}
          onClick={() => onAction('print')}
        >
          Print
        </button>
        <button
          type="button"
          className="btn btn--cancel"
          title={
            activeTableLabel
              ? `Discard unsaved edits and leave ${activeTableLabel}`
              : 'Discard unsaved edits and return home'
          }
          onClick={() => onAction('cancel')}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--ok"
          disabled={!hasItems || paymentBusy}
          onClick={() => onAction('ok')}
        >
          OK
        </button>
      </div>
    </aside>
  )
}

function SummaryRow({
  label,
  value,
  editable,
  onEdit,
}: {
  label: string
  value: string
  editable?: boolean
  onEdit?: () => void
}) {
  return (
    <div className="summary-row">
      <span>
        {label}
        {editable && (
          <button
            type="button"
            className="summary-row__edit"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
          >
            ✎
          </button>
        )}
      </span>
      <span>{value}</span>
    </div>
  )
}
