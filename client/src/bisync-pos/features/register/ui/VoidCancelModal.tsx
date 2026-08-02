import { useState } from 'react'
import './VoidCancelModal.css'

export type VoidCancelMode = 'cancel' | 'void'

type Props = {
  mode: VoidCancelMode
  productName: string
  quantity: number
  minutesSinceFire: number
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: { reason: string; authorizerPin?: string }) => void
}

export function VoidCancelModal({
  mode,
  productName,
  quantity,
  minutesSinceFire,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')

  const title = mode === 'void' ? 'Void item' : 'Cancel item'
  const ageLabel = minutesSinceFire < 1
    ? 'under 1 minute'
    : `${Math.floor(minutesSinceFire)} min since fire`

  return (
    <div className="void-cancel-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="void-cancel-modal__backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="void-cancel-modal__card">
        <header>
          <p className={`void-cancel-modal__eyebrow is-${mode}`}>
            {mode === 'void' ? 'VOID' : 'CANCEL'}
          </p>
          <h2>{title}</h2>
          <p>
            <strong>{quantity}× {productName}</strong>
            <span> · {ageLabel}</span>
          </p>
        </header>

        {mode === 'cancel' ? (
          <p className="void-cancel-modal__copy">
            Fired less than 5 minutes ago. This will be recorded as a canceled product
            (no stock-card depletion) and sent to KDS/BDS.
          </p>
        ) : (
          <p className="void-cancel-modal__copy">
            Fired 5+ minutes ago. Components will be depleted from the stock card as a void,
            and KDS/BDS will be notified. A permitted authorizer PIN is required.
          </p>
        )}

        {mode === 'void' ? (
          <>
            <label className="void-cancel-modal__field">
              <span>Reason (required)</span>
              <textarea
                rows={3}
                value={reason}
                disabled={busy}
                placeholder="Why is this item being voided?"
                onChange={e => setReason(e.target.value)}
              />
            </label>
            <label className="void-cancel-modal__field">
              <span>Authorizer PIN</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={pin}
                disabled={busy}
                placeholder="••••"
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </label>
          </>
        ) : (
          <label className="void-cancel-modal__field">
            <span>Note (optional)</span>
            <input
              value={reason}
              disabled={busy}
              placeholder="Optional cancel note"
              onChange={e => setReason(e.target.value)}
            />
          </label>
        )}

        {error ? <p className="void-cancel-modal__error">{error}</p> : null}

        <footer>
          <button type="button" className="void-cancel-modal__btn" disabled={busy} onClick={onCancel}>
            Keep item
          </button>
          <button
            type="button"
            className={`void-cancel-modal__btn void-cancel-modal__btn--${mode}`}
            disabled={busy || (mode === 'void' && (!reason.trim() || pin.length !== 4))}
            onClick={() => onConfirm({
              reason: reason.trim(),
              authorizerPin: mode === 'void' ? pin : undefined,
            })}
          >
            {busy ? 'Working…' : mode === 'void' ? 'Confirm void' : 'Confirm cancel'}
          </button>
        </footer>
      </div>
    </div>
  )
}
