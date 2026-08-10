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
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const minSelect = Math.max(1, group.minSelect || 1)
  const maxSelect = Math.max(minSelect, group.maxSelect || 1)
  const canConfirm = selected.size >= minSelect && selected.size <= maxSelect

  function toggle(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      if (maxSelect === 1) return new Set([id])
      if (next.size >= maxSelect) return prev
      next.add(id)
      return next
    })
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
              .
            </p>
          </div>
        </header>

        <div className="combo-picker-modal__body">
          <section className="combo-picker-modal__group">
            <div className="combo-picker-modal__grid">
              {options.map(opt => {
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
                      <span className="combo-picker-tile__name">{opt.label}</span>
                      {opt.extraChargeCents > 0 ? (
                        <span className="combo-picker-tile__meta">
                          +{formatMoney(opt.extraChargeCents)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <footer className="combo-picker-modal__footer">
          <button type="button" className="combo-picker-modal__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="combo-picker-modal__btn combo-picker-modal__btn--primary"
            disabled={!canConfirm}
            onClick={() => onConfirm([...selected])}
          >
            {stepIndex + 1 < stepTotal ? 'Next' : 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  )
}
