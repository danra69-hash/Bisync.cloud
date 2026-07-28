import { useMemo, useState } from 'react'
import { formatMoney } from '../../../core/types/money'
import { TENDER_LABEL, type TenderType } from '../domain/payments'
import { FeaturePage } from '../../common/FeaturePage'
import './CashierPages.css'

const OPEN_CHECK_CENTS = 4500

export function CashierCheckoutPage() {
  const [tender, setTender] = useState<TenderType>('tap')
  const [cashReceived, setCashReceived] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const change = useMemo(() => {
    if (tender !== 'cash') return 0
    const received = Math.round(Number(cashReceived || 0) * 100)
    return Math.max(0, received - OPEN_CHECK_CENTS)
  }, [cashReceived, tender])

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  return (
    <FeaturePage
      crumb="Cashier / Checkout"
      title="Payment Processing"
      subtitle="Counter, bar, and kiosk tender flow — EMV, tap-to-pay, QR, and cash with CFD tip prompts."
    >
      <div className="cashier-layout">
        <section className="panel-card cashier-check">
          <h3>Open check #20 · Table 5</h3>
          <p>Fresh Basil Salad ×2 · Shrimp Basil Salad ×1</p>
          <div className="cashier-check__total">{formatMoney(OPEN_CHECK_CENTS)}</div>
        </section>

        <section className="panel-card">
          <h3>Tender</h3>
          <div className="tender-grid">
            {(Object.keys(TENDER_LABEL) as TenderType[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`tender-btn${tender === key ? ' is-active' : ''}`}
                onClick={() => setTender(key)}
              >
                {TENDER_LABEL[key]}
              </button>
            ))}
          </div>

          {tender === 'cash' && (
            <label className="cashier-field">
              Cash received ($)
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
              <span>Change due: {formatMoney(change)}</span>
            </label>
          )}

          <div className="cashier-actions">
            <button
              type="button"
              className="chip-btn chip-btn--primary"
              onClick={() => flash(`Charged via ${TENDER_LABEL[tender]}`)}
            >
              Take Payment
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => flash('Sent tip prompt to customer display')}
            >
              Push Tip Prompt
            </button>
          </div>
        </section>
      </div>
      {toast && <div className="feature-toast" role="status">{toast}</div>}
    </FeaturePage>
  )
}

export function SplitCheckPage() {
  return (
    <FeaturePage
      crumb="Cashier / Split Check"
      title="Advanced Check Splitting"
      subtitle="Split evenly, by seat, or by item — then apply multiple tenders on one check."
    >
      <div className="panel-grid">
        <div className="panel-card">
          <h3>Even split</h3>
          <p>Divide {formatMoney(4500)} across N guests.</p>
        </div>
        <div className="panel-card">
          <h3>By seat</h3>
          <p>Seat 1 / Seat 2 / Seat 3 each pay their own dishes.</p>
        </div>
        <div className="panel-card">
          <h3>By item</h3>
          <p>Drag line items onto payment buckets.</p>
        </div>
        <div className="panel-card">
          <h3>Multi-tender</h3>
          <p>Part card, part cash, part gift card on a single check.</p>
        </div>
      </div>
    </FeaturePage>
  )
}

export function TipsPage() {
  return (
    <FeaturePage
      crumb="Cashier / Tips"
      title="Tipping & Gratuity"
      subtitle="Customer-facing tip prompts, custom amounts, and auto-gratuity for large parties."
    >
      <div className="panel-grid">
        {['18%', '20%', '25%', 'Custom', 'Auto-grat (8+)'].map((label) => (
          <button key={label} type="button" className="panel-card tip-card">
            <h3>{label}</h3>
            <p>Push to CFD / confirm on terminal</p>
          </button>
        ))}
      </div>
    </FeaturePage>
  )
}

export function DrawerPage() {
  return (
    <FeaturePage
      crumb="Cashier / Cash Drawer"
      title="Cash Drawer Management"
      subtitle="Secure drops, blind closeouts, shift changes, and end-of-day reconciliation."
    >
      <div className="panel-grid">
        <div className="panel-card">
          <h3>Cash drop</h3>
          <p>Move excess drawer cash to the safe mid-shift.</p>
        </div>
        <div className="panel-card">
          <h3>Blind closeout</h3>
          <p>Count without seeing expected totals — catch discrepancies.</p>
        </div>
        <div className="panel-card">
          <h3>Shift change</h3>
          <p>Hand off drawer responsibility between cashiers.</p>
        </div>
        <div className="panel-card">
          <h3>End of day</h3>
          <p>Reconcile expected vs counted and lock the till.</p>
        </div>
      </div>
    </FeaturePage>
  )
}

export function DispatchPage() {
  return (
    <FeaturePage
      crumb="Cashier / Dispatch"
      title="Takeout & Delivery Dispatch"
      subtitle="Third-party apps and online orders — track prep and handoff to drivers."
    >
      <div className="panel-grid">
        {[
          { name: 'Uber Eats #4821', status: 'Prep' },
          { name: 'Online — Maya L.', status: 'Ready' },
          { name: 'GrabFood #991', status: 'Dispatched' },
        ].map((order) => (
          <div key={order.name} className="panel-card">
            <h3>{order.name}</h3>
            <p>Fulfillment: {order.status}</p>
          </div>
        ))}
      </div>
    </FeaturePage>
  )
}

export function VoidsPage() {
  return (
    <FeaturePage
      crumb="Cashier / Discounts & Voids"
      title="Discounts & Voids"
      subtitle="Manager-approved comps, promo codes, and voiding items for errors or complaints."
    >
      <div className="panel-grid">
        <div className="panel-card">
          <h3>Promo code</h3>
          <p>Apply campaign discounts with audit trail.</p>
        </div>
        <div className="panel-card">
          <h3>Comp</h3>
          <p>Requires manager permission for hospitality comps.</p>
        </div>
        <div className="panel-card">
          <h3>Void item</h3>
          <p>Remove a line due to kitchen or service error.</p>
        </div>
      </div>
    </FeaturePage>
  )
}
