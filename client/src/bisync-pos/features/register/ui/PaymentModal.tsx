import { useEffect, useMemo, useState } from 'react'
import type { PosConfigType } from '../../../../api'
import {
  findEntertainmentBlockedProducts,
  formatEntertainmentPurpose,
  hasPosConfigExceptions,
} from '../../../../data/entertainmentSettlement'
import { formatMoney } from '../../../core/types/money'
import {
  DEFAULT_PAYMENT_TENDERS,
  paymentMethodForApi,
  paymentTenderBehavior,
  paymentTenderKey,
  paymentTypeLabel,
  TENDER_LABEL,
  type TenderType,
} from '../../cashier/domain/payments'
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
  /** Behavioral / storage tender key (normalized code). */
  tender: TenderType
  /** POS Config payment type code when selected from config. */
  paymentTypeCode?: string
  /** Display name from POS Config (or built-in label). */
  paymentTypeName?: string
  cashReceivedCents?: number
  entertainment?: EntertainmentPaymentPayload
}

type TenderOption = {
  key: string
  code: string
  name: string
  behavior: 'cash' | 'entertainment' | 'other'
  fromConfig: boolean
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
  /** Active POS Config payment types (kind=payment). */
  paymentTypes?: PosConfigType[]
  entertainmentTypes: PosConfigType[]
  defaultEmployeeName?: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: PaymentConfirmPayload) => void
}

function buildTenderOptions(
  paymentTypes: PosConfigType[],
  entertainmentTypes: PosConfigType[],
): TenderOption[] {
  const activePayments = paymentTypes
    .filter(t => t.active !== false)
    .slice()
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))

  const options: TenderOption[] = []
  if (activePayments.length > 0) {
    for (const row of activePayments) {
      const code = (row.code || '').trim() || suggestCodeFromName(row.name)
      const key = paymentTenderKey(code)
      if (options.some(o => o.key === key)) continue
      options.push({
        key,
        code: code || key.toUpperCase(),
        name: paymentTypeLabel(code, row.name),
        behavior: paymentTenderBehavior(code),
        fromConfig: true,
      })
    }
  } else {
    for (const row of DEFAULT_PAYMENT_TENDERS) {
      options.push({
        key: paymentTenderKey(row.code),
        code: row.code,
        name: row.name,
        behavior: paymentTenderBehavior(row.code),
        fromConfig: false,
      })
    }
  }

  const hasEntertainmentOption = options.some(o => o.behavior === 'entertainment')
  const activeEntertainment = entertainmentTypes.filter(t => t.active !== false)
  if (!hasEntertainmentOption && activeEntertainment.length > 0) {
    options.push({
      key: 'entertainment',
      code: 'ENTERTAINMENT',
      name: TENDER_LABEL.entertainment,
      behavior: 'entertainment',
      fromConfig: false,
    })
  }

  return options
}

function suggestCodeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function PaymentModal({
  checkNumber,
  tableLabel,
  amountCents,
  entertainmentAmountCents,
  cartLines,
  catalog,
  paymentTypes = [],
  entertainmentTypes,
  defaultEmployeeName = '',
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: Props) {
  const tenderOptions = useMemo(
    () => buildTenderOptions(paymentTypes, entertainmentTypes),
    [paymentTypes, entertainmentTypes],
  )

  const [tenderKey, setTenderKey] = useState(() => tenderOptions[0]?.key ?? 'cash')
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

  const selectedTender = useMemo(
    () => tenderOptions.find(o => o.key === tenderKey) ?? tenderOptions[0] ?? null,
    [tenderOptions, tenderKey],
  )

  const behavior = selectedTender?.behavior ?? 'other'

  useEffect(() => {
    if (tenderOptions.some(o => o.key === tenderKey)) return
    setTenderKey(tenderOptions[0]?.key ?? 'cash')
  }, [tenderOptions, tenderKey])

  useEffect(() => {
    if (behavior !== 'entertainment') return
    if (entertainmentTypeId != null && activeEntertainment.some(t => t.id === entertainmentTypeId)) {
      return
    }
    setEntertainmentTypeId(activeEntertainment[0]?.id ?? null)
  }, [behavior, activeEntertainment, entertainmentTypeId])

  useEffect(() => {
    if (defaultEmployeeName && !employeeName) {
      setEmployeeName(defaultEmployeeName)
    }
  }, [defaultEmployeeName, employeeName])

  const selectedEntertainment = useMemo(
    () => activeEntertainment.find(t => t.id === entertainmentTypeId) ?? null,
    [activeEntertainment, entertainmentTypeId],
  )

  const dueCents = behavior === 'entertainment' ? entertainmentAmountCents : amountCents

  const cashReceivedCents = useMemo(
    () => Math.round(Number(cashReceived || 0) * 100),
    [cashReceived],
  )
  const changeCents = Math.max(0, cashReceivedCents - dueCents)
  const cashShort = behavior === 'cash' && cashReceivedCents < dueCents

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
    behavior !== 'entertainment'
    || (
      selectedEntertainment != null
      && hasPosConfigExceptions(selectedEntertainment)
      && employeeName.trim().length > 0
      && reason.trim().length > 0
      && blockedProducts.length === 0
    )

  function confirm() {
    if (!selectedTender) return
    if (behavior === 'entertainment') {
      if (!selectedEntertainment || !entertainmentReady) return
      const purpose = formatEntertainmentPurpose(
        selectedEntertainment.code,
        employeeName,
        reason,
      )
      onConfirm({
        tender: 'entertainment',
        paymentTypeCode: selectedTender.code,
        paymentTypeName: selectedEntertainment.name,
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
      tender: paymentMethodForApi(selectedTender.code) as TenderType,
      paymentTypeCode: selectedTender.code,
      paymentTypeName: selectedTender.name,
      cashReceivedCents: behavior === 'cash' ? cashReceivedCents : undefined,
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
        {behavior === 'entertainment' ? (
          <p className="payment-modal__hint">
            Entertainment settles the full check with no tax or service charge.
          </p>
        ) : null}

        <div className="payment-modal__tenders" role="group" aria-label="Tender">
          {tenderOptions.length === 0 ? (
            <p className="payment-modal__error">
              No payment types configured. Add them under POS Config → Payment Type.
            </p>
          ) : (
            tenderOptions.map(opt => (
              <button
                key={opt.key}
                type="button"
                className={`payment-modal__tender${tenderKey === opt.key ? ' is-active' : ''}`}
                disabled={
                  busy
                  || (opt.behavior === 'entertainment' && activeEntertainment.length === 0)
                }
                onClick={() => setTenderKey(opt.key)}
              >
                {opt.name}
              </button>
            ))
          )}
        </div>

        {behavior === 'cash' ? (
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

        {behavior === 'entertainment' ? (
          <div className="payment-modal__entertainment">
            {activeEntertainment.length === 0 ? (
              <p className="payment-modal__error">
                No active entertainment types. Add them under POS Config → Entertainment Type.
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
                {selectedEntertainment && !hasPosConfigExceptions(selectedEntertainment) ? (
                  <p className="payment-modal__error" role="alert">
                    {selectedEntertainment.name} has no exceptions configured. Edit it under
                    POS Config → Entertainment Type and tick at least one Product Group or Product
                    exception.
                  </p>
                ) : null}
                {blockedProducts.length > 0 ? (
                  <p className="payment-modal__error" role="alert">
                    Not allowed on {selectedEntertainment?.name || 'this type'}:{' '}
                    {blockedProducts.map(p => p.name).join(', ')}.
                    Remove excepted products from the check, or edit exceptions on the
                    entertainment type.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : behavior !== 'cash' ? (
          <p className="payment-modal__copy">
            Confirm {selectedTender?.name || 'payment'} for {formatMoney(dueCents)}.
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
            disabled={busy || cashShort || !entertainmentReady || tenderOptions.length === 0}
            onClick={confirm}
          >
            {busy
              ? 'Processing…'
              : behavior === 'entertainment'
                ? 'Settle entertainment'
                : 'Take payment'}
          </button>
        </footer>
      </div>
    </div>
  )
}
