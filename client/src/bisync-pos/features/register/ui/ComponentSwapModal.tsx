import { useMemo, useState } from 'react'
import type { VariableComponentSlot } from '../../../../data/productVariableComponent'
import type { PosSaleReplacementSelection } from '../domain/saleDetail'
import '../ui/CombinationPickerModal.css'

type Props = {
  productName: string
  slots: VariableComponentSlot[]
  initialSelections?: PosSaleReplacementSelection[]
  onCancel: () => void
  onConfirm: (selections: PosSaleReplacementSelection[]) => void
}

/** Per-slot choice: -1 = base, >=0 = alternative index. */
function initialChoices(
  slots: VariableComponentSlot[],
  initial?: PosSaleReplacementSelection[],
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const slot of slots) {
    map[slot.baseComponentId] = -1
    const prior = initial?.find(s => s.baseComponentId === slot.baseComponentId)
    if (!prior) continue
    if (prior.chosenComponentId === slot.baseComponentId) {
      map[slot.baseComponentId] = -1
      continue
    }
    const idx = slot.alternatives.findIndex(a => a.componentId === prior.chosenComponentId)
    map[slot.baseComponentId] = idx >= 0 ? idx : -1
  }
  return map
}

export function ComponentSwapModal({
  productName,
  slots,
  initialSelections,
  onCancel,
  onConfirm,
}: Props) {
  const [choices, setChoices] = useState(() => initialChoices(slots, initialSelections))

  const extraTotal = useMemo(() => {
    let sum = 0
    for (const slot of slots) {
      const idx = choices[slot.baseComponentId] ?? -1
      if (idx < 0) continue
      const alt = slot.alternatives[idx]
      if (alt) sum += Math.max(0, alt.extraCharge || 0)
    }
    return Math.round(sum * 100) / 100
  }, [choices, slots])

  function confirm() {
    const selections: PosSaleReplacementSelection[] = slots.map(slot => {
      const idx = choices[slot.baseComponentId] ?? -1
      if (idx < 0) {
        return {
          baseComponentId: slot.baseComponentId,
          baseComponentName: slot.baseComponentName,
          chosenComponentId: slot.baseComponentId,
          chosenComponentName: slot.baseComponentName,
          componentUom: slot.baseComponentUom,
          quantity: slot.quantity > 0 ? slot.quantity : 1,
          extraCharge: 0,
        }
      }
      const alt = slot.alternatives[idx]!
      return {
        baseComponentId: slot.baseComponentId,
        baseComponentName: slot.baseComponentName,
        chosenComponentId: alt.componentId,
        chosenComponentName: alt.componentName,
        componentUom: alt.componentUom || slot.baseComponentUom,
        quantity: alt.quantity > 0 ? alt.quantity : (slot.quantity > 0 ? slot.quantity : 1),
        extraCharge: Math.max(0, alt.extraCharge || 0),
      }
    })
    onConfirm(selections)
  }

  return (
    <div className="combo-picker-modal" role="dialog" aria-modal="true" aria-label="Swap components">
      <button type="button" className="combo-picker-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="combo-picker-modal__card">
        <div className="combo-picker-modal__header">
          <div>
            <p className="combo-picker-modal__eyebrow">Variable Component · SWAP</p>
            <h2>{productName}</h2>
            <p className="combo-picker-modal__hint">
              Choose what the customer ordered for each swappable component.
            </p>
          </div>
          <button type="button" className="combo-picker-modal__close" onClick={onCancel} aria-label="Cancel">
            ×
          </button>
        </div>

        <div className="combo-picker-modal__body" style={{ overflowY: 'auto', maxHeight: '55vh' }}>
          {slots.map(slot => {
            const selected = choices[slot.baseComponentId] ?? -1
            return (
              <div key={slot.baseComponentId} style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.85rem' }}>
                  {slot.slotLabel || slot.baseComponentName}
                </p>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: selected === -1 ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #d8dee8)',
                      background: selected === -1 ? 'rgba(37,99,235,0.06)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    <input
                      type="radio"
                      name={`swap-${slot.baseComponentId}`}
                      checked={selected === -1}
                      onChange={() => setChoices(prev => ({ ...prev, [slot.baseComponentId]: -1 }))}
                    />
                    <span>
                      {slot.baseComponentName}
                      <span style={{ color: 'var(--color-ink-muted, #667085)' }}> · base · no extra</span>
                    </span>
                  </label>
                  {slot.alternatives.map((alt, idx) => (
                    <label
                      key={alt.componentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: selected === idx ? '1px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #d8dee8)',
                        background: selected === idx ? 'rgba(37,99,235,0.06)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      <input
                        type="radio"
                        name={`swap-${slot.baseComponentId}`}
                        checked={selected === idx}
                        onChange={() => setChoices(prev => ({ ...prev, [slot.baseComponentId]: idx }))}
                      />
                      <span>
                        {alt.componentName}
                        <span style={{ color: 'var(--color-ink-muted, #667085)' }}>
                          {alt.extraCharge > 0
                            ? ` · +${alt.extraCharge.toFixed(2)}`
                            : ' · no extra'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="combo-picker-modal__footer">
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-ink-muted, #667085)' }}>
            Extra charge total: <strong>{extraTotal > 0 ? `+${extraTotal.toFixed(2)}` : 'none'}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button type="button" className="combo-picker-modal__secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="combo-picker-modal__primary" onClick={confirm}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
