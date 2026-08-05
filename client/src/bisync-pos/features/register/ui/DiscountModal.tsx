import { useEffect, useMemo, useState } from 'react'
import type { PosConfigType } from '../../../../api'
import {
  discountCentsFromPercent,
  findPosConfigBlockedProducts,
  formatDiscountLabel,
} from '../../../../data/entertainmentSettlement'
import { formatMoney } from '../../../core/types/money'
import type { CartLine, Product } from '../domain/types'
import './DiscountModal.css'

export type DiscountApplyPayload = {
  typeId: number
  typeCode: string
  typeName: string
  percentage: number
  discountCents: number
  reason: string
  label: string
}

type Props = {
  subtotalCents: number
  cartLines: CartLine[]
  catalog: Product[]
  discountTypes: PosConfigType[]
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: DiscountApplyPayload) => void
  onClear: () => void
}

export function DiscountModal({
  subtotalCents,
  cartLines,
  catalog,
  discountTypes,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
  onClear,
}: Props) {
  const activeTypes = useMemo(
    () => [...discountTypes].filter(t => t.active !== false)
      .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)),
    [discountTypes],
  )
  const [typeId, setTypeId] = useState<number | null>(activeTypes[0]?.id ?? null)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (typeId != null && activeTypes.some(t => t.id === typeId)) return
    setTypeId(activeTypes[0]?.id ?? null)
  }, [activeTypes, typeId])

  const selected = useMemo(
    () => activeTypes.find(t => t.id === typeId) ?? null,
    [activeTypes, typeId],
  )

  const percentage = Number(selected?.percentage ?? 0)
  const discountCents = discountCentsFromPercent(subtotalCents, percentage)

  const cartProducts = useMemo(() => {
    const byId = new Map(catalog.map(p => [String(p.id), p]))
    return cartLines
      .map(line => byId.get(String(line.productId)))
      .filter((p): p is Product => Boolean(p))
      .map(p => ({ id: p.id, name: p.name, group: p.group }))
  }, [cartLines, catalog])

  const blockedProducts = useMemo(
    () => findPosConfigBlockedProducts(selected, cartProducts),
    [selected, cartProducts],
  )

  const canApply =
    selected != null
    && percentage > 0
    && discountCents > 0
    && blockedProducts.length === 0

  return (
    <div className="discount-modal" role="dialog" aria-modal="true" aria-label="Apply discount">
      <button
        type="button"
        className="discount-modal__backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="discount-modal__card">
        <header>
          <p className="discount-modal__eyebrow">Discount</p>
          <h2>Apply discount type</h2>
          <p>Subtotal {formatMoney(subtotalCents)}</p>
        </header>

        {activeTypes.length === 0 ? (
          <p className="discount-modal__error">
            No active discount types. Add them under POS Config → Discount.
          </p>
        ) : (
          <>
            <label className="discount-modal__field">
              <span>Discount type</span>
              <select
                value={typeId ?? ''}
                disabled={busy}
                onChange={e => setTypeId(Number(e.target.value) || null)}
              >
                {activeTypes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code}) · {Number(t.percentage ?? 0)}%
                  </option>
                ))}
              </select>
            </label>

            <div className="discount-modal__total">
              <span>{Number(percentage)}% off</span>
              <strong>−{formatMoney(discountCents)}</strong>
            </div>

            <label className="discount-modal__field">
              <span>Reason (optional)</span>
              <textarea
                rows={3}
                value={reason}
                disabled={busy}
                placeholder="Optional note for this discount"
                onChange={e => setReason(e.target.value)}
              />
            </label>

            {blockedProducts.length > 0 ? (
              <p className="discount-modal__error" role="alert">
                Not allowed on {selected?.name || 'this type'}:{' '}
                {blockedProducts.map(p => p.name).join(', ')}.
                Remove them or enable Include all on the discount detail.
              </p>
            ) : null}
          </>
        )}

        {error ? <p className="discount-modal__error">{error}</p> : null}

        <footer>
          <button type="button" className="discount-modal__btn" disabled={busy} onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className="discount-modal__btn"
            disabled={busy}
            onClick={onClear}
          >
            Clear discount
          </button>
          <button
            type="button"
            className="discount-modal__btn discount-modal__btn--apply"
            disabled={busy || !canApply}
            onClick={() => {
              if (!selected || !canApply) return
              onConfirm({
                typeId: selected.id,
                typeCode: selected.code,
                typeName: selected.name,
                percentage,
                discountCents,
                reason: reason.trim(),
                label: formatDiscountLabel(selected.code, percentage, reason),
              })
            }}
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  )
}
