import { useEffect, useMemo, useState } from 'react'
import type { PosConfigType } from '../../../../api'
import {
  findEntertainmentBlockedProducts,
  formatEntertainmentPurpose,
} from '../../../../data/entertainmentSettlement'
import { formatMoney } from '../../../core/types/money'
import { TENDER_LABEL, type TenderType } from '../../cashier/domain/payments'
import { formatPosCheckNumber } from '../domain/checkNumber'
import type { CartLine, Product } from '../domain/types'
import './PaymentModal.css'

export type EntertainmentPaymentPayload = {
  typeId: number
  typeCode: string
  typeName: string
  employeeName: string
  reason: string
  purpose: string
}

export type PaymentConfirmPayload = {
  tender: TenderType
  cashReceivedCents?: number
  entertainment?: EntertainmentPaymentPayload
}

type Props = {
  checkNumber: number
  tableLabel: string
  /** Amount due for normal tenders (includes tax/service). */
  amountCents: number
  /** Amount due when Entertainment is selected (no tax/service). */
  entertainmentAmountCents: number
  cartLines: CartLine[]
  catalog: Product[]
  entertainmentTypes: PosConfigType[]
  defaultEmployeeName?: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: PaymentConfirmPayload) => void
}

export function PaymentModal({
  checkNumber,
  tableLabel,
  amountCents,
  entertainmentAmountCents,
  cartLines,
  catalog,
  entertainmentTypes,
  defaultEmployeeName = '',
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  const [tender, setTender] = useState<TenderType>('cash')
  const [cashReceived, setCashReceived] = useState(() =>
    (amountCents / 100).toFixed(2),
  )
  const [entertainmentTypeId, setEntertainmentTypeId] = useState<number | null>(null)
  const [employeeName, setEmployeeName] = useState(defaultEmployeeName)
  const [reason, setReason] = useState('')

  const activeEntertainment = useMemo(
    () => entertainmentTypes.filter(t => t.active !== false),
    [entertainmentTypes],
  )

  useEffect(() => {
    if (tender !== 'entertainment') return
    if (entertainmentTypeId != null && activeEntertainment.some(t => t.id === entertainmentTypeId)) {
      return
    }
    setEntertainmentTypeId(activeEntertainment[0]?.id ?? null)
  }, [tender, activeEntertainment, entertainmentTypeId])

  useEffect(() => {
    if (defaultEmployeeName && !employeeName) {
      setEmployeeName(defaultEmployeeName)
    }
  }, [defaultEmployeeName, employeeName])

  const selectedEntertainment = useMemo(
    () => activeEntertainment.find(t => t.id === entertainmentTypeId) ?? null,
    [activeEntertainment, entertainmentTypeId],
  )

  const dueCents = tender === 'entertainment' ? entertainmentAmountCents : amountCents

  const cashReceivedCents = useMemo(
    () => Math.round(Number(cashReceived || 0) * 100),
    [cashReceived],
  )
  const changeCents = Math.max(0, cashReceivedCents - dueCents)
  const cashShort = tender === 'cash' && cashReceivedCents < dueCents

  const cartProducts = useMemo(() => {
    const byId = new Map(catalog.map(p => [String(p.id), p]))
    return cartLines
      .map(line => byId.get(String(line.productId)))
      .filter((p): p is Product => Boolean(p))
      .map(p => ({ id: p.id, name: p.name, group: p.group }))
  }, [cartLines, catalog])

  const blockedProducts = useMemo(
    () => findEntertainmentBlockedProducts(selectedEntertainment, cartProducts),
    [selectedEntertainment, cartProducts],
  )

  const entertainmentReady =
    tender !== 'entertainment'
    || (
      selectedEntertainment != null
      && employeeName.trim().length > 0
      && reason.trim().length > 0
      && blockedProducts.length === 0
    )

  function confirm() {
    if (tender === 'entertainment') {
      if (!selectedEntertainment || !entertainmentReady) return
      const purpose = formatEntertainmentPurpose(
        selectedEntertainment.code,
        employeeName,
        reason,
      )
      onConfirm({
        tender,
        entertainment: {
          typeId: selectedEntertainment.id,
          typeCode: selectedEntertainment.code,
          typeName: selectedEntertainment.name,
          employeeName: employeeName.trim(),
          reason: reason.trim(),
          purpose,
        },
      })
      return
    }
    onConfirm({
      tender,
      cashReceivedCents: tender === 'cash' ? cashReceivedCents : undefined,
    })
  }

  return (
    <div className="payment-modal" role="dialog" aria-modal="true" aria-label="Payment">
      <button
        type="button"
        className="payment-modal__backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="payment-modal__card payment-modal__card--wide">
        <header>
          <p className="payment-modal__eyebrow">Payment</p>
          <h2>Check #{formatPosCheckNumber(checkNumber)}</h2>
          <p>{tableLabel}</p>
        </header>

        <div className="payment-modal__total">
          <span>Amount due</span>
          <strong>{formatMoney(dueCents)}</strong>
        </div>
        {tender === 'entertainment' ? (
          <p className="payment-modal__hint">
            Entertainment settles the full check with no tax or service charge.
          </p>
        ) : null}

        <div className="payment-modal__tenders" role="group" aria-label="Tender">
          {(Object.keys(TENDER_LABEL) as TenderType[]).map(key => (
            <button
              key={key}
              type="button"
              className={`payment-modal__tender${tender === key ? ' is-active' : ''}`}
              disabled={busy || (key === 'entertainment' && activeEntertainment.length === 0)}
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
                ? `Short by ${formatMoney(dueCents - cashReceivedCents)}`
                : `Change due: ${formatMoney(changeCents)}`}
            </span>
          </label>
        ) : null}

        {tender === 'entertainment' ? (
          <div className="payment-modal__entertainment">
            {activeEntertainment.length === 0 ? (
              <p className="payment-modal__error">
                No active entertainment types. Add them under POS Config → Entertainment.
              </p>
            ) : (
              <>
                <label className="payment-modal__field">
                  <span>Entertainment type</span>
                  <select
                    value={entertainmentTypeId ?? ''}
                    disabled={busy}
                    onChange={e => setEntertainmentTypeId(Number(e.target.value) || null)}
                  >
                    {activeEntertainment.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="payment-modal__field">
                  <span>Employee name (required)</span>
                  <input
                    value={employeeName}
                    disabled={busy}
                    placeholder="Who is entertaining?"
                    onChange={e => setEmployeeName(e.target.value)}
                  />
                </label>
                <label className="payment-modal__field">
                  <span>Reason (required)</span>
                  <textarea
                    rows={3}
                    value={reason}
                    disabled={busy}
                    placeholder="Why is this check settled as entertainment?"
                    onChange={e => setReason(e.target.value)}
                  />
                </label>
                {blockedProducts.length > 0 ? (
                  <p className="payment-modal__error" role="alert">
                    Not allowed on {selectedEntertainment?.name || 'this type'}:{' '}
                    {blockedProducts.map(p => p.name).join(', ')}.
                    Remove them or enable Include all on the entertainment detail.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : tender !== 'cash' ? (
          <p className="payment-modal__copy">
            Confirm {TENDER_LABEL[tender]} for {formatMoney(dueCents)}.
          </p>
        ) : null}

        {error ? <p className="payment-modal__error">{error}</p> : null}

        <footer>
          <button type="button" className="payment-modal__btn" disabled={busy} onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className="payment-modal__btn payment-modal__btn--pay"
            disabled={busy || cashShort || !entertainmentReady}
            onClick={confirm}
          >
            {busy
              ? 'Processing…'
              : tender === 'entertainment'
                ? 'Settle entertainment'
                : 'Take payment'}
          </button>
        </footer>
      </div>
    </div>
  )
}
