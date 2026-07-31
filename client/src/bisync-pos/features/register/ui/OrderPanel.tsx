import { useState } from 'react'
import type { CartLine, OrderCharges, Product } from '../domain/types'
import { cartGrandTotal, cartSubtotal, removeLine } from '../domain/cart'
import { saleDetailExtraChargeCents } from '../domain/saleDetail'
import { formatMoney } from '../../../core/types/money'
import { ColGroup } from '../../../../components/shared/SortableTableHead'
import './OrderPanel.css'

export type TransactionTool = 'change-table' | 'move-product' | 'void'

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
  onSwapLine?: (line: CartLine) => void
  onOpenHistory: () => void
  onOpenPickup?: () => void
  onAction: (action: 'save' | 'print' | 'payment' | 'cancel') => void
  onTool?: (tool: TransactionTool, selectedLine: CartLine | null) => void
  /** Opened floor table label shown in Cancel tooltip when discarding. */
  activeTableLabel?: string | null
}

function lineIdentity(line: CartLine, index: number): string {
  return line.lineKey ?? `${line.productId}-${index}`
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
  onSwapLine,
  onOpenHistory,
  onOpenPickup,
  onAction,
  onTool,
  activeTableLabel = null,
}: Props) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const subtotal = cartSubtotal(lines, products)
  const grandTotal = cartGrandTotal(lines, products, charges)
  const hasItems = lines.length > 0
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selectedLine =
    selectedKey == null
      ? null
      : lines.find((line, index) => lineIdentity(line, index) === selectedKey) ?? null

  function editCents(
    key: keyof OrderCharges,
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
          {activeTableLabel ? (
            <option value={table}>{activeTableLabel}</option>
          ) : null}
          <option value="t1">Table 1</option>
          <option value="t2">Table 2</option>
          <option value="t5">Table 5</option>
          <option value="t12">Table 12</option>
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
          <h2>Check #{checkNumber}</h2>
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
                const key = lineIdentity(line, index)
                const selected = selectedKey === key
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
                return (
                  <tr
                    key={key}
                    className={selected ? 'is-selected' : undefined}
                    onClick={() => setSelectedKey(selected ? null : key)}
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
                            onClick={e => {
                              e.stopPropagation()
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
                          onClick={e => {
                            e.stopPropagation()
                            onChange(removeLine(lines, line.productId, line.lineKey))
                            if (selectedKey === key) setSelectedKey(null)
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
          onEdit={() => editCents('discountCents', 'Discount ($)')}
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

      <div className="order-panel__tools">
        <button
          type="button"
          className="btn btn--tool"
          disabled={!activeTableLabel}
          title={activeTableLabel ? 'Move this check to another table' : 'Open a table first'}
          onClick={() => onTool?.('change-table', selectedLine)}
        >
          Change Table
        </button>
        <button
          type="button"
          className="btn btn--tool"
          disabled={!selectedLine}
          title={selectedLine ? 'Move selected product to another table' : 'Select a product line first'}
          onClick={() => onTool?.('move-product', selectedLine)}
        >
          Move Product
        </button>
        <button
          type="button"
          className="btn btn--tool btn--tool-void"
          disabled={!hasItems}
          title={selectedLine ? 'Void selected product' : 'Void all items on this check'}
          onClick={() => onTool?.('void', selectedLine)}
        >
          Void
        </button>
      </div>

      <div className="order-panel__actions">
        <button
          type="button"
          className="btn btn--danger"
          title={
            activeTableLabel
              ? `Cancel order and release ${activeTableLabel}`
              : 'Cancel order and return home'
          }
          onClick={() => onAction('cancel')}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!hasItems}
          onClick={() => onAction('save')}
        >
          Save
        </button>
        <button
          type="button"
          className="btn btn--navy"
          disabled={!hasItems}
          onClick={() => onAction('print')}
        >
          Print
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!hasItems}
          onClick={() => onAction('payment')}
        >
          Payment
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
