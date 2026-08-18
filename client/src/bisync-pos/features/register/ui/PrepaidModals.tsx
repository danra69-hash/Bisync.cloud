import { useState } from 'react'
import './PrepaidModals.css'

type CustomerProps = {
  productName: string
  promotionName: string
  packageLabel: string
  onCancel: () => void
  onConfirm: (payload: { customerName: string; customerMobile: string }) => void
}

export function PrepaidCustomerModal({
  productName,
  promotionName,
  packageLabel,
  onCancel,
  onConfirm,
}: CustomerProps) {
  const [customerName, setCustomerName] = useState('')
  const [customerMobile, setCustomerMobile] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const name = customerName.trim()
    const mobile = customerMobile.trim()
    if (!name) {
      setError('Customer full name is required.')
      return
    }
    if (!mobile || mobile.replace(/\D/g, '').length < 7) {
      setError('Enter a valid mobile number.')
      return
    }
    onConfirm({ customerName: name, customerMobile: mobile })
  }

  return (
    <div className="prepaid-modal" role="dialog" aria-modal="true" aria-label="Prepaid customer">
      <button type="button" className="prepaid-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="prepaid-modal__card">
        <header>
          <p className="prepaid-modal__eyebrow">Pre-paid purchase</p>
          <h2>{productName}</h2>
          <p>{promotionName} · {packageLabel}</p>
        </header>
        <label>
          <span>Customer full name</span>
          <input
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Full name"
            autoFocus
          />
        </label>
        <label>
          <span>Mobile number</span>
          <input
            value={customerMobile}
            onChange={e => setCustomerMobile(e.target.value)}
            placeholder="e.g. 0123456789"
            inputMode="tel"
          />
        </label>
        {error ? <p className="prepaid-modal__error">{error}</p> : null}
        <div className="prepaid-modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn--navy" onClick={submit}>Continue</button>
        </div>
      </div>
    </div>
  )
}

type DepletionUnit = { code: string; label: string; qtyPerUnit: number }

type DepleteProps = {
  purchases: Array<{
    id: number
    customerName: string
    customerMobile: string
    promotionName: string
    productName: string
    balanceRemaining: number
    packageUom: string
    packageQty: number
    depletionMethod?: string
    depletionUnits?: DepletionUnit[]
  }>
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (payload: {
    purchaseId: number
    unitCode?: string
    qty: number
    productId?: number
  }) => void
}

export function PrepaidDepleteModal({
  purchases,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: DepleteProps) {
  const [purchaseId, setPurchaseId] = useState(purchases[0]?.id ?? 0)
  const [unitCode, setUnitCode] = useState(purchases[0]?.depletionUnits?.[0]?.code ?? '')
  const [qty, setQty] = useState('1')
  const [localError, setLocalError] = useState<string | null>(null)

  const selected = purchases.find(p => p.id === purchaseId) ?? purchases[0]
  const method = selected?.depletionMethod === 'weight' ? 'weight' : 'salesUnit'
  const units = selected?.depletionUnits?.length
    ? selected.depletionUnits
    : [{ code: 'serve', label: 'Serve', qtyPerUnit: 1 }]

  function submit() {
    if (!selected) {
      setLocalError('Select a prepaid purchase.')
      return
    }
    const n = Number(qty)
    if (!Number.isFinite(n) || n <= 0) {
      setLocalError('Enter a positive quantity.')
      return
    }
    const per = method === 'weight'
      ? 1
      : (units.find(u => u.code === (unitCode || units[0]!.code))?.qtyPerUnit ?? 1)
    const need = method === 'weight' ? n : n * per
    if (need > selected.balanceRemaining + 1e-9) {
      setLocalError(`Not enough balance. Remaining ${selected.balanceRemaining} ${selected.packageUom}.`)
      return
    }
    onConfirm({
      purchaseId: selected.id,
      unitCode: method === 'salesUnit' ? (unitCode || units[0]!.code) : undefined,
      qty: n,
    })
  }

  return (
    <div className="prepaid-modal" role="dialog" aria-modal="true" aria-label="Redeem prepaid">
      <button type="button" className="prepaid-modal__backdrop" aria-label="Close" disabled={busy} onClick={onCancel} />
      <div className="prepaid-modal__card prepaid-modal__card--wide">
        <header>
          <p className="prepaid-modal__eyebrow">Pre-paid</p>
          <h2>Redeem customer balance</h2>
          <p>Choose the prepaid package and deplete by serve or weight.</p>
        </header>

        {purchases.length === 0 ? (
          <p className="prepaid-modal__error">No active prepaid purchases for this location.</p>
        ) : (
          <>
            <label>
              <span>Customer prepaid package</span>
              <select
                value={purchaseId}
                disabled={busy}
                onChange={e => {
                  const id = Number(e.target.value)
                  setPurchaseId(id)
                  const next = purchases.find(p => p.id === id)
                  setUnitCode(next?.depletionUnits?.[0]?.code ?? '')
                }}
              >
                {purchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.customerName} · {p.customerMobile} · {p.promotionName} · left {p.balanceRemaining} {p.packageUom}
                  </option>
                ))}
              </select>
            </label>

            {selected ? (
              <p className="prepaid-modal__meta">
                {selected.productName} · balance {selected.balanceRemaining} / {selected.packageQty} {selected.packageUom}
              </p>
            ) : null}

            {method === 'salesUnit' ? (
              <div className="prepaid-modal__units" role="group" aria-label="Serve type">
                {units.map(u => (
                  <button
                    key={u.code}
                    type="button"
                    className={unitCode === u.code ? 'is-active' : undefined}
                    disabled={busy}
                    onClick={() => setUnitCode(u.code)}
                  >
                    {u.label}
                    <small>{u.qtyPerUnit} {selected?.packageUom}/serve</small>
                  </button>
                ))}
              </div>
            ) : null}

            <label>
              <span>{method === 'weight' ? 'Weight to deplete' : 'Quantity'}</span>
              <input
                value={qty}
                disabled={busy}
                onChange={e => setQty(e.target.value)}
                inputMode="decimal"
              />
            </label>
          </>
        )}

        {localError || error ? (
          <p className="prepaid-modal__error">{localError || error}</p>
        ) : null}

        <div className="prepaid-modal__actions">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn btn--navy"
            disabled={busy || purchases.length === 0}
            onClick={submit}
          >
            {busy ? 'Redeeming…' : 'Redeem'}
          </button>
        </div>
      </div>
    </div>
  )
}
