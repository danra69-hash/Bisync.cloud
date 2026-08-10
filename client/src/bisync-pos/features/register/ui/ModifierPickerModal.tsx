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

export function ModifierPickerModal({
  title,
  productName,
  groups,
  initialSelected = [],
  onCancel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  )

  const selectedLabels = useMemo(() => {
    const labels: string[] = []
    for (const group of groups ?? []) {
      for (const opt of group.options ?? []) {
        if (selected.has(opt.id)) labels.push(opt.label)
      }
    }
    return labels
  }, [groups, selected])

  function toggle(optionId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
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
              Tick modifiers for this item. They are saved on the order line note for kitchen.
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
                    const checked = selected.has(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`combo-picker-tile${checked ? ' is-selected' : ''}`}
                        aria-pressed={checked}
                        onClick={() => toggle(opt.id)}
                      >
                        <span className="combo-picker-tile__main">
                          <span className="combo-picker-tile__name">{opt.label || group.name}</span>
                          <span className="combo-picker-tile__code">
                            {checked ? 'Selected' : 'Tap to add'}
                          </span>
                        </span>
                      </button>
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

        <footer className="combo-picker-modal__actions">
          <button type="button" className="combo-picker-modal__btn" onClick={onCancel}>
            Cancel
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
