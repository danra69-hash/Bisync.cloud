import { useEffect, useMemo, useRef, useState } from 'react'
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
  remainingAfterPayments,
  TENDER_LABEL,
  type PaymentLine,
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
  /** Behavioral / storage tender key (normalized code) — primary / first line. */
  tender: TenderType
  /** POS Config payment type code when selected from config. */
  paymentTypeCode?: string
  /** Display name from POS Config (or built-in label). */
  paymentTypeName?: string
  cashReceivedCents?: number
  /** Guest count required at payment time. */
  covers: number
  entertainment?: EntertainmentPaymentPayload
  /** Multi-tender lines when split pay is used (or a single full payment). */
  payments?: PaymentLine[]
}

type TenderOption = {
  key: string
  code: string
  name: string
  behavior: 'cash' | 'entertainment' | 'other'
  fromConfig: boolean
}

type AppliedLine = PaymentLine & {
  id: string
  behavior: 'cash' | 'entertainment' | 'other'
}

type KeypadTarget = 'pax' | 'amount'

type Props = {
  checkNumber: number
  tableLabel: string
  /** Amount due for normal tenders (includes tax/service). */
  amountCents: number
  /** Amount due when Entertainment is selected (no tax/service). */
  entertainmentAmountCents: number
  /** Pre-filled covers from the register / floor (staff must still confirm ≥ 1). */
  initialCovers?: number
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

const MONEY_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const
const PAX_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

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

function moneyToCents(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function centsToMoneyInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2)
}

function appendMoneyKey(current: string, key: (typeof MONEY_KEYS)[number]): string {
  if (key === '⌫') return current.slice(0, -1)
  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : `${current}.`
  }
  // Prefill is often "12.50" — a complete 2-decimal value. Typing another digit
  // must start a new entry; otherwise the keypad appears broken for split pay.
  if (current.includes('.')) {
    const frac = current.split('.')[1] ?? ''
    if (frac.length >= 2) return key
  }
  if (current === '0') return key
  if (current.replace('.', '').length >= 9) return current
  return `${current}${key}`
}

function appendPaxKey(current: string, key: (typeof PAX_KEYS)[number]): string {
  if (key === 'C') return ''
  if (key === '⌫') return current.slice(0, -1)
  const next = `${current === '0' ? '' : current}${key}`
  if (next.length > 2) return current
  const n = Number(next)
  if (!Number.isFinite(n) || n > 99) return current
  return next
}

function newLineId(): string {
  return `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function PaymentModal({
  checkNumber,
  tableLabel,
  amountCents,
  entertainmentAmountCents,
  initialCovers = 0,
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

  const [tenderKey, setTenderKey] = useState(() => {
    const first = tenderOptions.find(o => o.behavior !== 'entertainment') ?? tenderOptions[0]
    return first?.key ?? 'cash'
  })
  const [splitMode, setSplitMode] = useState(false)
  const [applied, setApplied] = useState<AppliedLine[]>([])
  const [paxDigits, setPaxDigits] = useState('')
  const [amountDigits, setAmountDigits] = useState(() => centsToMoneyInput(amountCents))
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget>('pax')
  const [entertainmentTypeId, setEntertainmentTypeId] = useState<number | null>(null)
  const [employeeName, setEmployeeName] = useState(defaultEmployeeName)
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  // Offer the register cover as a one-tap hint without auto-accepting it.
  const suggestedCovers =
    initialCovers > 0 ? Math.min(99, Math.floor(initialCovers)) : 0

  const activeEntertainment = useMemo(
    () => entertainmentTypes.filter(t => t.active !== false),
    [entertainmentTypes],
  )

  const selectedTender = useMemo(
    () => tenderOptions.find(o => o.key === tenderKey) ?? tenderOptions[0] ?? null,
    [tenderOptions, tenderKey],
  )

  const behavior = selectedTender?.behavior ?? 'other'
  const covers = Math.floor(Number(paxDigits) || 0)
  const paxReady = covers >= 1

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

  useEffect(() => {
    if (splitMode && behavior === 'entertainment') {
      const fallback = tenderOptions.find(o => o.behavior !== 'entertainment')
      if (fallback) setTenderKey(fallback.key)
    }
  }, [splitMode, behavior, tenderOptions])

  const selectedEntertainment = useMemo(
    () => activeEntertainment.find(t => t.id === entertainmentTypeId) ?? null,
    [activeEntertainment, entertainmentTypeId],
  )

  const dueCents = !splitMode && behavior === 'entertainment'
    ? entertainmentAmountCents
    : amountCents

  const paidCents = useMemo(
    () => applied.reduce((sum, line) => sum + line.amountCents, 0),
    [applied],
  )
  const remainingCents = remainingAfterPayments(dueCents, applied)
  const seededAmountKeyRef = useRef('')

  // Reseed amount when mode / remaining / due changes. Digit entry on a complete
  // "12.50" value starts a new amount (see appendMoneyKey). Skip reseed when the
  // seed key is unchanged so Strict Mode / tender re-renders do not wipe typing.
  useEffect(() => {
    const seedKey = splitMode
      ? `split:${remainingCents}`
      : behavior === 'cash'
        ? `cash:${dueCents}`
        : `full:${dueCents}:${behavior}`
    if (seededAmountKeyRef.current === seedKey) return
    seededAmountKeyRef.current = seedKey
    if (splitMode) {
      setAmountDigits(centsToMoneyInput(remainingCents > 0 ? remainingCents : 0))
      return
    }
    if (behavior === 'cash') {
      setAmountDigits(centsToMoneyInput(dueCents))
    }
  }, [splitMode, remainingCents, dueCents, behavior])

  const amountEntryCents = moneyToCents(amountDigits)
  const cashChangeCents = behavior === 'cash' && !splitMode
    ? Math.max(0, amountEntryCents - dueCents)
    : behavior === 'cash' && splitMode
      ? Math.max(0, amountEntryCents - remainingCents)
      : 0
  const cashShort = behavior === 'cash' && !splitMode && amountEntryCents < dueCents
  const splitApplyPreviewCents = behavior === 'cash'
    ? Math.min(Math.max(0, amountEntryCents), remainingCents)
    : Math.max(0, Math.min(amountEntryCents, remainingCents))

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

  const splitComplete = !splitMode || remainingCents === 0
  const needsAmountKeypad =
    (behavior === 'cash' || splitMode) && behavior !== 'entertainment'
  const showAmountKeypad = keypadTarget === 'amount' && needsAmountKeypad

  function selectTender(key: string) {
    setLocalError(null)
    setTenderKey(key)
    if (covers >= 1) setKeypadTarget('amount')
  }

  function setPayMode(split: boolean) {
    setLocalError(null)
    setSplitMode(split)
    setApplied([])
    seededAmountKeyRef.current = ''
    if (split && behavior === 'entertainment') {
      const fallback = tenderOptions.find(o => o.behavior !== 'entertainment')
      if (fallback) setTenderKey(fallback.key)
    }
    // Prefer amount keypad once pax is known; otherwise keep collecting pax first.
    setKeypadTarget(covers >= 1 && (split || behavior === 'cash') ? 'amount' : 'pax')
  }

  function addSplitPayment() {
    if (!selectedTender || busy) return
    if (behavior === 'entertainment') {
      setLocalError('Entertainment cannot be used in split pay. Settle the full check instead.')
      return
    }
    if (remainingCents <= 0) {
      setLocalError('Check is already fully covered.')
      return
    }
    let applyCents = amountEntryCents
    if (behavior === 'cash') {
      if (applyCents <= 0) {
        setLocalError('Enter cash received on the keypad.')
        setKeypadTarget('amount')
        return
      }
      applyCents = Math.min(applyCents, remainingCents)
    } else {
      if (applyCents <= 0) {
        setLocalError('Enter an amount on the keypad.')
        setKeypadTarget('amount')
        return
      }
      if (applyCents > remainingCents) {
        setLocalError(`Amount cannot exceed remaining ${formatMoney(remainingCents)}.`)
        setKeypadTarget('amount')
        return
      }
    }
    setApplied(prev => [
      ...prev,
      {
        id: newLineId(),
        tender: paymentMethodForApi(selectedTender.code) as TenderType,
        paymentTypeCode: selectedTender.code,
        paymentTypeName: selectedTender.name,
        amountCents: applyCents,
        behavior,
      },
    ])
    setLocalError(null)
    setKeypadTarget('amount')
  }

  function removeSplitPayment(id: string) {
    setApplied(prev => prev.filter(line => line.id !== id))
    setLocalError(null)
  }

  function confirm() {
    setLocalError(null)
    if (!paxReady) {
      setLocalError('Enter number of pax before accepting payment.')
      setKeypadTarget('pax')
      return
    }
    if (!selectedTender) return

    if (splitMode) {
      if (applied.length === 0 || remainingCents > 0) {
        setLocalError(
          remainingCents > 0
            ? `Add tenders until remaining is ${formatMoney(0)} (still ${formatMoney(remainingCents)}).`
            : 'Add at least one tender for split pay.',
        )
        return
      }
      const first = applied[0]
      onConfirm({
        tender: first.tender,
        paymentTypeCode: first.paymentTypeCode,
        paymentTypeName: first.paymentTypeName,
        covers,
        cashReceivedCents: applied.some(l => l.behavior === 'cash')
          ? applied.filter(l => l.behavior === 'cash').reduce((s, l) => s + l.amountCents, 0)
          : undefined,
        payments: applied.map(line => ({
          tender: line.tender,
          paymentTypeCode: line.paymentTypeCode,
          paymentTypeName: line.paymentTypeName,
          amountCents: line.amountCents,
        })),
      })
      return
    }

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
        covers,
        entertainment: {
          typeId: selectedEntertainment.id,
          typeCode: selectedEntertainment.code,
          typeName: selectedEntertainment.name,
          employeeName: employeeName.trim(),
          reason: reason.trim(),
          purpose,
        },
        payments: [{
          tender: 'entertainment',
          paymentTypeCode: selectedTender.code,
          paymentTypeName: selectedEntertainment.name,
          amountCents: dueCents,
        }],
      })
      return
    }

    if (behavior === 'cash' && cashShort) return

    const payCents = dueCents
    onConfirm({
      tender: paymentMethodForApi(selectedTender.code) as TenderType,
      paymentTypeCode: selectedTender.code,
      paymentTypeName: selectedTender.name,
      cashReceivedCents: behavior === 'cash' ? amountEntryCents : undefined,
      covers,
      payments: [{
        tender: paymentMethodForApi(selectedTender.code) as TenderType,
        paymentTypeCode: selectedTender.code,
        paymentTypeName: selectedTender.name,
        amountCents: payCents,
      }],
    })
  }

  const displayError = localError || error
  const canConfirm =
    paxReady
    && tenderOptions.length > 0
    && entertainmentReady
    && !cashShort
    && splitComplete
    && !busy

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

        <div className="payment-modal__pax-row">
          <button
            type="button"
            className={`payment-modal__pax${keypadTarget === 'pax' ? ' is-active' : ''}${!paxReady ? ' is-required' : ''}`}
            disabled={busy}
            onClick={() => setKeypadTarget('pax')}
          >
            <span>Pax (required)</span>
            <strong>{paxDigits || '—'}</strong>
          </button>
          <div className="payment-modal__total">
            <span>{splitMode ? 'Remaining' : 'Amount due'}</span>
            <strong>{formatMoney(splitMode ? remainingCents : dueCents)}</strong>
          </div>
        </div>
        {!paxReady ? (
          <p className="payment-modal__error" role="alert">
            Enter number of pax before accepting payment.
            {suggestedCovers > 0 ? (
              <>
                {' '}
                <button
                  type="button"
                  className="payment-modal__pax-suggest"
                  disabled={busy}
                  onClick={() => {
                    setPaxDigits(String(suggestedCovers))
                    setKeypadTarget('amount')
                    setLocalError(null)
                  }}
                >
                  Use {suggestedCovers} from order
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        {behavior === 'entertainment' && !splitMode ? (
          <p className="payment-modal__hint">
            Entertainment settles the full check with no tax or service charge.
          </p>
        ) : null}

        <div className="payment-modal__modes" role="group" aria-label="Payment mode">
          <button
            type="button"
            className={`payment-modal__mode${!splitMode ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => setPayMode(false)}
          >
            Pay in full
          </button>
          <button
            type="button"
            className={`payment-modal__mode${splitMode ? ' is-active' : ''}`}
            disabled={busy || behavior === 'entertainment'}
            onClick={() => setPayMode(true)}
          >
            Split pay
          </button>
        </div>

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
                  || (opt.behavior === 'entertainment' && (activeEntertainment.length === 0 || splitMode))
                }
                onClick={() => selectTender(opt.key)}
              >
                {opt.name}
              </button>
            ))
          )}
        </div>

        {(behavior === 'cash' || splitMode) && behavior !== 'entertainment' ? (
          <button
            type="button"
            className={`payment-modal__amount-display${keypadTarget === 'amount' ? ' is-active' : ''}`}
            disabled={busy}
            onClick={() => setKeypadTarget('amount')}
          >
            <span>{behavior === 'cash' ? 'Cash received ($)' : 'Tender amount ($)'}</span>
            <strong>{amountDigits || '0'}</strong>
            {behavior === 'cash' ? (
              <em className="payment-modal__hint">
                {cashShort && !splitMode
                  ? `Short by ${formatMoney(dueCents - amountEntryCents)}`
                  : cashChangeCents > 0
                    ? `Change due: ${formatMoney(cashChangeCents)}`
                    : splitMode
                      ? `Applies ${formatMoney(splitApplyPreviewCents)} to check`
                      : 'Exact amount · tap a digit to replace'}
              </em>
            ) : (
              <em className="payment-modal__hint">
                {splitMode
                  ? `Will add ${formatMoney(splitApplyPreviewCents)} · remaining ${formatMoney(remainingCents)}`
                  : `Remaining ${formatMoney(remainingCents)}`}
              </em>
            )}
          </button>
        ) : null}

        {splitMode && behavior !== 'entertainment' ? (
          <button
            type="button"
            className="payment-modal__btn payment-modal__btn--add-tender"
            disabled={busy || remainingCents <= 0 || splitApplyPreviewCents <= 0}
            onClick={() => {
              setKeypadTarget('amount')
              addSplitPayment()
            }}
          >
            {remainingCents <= 0
              ? 'Check fully covered'
              : `Add ${selectedTender?.name || 'tender'} · ${formatMoney(splitApplyPreviewCents)}`}
          </button>
        ) : null}

        {keypadTarget === 'pax' ? (
          <div className="payment-modal__keypad" role="group" aria-label="Pax keypad">
            {PAX_KEYS.map(key => (
              <button
                key={key}
                type="button"
                className={`payment-modal__key${key === 'C' || key === '⌫' ? ' is-action' : ''}`}
                disabled={busy}
                onClick={() => {
                  setLocalError(null)
                  setPaxDigits(prev => {
                    const next = appendPaxKey(prev, key)
                    if (Math.floor(Number(next) || 0) >= 1 && needsAmountKeypad) {
                      setKeypadTarget('amount')
                    }
                    return next
                  })
                }}
              >
                {key}
              </button>
            ))}
          </div>
        ) : null}

        {showAmountKeypad ? (
          <div className="payment-modal__keypad" role="group" aria-label="Amount keypad">
            {MONEY_KEYS.map(key => (
              <button
                key={key}
                type="button"
                className={`payment-modal__key${key === '⌫' || key === '.' ? ' is-action' : ''}`}
                disabled={busy}
                onClick={() => {
                  setLocalError(null)
                  setAmountDigits(prev => appendMoneyKey(prev, key))
                }}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className="payment-modal__key payment-modal__key--wide is-action"
              disabled={busy}
              onClick={() => {
                setLocalError(null)
                setAmountDigits('')
              }}
            >
              Clear
            </button>
          </div>
        ) : null}

        {splitMode && applied.length > 0 ? (
          <ul className="payment-modal__split-list">
            {applied.map(line => (
              <li key={line.id}>
                <span>{line.paymentTypeName || line.tender}</span>
                <strong>{formatMoney(line.amountCents)}</strong>
                <button
                  type="button"
                  className="payment-modal__split-remove"
                  disabled={busy}
                  aria-label={`Remove ${line.paymentTypeName || line.tender}`}
                  onClick={() => removeSplitPayment(line.id)}
                >
                  ×
                </button>
              </li>
            ))}
            <li className="payment-modal__split-summary">
              <span>Paid / Due</span>
              <strong>{formatMoney(paidCents)} / {formatMoney(dueCents)}</strong>
            </li>
          </ul>
        ) : null}

        {behavior === 'entertainment' && !splitMode ? (
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
        ) : behavior !== 'cash' && !splitMode ? (
          <p className="payment-modal__copy">
            Confirm {selectedTender?.name || 'payment'} for {formatMoney(dueCents)}.
          </p>
        ) : null}

        {displayError ? <p className="payment-modal__error">{displayError}</p> : null}

        <footer>
          <button type="button" className="payment-modal__btn" disabled={busy} onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className="payment-modal__btn payment-modal__btn--pay"
            disabled={!canConfirm}
            onClick={confirm}
          >
            {busy
              ? 'Processing…'
              : behavior === 'entertainment' && !splitMode
                ? 'Settle entertainment'
                : splitMode
                  ? remainingCents > 0
                    ? `Remaining ${formatMoney(remainingCents)}`
                    : 'Take split payment'
                  : 'Take payment'}
          </button>
        </footer>
      </div>
    </div>
  )
}
