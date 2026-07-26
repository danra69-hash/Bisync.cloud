import { useEffect, useMemo, useState } from 'react'
import type { OrderLine } from '../types'
import { deliveryUomOf, ProductMeta, recipeUomOf } from './ProductMeta'

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

function parseNonNeg(raw: string) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return roundMoney(n)
}

export type LineChargesResult = {
  discount: number
  tax: number
}

type DiscountMode = 'amount' | 'percent'

type Props = {
  line: OrderLine
  busy?: boolean
  onClose: () => void
  onSave: (next: LineChargesResult) => void
}

export function LineChargesModal({ line, busy, onClose, onSave }: Props) {
  const qty = Number(line.productQuantity ?? 0) || 0
  const price = Number(line.productPrice ?? 0) || 0
  const lineSubtotal = roundMoney(qty * price)

  const [discountMode, setDiscountMode] = useState<DiscountMode>('amount')
  const [discountInput, setDiscountInput] = useState(
    String(Number(line.discount ?? 0) || 0),
  )
  const [taxInput, setTaxInput] = useState(String(Number(line.tax ?? 0) || 0))

  useEffect(() => {
    setDiscountMode('amount')
    setDiscountInput(String(Number(line.discount ?? 0) || 0))
    setTaxInput(String(Number(line.tax ?? 0) || 0))
  }, [line.orderDetailId, line.productId, line.discount, line.tax])

  const resolvedDiscount = useMemo(() => {
    const raw = parseNonNeg(discountInput)
    if (discountMode === 'percent') {
      return roundMoney(Math.min(lineSubtotal, (lineSubtotal * raw) / 100))
    }
    return roundMoney(Math.min(lineSubtotal, raw))
  }, [discountInput, discountMode, lineSubtotal])

  const resolvedTax = useMemo(() => parseNonNeg(taxInput), [taxInput])

  const lineTotal = roundMoney(lineSubtotal - resolvedDiscount + resolvedTax)

  function commit() {
    onSave({ discount: resolvedDiscount, tax: resolvedTax })
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="modal-panel stack line-charges-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-charges-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="order-card-row">
          <h3 id="line-charges-title" style={{ margin: 0 }}>
            Edit discount &amp; tax
          </h3>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <ProductMeta
          name={line.productName || 'Product'}
          ingredientName={line.ingredientName}
          deliveryUom={deliveryUomOf(line)}
          recipeUom={recipeUomOf(line)}
          parStock={line.parStock}
          onHand={line.onHandQuantity ?? line.quantityOnHand}
        />

        <div className="line-charges-summary">
          <div className="line-charges-summary-row">
            <span>Line subtotal</span>
            <strong>{money(lineSubtotal)}</strong>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            Qty {qty}
            {deliveryUomOf(line) ? ` · ${deliveryUomOf(line)}` : ''} ×{' '}
            {money(price)}
          </div>
        </div>

        <fieldset className="line-charges-fieldset">
          <legend>Discount</legend>
          <div className="line-charges-mode">
            <button
              type="button"
              className={`chip${discountMode === 'amount' ? ' active' : ''}`}
              disabled={busy}
              onClick={() => {
                setDiscountMode('amount')
                setDiscountInput(String(resolvedDiscount))
              }}
            >
              Amount
            </button>
            <button
              type="button"
              className={`chip${discountMode === 'percent' ? ' active' : ''}`}
              disabled={busy}
              onClick={() => {
                const pct =
                  lineSubtotal > 0
                    ? roundMoney((resolvedDiscount / lineSubtotal) * 100)
                    : 0
                setDiscountMode('percent')
                setDiscountInput(String(pct))
              }}
            >
              Percentage
            </button>
          </div>
          <label className="field" style={{ margin: 0 }}>
            <span>
              {discountMode === 'percent' ? 'Discount %' : 'Discount amount'}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={discountMode === 'percent' ? 100 : undefined}
              step="0.01"
              value={discountInput}
              disabled={busy}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
          </label>
          {discountMode === 'percent' && (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Equals −{money(resolvedDiscount)}
            </p>
          )}
        </fieldset>

        <label className="field">
          <span>Tax amount</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={taxInput}
            disabled={busy}
            onChange={(e) => setTaxInput(e.target.value)}
          />
        </label>

        <div className="line-charges-summary">
          <div className="line-charges-summary-row">
            <span>Discount</span>
            <strong>− {money(resolvedDiscount)}</strong>
          </div>
          <div className="line-charges-summary-row">
            <span>Tax</span>
            <strong>{money(resolvedTax)}</strong>
          </div>
          <div className="line-charges-summary-row line-charges-total">
            <span>Line total</span>
            <strong>{money(lineTotal)}</strong>
          </div>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={commit}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

export function sumLineDiscounts(lines: OrderLine[]) {
  return roundMoney(
    lines.reduce((sum, line) => sum + (Number(line.discount) || 0), 0),
  )
}

export function sumLineTaxes(lines: OrderLine[]) {
  return roundMoney(
    lines.reduce((sum, line) => sum + (Number(line.tax) || 0), 0),
  )
}
