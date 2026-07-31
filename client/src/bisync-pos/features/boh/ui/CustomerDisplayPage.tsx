import { useEffect, useState } from 'react'
import { formatMoney } from '../../../core/types/money'
import {
  CDS_SNAPSHOT_EVENT,
  loadCustomerDisplaySnapshot,
  type CustomerDisplaySnapshot,
} from '../domain/customerDisplay'
import './CustomerDisplayPage.css'

function diningLabel(dining: string): string {
  if (dining === 'dine-in') return 'Dine In'
  if (dining === 'takeaway') return 'Takeaway'
  if (dining === 'delivery') return 'Delivery'
  return dining || 'Order'
}

export function CustomerDisplayPage() {
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot | null>(
    () => loadCustomerDisplaySnapshot(),
  )

  useEffect(() => {
    function refresh() {
      setSnapshot(loadCustomerDisplaySnapshot())
    }
    window.addEventListener(CDS_SNAPSHOT_EVENT, refresh)
    window.addEventListener('storage', refresh)
    const poll = window.setInterval(refresh, 1000)
    return () => {
      window.removeEventListener(CDS_SNAPSHOT_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.clearInterval(poll)
    }
  }, [])

  if (!snapshot || snapshot.lines.length === 0) {
    return (
      <div className="cds-display cds-display--idle">
        <div className="cds-display__idle-card">
          <p className="cds-display__code">CDS</p>
          <h1>Welcome</h1>
          <p>Your order details will appear here before payment.</p>
        </div>
      </div>
    )
  }

  const { charges } = snapshot

  return (
    <div className="cds-display">
      <header className="cds-display__head">
        <div>
          <p className="cds-display__code">CDS · Customer Display</p>
          <h1>Your order</h1>
          <p className="cds-display__meta">
            #{snapshot.checkNumber}
            {snapshot.tableLabel ? ` · ${snapshot.tableLabel}` : ''}
            {` · ${diningLabel(snapshot.dining)}`}
            {snapshot.cover > 0 ? ` · ${snapshot.cover} covers` : ''}
          </p>
        </div>
        <div className="cds-display__total-pill" aria-live="polite">
          <span>Amount due</span>
          <strong>{formatMoney(snapshot.grandTotalCents)}</strong>
        </div>
      </header>

      <div className="cds-display__body">
        <table className="cds-display__table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Price</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.lines.map((line, index) => (
              <tr key={`${line.name}-${index}`}>
                <td>
                  <div className="cds-display__item-name">{line.name}</div>
                  {line.note ? <div className="cds-display__item-note">{line.note}</div> : null}
                </td>
                <td>{line.quantityLabel}</td>
                <td>{formatMoney(line.unitPriceCents)}</td>
                <td>{formatMoney(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="cds-display__summary">
          <div className="cds-display__row">
            <span>Sub-total</span>
            <strong>{formatMoney(snapshot.subtotalCents)}</strong>
          </div>
          {charges.discountCents > 0 ? (
            <div className="cds-display__row">
              <span>Discount</span>
              <strong>−{formatMoney(charges.discountCents)}</strong>
            </div>
          ) : null}
          {charges.serviceCents > 0 ? (
            <div className="cds-display__row">
              <span>Service</span>
              <strong>{formatMoney(charges.serviceCents)}</strong>
            </div>
          ) : null}
          {charges.taxRegularCents > 0 ? (
            <div className="cds-display__row">
              <span>Tax</span>
              <strong>{formatMoney(charges.taxRegularCents)}</strong>
            </div>
          ) : null}
          {charges.taxAlcoholCents > 0 ? (
            <div className="cds-display__row">
              <span>Alcohol tax</span>
              <strong>{formatMoney(charges.taxAlcoholCents)}</strong>
            </div>
          ) : null}
          <div className="cds-display__row cds-display__row--grand">
            <span>Total</span>
            <strong>{formatMoney(snapshot.grandTotalCents)}</strong>
          </div>
          <p className="cds-display__pay-hint">Please wait — payment not yet completed</p>
        </aside>
      </div>
    </div>
  )
}
