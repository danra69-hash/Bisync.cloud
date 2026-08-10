import { useMemo, useState } from 'react'
import type { ModifierGroup } from '../../order/domain/ordering'
import './CombinationPickerModal.css'

type Props = {
  title: string
  productName: string
  groups: ModifierGroup[]
  initialSelected?: string[]
  onCancel: () => void
  onConfirm: (labels: string[]) => void
}

function countsFromIds(ids: string[]): Record<string, number> {
  const next: Record<string, number> = {}
  for (const id of ids) {
    if (!id) continue
    next[id] = (next[id] ?? 0) + 1
  }
  return next
}

export function ModifierPickerModal({
  title,
  productName,
  groups,
  initialSelected = [],
  onCancel,
  onConfirm,
}: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    countsFromIds(initialSelected),
  )

  const selectedTotal = useMemo(
    () => Object.values(counts).reduce((sum, qty) => sum + qty, 0),
    [counts],
  )

  const selectedLabels = useMemo(() => {
    const labels: string[] = []
    for (const group of groups ?? []) {
      for (const opt of group.options ?? []) {
        const qty = counts[opt.id] ?? 0
        if (qty <= 0) continue
        labels.push(qty > 1 ? `${qty}× ${opt.label}` : opt.label)
      }
    }
    return labels
  }, [groups, counts])

  function addOption(optionId: string) {
    setCounts(prev => ({
      ...prev,
      [optionId]: (prev[optionId] ?? 0) + 1,
    }))
  }

  function removeOption(optionId: string) {
    setCounts(prev => {
      const current = prev[optionId] ?? 0
      if (current <= 1) {
        const next = { ...prev }
        delete next[optionId]
        return next
      }
      return { ...prev, [optionId]: current - 1 }
    })
  }

  function reset() {
    setCounts({})
  }

  return (
    <div
      className="combo-picker-modal combo-picker-modal--compact"
      role="dialog"
      aria-modal="true"
      aria-label={title}
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
            <p className="combo-picker-modal__eyebrow">{title}</p>
            <h2>{productName}</h2>
            <p className="combo-picker-modal__copy">
              Tap an option to add it. Tap again for another of the same. Use − to reduce.
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
          {(groups ?? []).length === 0 ? (
            <p className="combo-picker-modal__copy">
              No {title.toLowerCase()} groups are attached to this product. Attach a modifier group
              under Revenue → POS Modifier Group (Category, Product Group, or Product).
            </p>
          ) : (
            <section className="combo-picker-modal__group">
              <div className="combo-picker-modal__grid">
                {(groups ?? []).flatMap(group =>
                  (group.options ?? []).map(opt => {
                    const qty = counts[opt.id] ?? 0
                    return (
                      <div
                        key={opt.id}
                        className={`combo-picker-tile${qty > 0 ? ' is-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="combo-picker-tile__main"
                          onClick={() => addOption(opt.id)}
                          aria-label={`Add ${opt.label || group.name}`}
                        >
                          <span className="combo-picker-tile__name">
                            {opt.label || group.name}
                            {qty > 0 ? (
                              <span className="combo-picker-tile__badge" aria-label={`Selected ${qty}`}>
                                {qty}
                              </span>
                            ) : null}
                          </span>
                          <span className="combo-picker-tile__code">
                            {qty > 0 ? `${qty} selected · tap for more` : 'Tap to add'}
                          </span>
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
                              onClick={() => addOption(opt.id)}
                              aria-label={`Add one ${opt.label}`}
                            >
                              +
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  }),
                )}
              </div>
            </section>
          )}
        </div>

        <div className="combo-picker-modal__summary">
          {selectedLabels.length > 0
            ? selectedLabels.map(label => <span key={label}>{label}</span>)
            : <span>No modifiers selected</span>}
        </div>

        <footer className="combo-picker-modal__actions combo-picker-modal__actions--triple">
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
            onClick={() => onConfirm(selectedLabels)}
          >
            Apply modifiers
          </button>
        </footer>
      </div>
    </div>
  )
}
