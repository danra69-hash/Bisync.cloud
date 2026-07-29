import { useMemo, useState } from 'react'
import type { VariableCombinationOption } from '../../../../data/productVariable'
import type { PosSaleCombinationSelection } from '../domain/saleDetail'
import './CombinationPickerModal.css'

type Props = {
  productName: string
  choiceQty: number
  options: VariableCombinationOption[]
  onCancel: () => void
  onConfirm: (picks: PosSaleCombinationSelection[]) => void
}

type PickRow = {
  productId: number
  productCode: string
  productName: string
  productGroup: string
  quantity: number
}

export function CombinationPickerModal({
  productName,
  choiceQty,
  options,
  onCancel,
  onConfirm,
}: Props) {
  const need = choiceQty > 0 ? Math.round(choiceQty) : 1
  const [counts, setCounts] = useState<Record<number, number>>({})

  const selectedTotal = useMemo(
    () => Object.values(counts).reduce((sum, qty) => sum + qty, 0),
    [counts],
  )
  const remaining = Math.max(0, need - selectedTotal)

  const grouped = useMemo(() => {
    const map = new Map<string, VariableCombinationOption[]>()
    for (const option of options) {
      const group = (option.productGroup || 'Choices').trim() || 'Choices'
      const list = map.get(group) ?? []
      list.push(option)
      map.set(group, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [options])

  function addOption(option: VariableCombinationOption) {
    if (remaining <= 0) return
    setCounts(prev => ({
      ...prev,
      [option.productId]: (prev[option.productId] ?? 0) + 1,
    }))
  }

  function removeOption(productId: number) {
    setCounts(prev => {
      const current = prev[productId] ?? 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[productId]
        return next
      }
      return { ...prev, [productId]: current - 1 }
    })
  }

  function clearAll() {
    setCounts({})
  }

  function confirm() {
    if (selectedTotal !== need) return
    const picks: PosSaleCombinationSelection[] = []
    for (const option of options) {
      const quantity = counts[option.productId] ?? 0
      if (quantity <= 0) continue
      picks.push({
        productId: option.productId,
        productCode: option.productCode,
        productName: option.productName,
        quantity,
      })
    }
    onConfirm(picks)
  }

  const summaryRows: PickRow[] = options
    .filter(option => (counts[option.productId] ?? 0) > 0)
    .map(option => ({
      productId: option.productId,
      productCode: option.productCode,
      productName: option.productName,
      productGroup: (option.productGroup || '').trim(),
      quantity: counts[option.productId] ?? 0,
    }))

  return (
    <div
      className="combo-picker-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="combo-picker-title"
    >
      <button
        type="button"
        className="combo-picker-modal__backdrop"
        aria-label="Close"
        onClick={onCancel}
      />
      <div className="combo-picker-modal__card">
        <header className="combo-picker-modal__header">
          <div>
            <p className="combo-picker-modal__eyebrow">Combination</p>
            <h2 id="combo-picker-title">{productName}</h2>
            <p className="combo-picker-modal__copy">
              Choose up to {need} item{need === 1 ? '' : 's'}. Tap a product to add it.
            </p>
          </div>
          <div
            className={`combo-picker-modal__counter${selectedTotal === need ? ' is-complete' : ''}`}
            aria-live="polite"
          >
            <strong>{selectedTotal}</strong>
            <span>/ {need}</span>
          </div>
        </header>

        <div className="combo-picker-modal__body">
          {grouped.map(([group, groupOptions]) => (
            <section key={group} className="combo-picker-modal__group">
              <h3>{group}</h3>
              <div className="combo-picker-modal__grid">
                {groupOptions.map(option => {
                  const qty = counts[option.productId] ?? 0
                  const disabled = remaining <= 0 && qty === 0
                  return (
                    <div
                      key={`${option.productId}-${option.key}`}
                      className={`combo-picker-tile${qty > 0 ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                    >
                      <button
                        type="button"
                        className="combo-picker-tile__main"
                        disabled={disabled}
                        onClick={() => addOption(option)}
                        aria-label={`Add ${option.productName}`}
                      >
                        <span className="combo-picker-tile__name">
                          {option.productName || option.productCode || `#${option.productId}`}
                        </span>
                        {option.productCode ? (
                          <span className="combo-picker-tile__code">{option.productCode}</span>
                        ) : null}
                      </button>
                      <div className="combo-picker-tile__qty">
                        <button
                          type="button"
                          className="combo-picker-tile__step"
                          disabled={qty <= 0}
                          onClick={() => removeOption(option.productId)}
                          aria-label={`Remove one ${option.productName}`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{qty}</span>
                        <button
                          type="button"
                          className="combo-picker-tile__step"
                          disabled={remaining <= 0}
                          onClick={() => addOption(option)}
                          aria-label={`Add one ${option.productName}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {summaryRows.length > 0 ? (
          <div className="combo-picker-modal__summary">
            {summaryRows.map(row => (
              <span key={row.productId}>
                {row.quantity}× {row.productName}
              </span>
            ))}
          </div>
        ) : null}

        <footer className="combo-picker-modal__actions">
          <button type="button" className="combo-picker-modal__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="combo-picker-modal__btn"
            onClick={clearAll}
            disabled={selectedTotal === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="combo-picker-modal__btn combo-picker-modal__btn--primary"
            onClick={confirm}
            disabled={selectedTotal !== need}
          >
            {selectedTotal === need ? 'Add to check' : `Pick ${remaining} more`}
          </button>
        </footer>
      </div>
    </div>
  )
}
