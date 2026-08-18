import { useMemo, useState } from 'react'
import type { PosModifierGroup } from '../../../../api'
import { formatMoney } from '../../../core/types/money'
import './CombinationPickerModal.css'

type Props = {
  productName: string
  group: PosModifierGroup
  stepIndex: number
  stepTotal: number
  onCancel: () => void
  /** Option ids in selection order; the same id may appear more than once for qty. */
  onConfirm: (selectedOptionIds: number[]) => void
}

export function CompulsoryModifierModal({
  productName,
  group,
  stepIndex,
  stepTotal,
  onCancel,
  onConfirm,
}: Props) {
  const options = useMemo(
    () =>
      (group?.options ?? [])
        .filter(o => o && o.active !== false)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [group?.options],
  )
  const [counts, setCounts] = useState<Record<number, number>>({})
  const minSelect = Math.max(1, group.minSelect || 1)
  const maxSelect = Math.max(minSelect, group.maxSelect || 1)
  const selectedTotal = useMemo(
    () => Object.values(counts).reduce((sum, qty) => sum + qty, 0),
    [counts],
  )
  const remaining = Math.max(0, maxSelect - selectedTotal)
  const canConfirm = selectedTotal >= minSelect && selectedTotal <= maxSelect

  function addOption(id: number) {
    setCounts(prev => {
      const total = Object.values(prev).reduce((sum, qty) => sum + qty, 0)
      if (maxSelect === 1) return { [id]: 1 }
      if (total >= maxSelect) return prev
      return { ...prev, [id]: (prev[id] ?? 0) + 1 }
    })
  }

  function removeOption(id: number) {
    setCounts(prev => {
      const current = prev[id] ?? 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: current - 1 }
    })
  }

  function reset() {
    setCounts({})
  }

  function confirm() {
    if (!canConfirm) return
    const ids: number[] = []
    for (const opt of options) {
      const qty = counts[opt.id] ?? 0
      for (let i = 0; i < qty; i++) ids.push(opt.id)
    }
    onConfirm(ids)
  }

  return (
    <div
      className="combo-picker-modal combo-picker-modal--compact"
      role="dialog"
      aria-modal="true"
      aria-label="Compulsory modifier"
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
            <p className="combo-picker-modal__eyebrow">
              Compulsory · {stepIndex + 1} of {stepTotal}
            </p>
            <h2>{group.name}</h2>
            <p className="combo-picker-modal__copy">
              Select for <strong>{productName}</strong> before continuing
              {minSelect === maxSelect
                ? ` (choose ${minSelect})`
                : ` (choose ${minSelect}–${maxSelect})`}
              . Tap again for another of the same option.
            </p>
          </div>
          <button
            type="button"
            className="combo-picker-modal__close"
            aria-label="Close"
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <div className="combo-picker-modal__body">
          <section className="combo-picker-modal__group">
            <div className="combo-picker-modal__grid">
              {options.map(opt => {
                const qty = counts[opt.id] ?? 0
                const disabled = remaining <= 0 && qty === 0 && maxSelect > 1
                return (
                  <div
                    key={opt.id}
                    className={`combo-picker-tile${qty > 0 ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                  >
                    <button
                      type="button"
                      className="combo-picker-tile__main"
                      disabled={disabled}
                      onClick={() => addOption(opt.id)}
                      aria-label={`Add ${opt.label}`}
                    >
                      <span className="combo-picker-tile__name">
                        {opt.label}
                        {qty > 0 ? (
                          <span className="combo-picker-tile__badge" aria-label={`Selected ${qty}`}>
                            {qty}
                          </span>
                        ) : null}
                      </span>
                      {opt.extraChargeCents > 0 ? (
                        <span className="combo-picker-tile__meta">
                          +{formatMoney(opt.extraChargeCents)}
                          {qty > 1 ? ` each` : ''}
                        </span>
                      ) : (
                        <span className="combo-picker-tile__code">
                          {qty > 0 ? `${qty} selected · tap for more` : 'Tap to add'}
                        </span>
                      )}
                    </button>
                    {qty > 0 ? (
                      <div className="combo-picker-tile__qty">
                        <button
                          type="button"
                          className="combo-picker-tile__step"
                          onClick={() => removeOption(opt.id)}
                          aria-label={`Remove one ${opt.label}`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{qty}</span>
                        <button
                          type="button"
                          className="combo-picker-tile__step"
                          disabled={remaining <= 0 && maxSelect > 1}
                          onClick={() => addOption(opt.id)}
                          aria-label={`Add one ${opt.label}`}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <footer className="combo-picker-modal__footer combo-picker-modal__actions--triple">
          <button type="button" className="combo-picker-modal__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="combo-picker-modal__btn"
            onClick={reset}
            disabled={selectedTotal === 0}
          >
            Reset
          </button>
          <button
            type="button"
            className="combo-picker-modal__btn combo-picker-modal__btn--primary"
            disabled={!canConfirm}
            onClick={confirm}
          >
            {stepIndex + 1 < stepTotal ? 'Next' : 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  )
}
