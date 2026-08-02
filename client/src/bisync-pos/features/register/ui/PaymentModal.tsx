import { useMemo, useState } from 'react'
import { formatMoney } from '../../../core/types/money'
import { TENDER_LABEL, type TenderType } from '../../cashier/domain/payments'
import './PaymentModal.css'

type Props = {
  checkNumber: number
  tableLabel: string
  amountCents: number
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: { tender: TenderType; cashReceivedCents?: number }) => void
}

export function PaymentModal({
  checkNumber,
  tableLabel,
  amountCents,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  const [tender, setTender] = useState<TenderType>('cash')
  const [cashReceived, setCashReceived] = useState(() =>
    (amountCents / 100).toFixed(2),
  )

  const cashReceivedCents = useMemo(
    () => Math.round(Number(cashReceived || 0) * 100),
    [cashReceived],
  )
  const changeCents = Math.max(0, cashReceivedCents - amountCents)
  const cashShort = tender === 'cash' && cashReceivedCents < amountCents

  return (
    <div className="payment-modal" role="dialog" aria-modal="true" aria-label="Payment">
      <button
        type="button"
        className="payment-modal__backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="payment-modal__card">
        <header>
          <p className="payment-modal__eyebrow">Payment</p>
          <h2>Check #{checkNumber}</h2>
          <p>{tableLabel}</p>
        </header>

        <div className="payment-modal__total">
          <span>Amount due</span>
          <strong>{formatMoney(amountCents)}</strong>
        </div>

        <div className="payment-modal__tenders" role="group" aria-label="Tender">
          {(Object.keys(TENDER_LABEL) as TenderType[]).map(key => (
            <button
              key={key}
              type="button"
              className={`payment-modal__tender${tender === key ? ' is-active' : ''}`}
              disabled={busy}
              onClick={() => setTender(key)}
            >
              {TENDER_LABEL[key]}
            </button>
          ))}
        </div>

        {tender === 'cash' ? (
          <label className="payment-modal__field">
            <span>Cash received ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashReceived}
              disabled={busy}
              onChange={e => setCashReceived(e.target.value)}
            />
            <span className="payment-modal__hint">
              {cashShort
                ? `Short by ${formatMoney(amountCents - cashReceivedCents)}`
                : `Change due: ${formatMoney(changeCents)}`}
            </span>
          </label>
        ) : (
          <p className="payment-modal__copy">
            Confirm {TENDER_LABEL[tender]} for {formatMoney(amountCents)}.
          </p>
        )}

        {error ? <p className="payment-modal__error">{error}</p> : null}

        <footer>
          <button type="button" className="payment-modal__btn" disabled={busy} onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className="payment-modal__btn payment-modal__btn--pay"
            disabled={busy || cashShort}
            onClick={() =>
              onConfirm({
                tender,
                cashReceivedCents: tender === 'cash' ? cashReceivedCents : undefined,
              })
            }
          >
            {busy ? 'Processing…' : 'Take payment'}
          </button>
        </footer>
      </div>
    </div>
  )
}
