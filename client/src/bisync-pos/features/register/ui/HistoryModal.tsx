import { useState } from 'react'
import { formatMoney } from '../../../core/types/money'
import {
  formatCheckClosedAt,
  MOCK_CLOSED_CHECKS,
  type ClosedCheck,
} from '../domain/history'
import { formatPosCheckNumber } from '../domain/checkNumber'
import { ColGroup } from '../../../../components/shared/SortableTableHead'
import './HistoryModal.css'

type Props = {
  onClose: () => void
}

export function HistoryModal({ onClose }: Props) {
  const [selected, setSelected] = useState<ClosedCheck | null>(null)

  return (
    <div className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
      <button
        type="button"
        className="history-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="history-modal__card">
        <header className="history-modal__header">
          <div>
            {selected ? (
              <button
                type="button"
                className="history-modal__back"
                onClick={() => setSelected(null)}
              >
                ← Back
              </button>
            ) : null}
            <h2 id="history-title">
              {selected ? `Check #${formatPosCheckNumber(selected.checkNumber)}` : 'History'}
            </h2>
          </div>
          <button
            type="button"
            className="history-modal__close"
            aria-label="Close history"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {selected ? (
          <CheckDetail check={selected} />
        ) : (
          <ul className="history-list">
            {MOCK_CLOSED_CHECKS.map((check) => (
              <li key={check.id}>
                <button
                  type="button"
                  className="history-list__item"
                  onClick={() => setSelected(check)}
                >
                  <span className="history-list__check">#{formatPosCheckNumber(check.checkNumber)}</span>
                  <span className="history-list__meta">
                    {formatCheckClosedAt(check.closedAt)}
                  </span>
                  <span className="history-list__amount">
                    {formatMoney(check.grandTotalCents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CheckDetail({ check }: { check: ClosedCheck }) {
  const subtotal = check.lines.reduce((sum, line) => sum + line.totalCents, 0)

  return (
    <div className="history-detail">
      <div className="history-detail__meta">
        <p>
          Closed <strong>{formatCheckClosedAt(check.closedAt)}</strong>
        </p>
        <p>
          {check.dining}
          {check.table !== '—' ? ` · ${check.table}` : ''}
          {' · '}
          {check.paymentMethod}
        </p>
      </div>

      <table className="history-detail__table">
        <ColGroup widths={['40%', '15%', '22%', '23%']} />
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">QTY</th>
            <th scope="col">Unit Price</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {check.lines.map((line) => (
            <tr key={`${line.productName}-${line.quantity}`}>
              <td>{line.productName}</td>
              <td>{line.quantity}</td>
              <td>{formatMoney(line.unitPriceCents)}</td>
              <td>{formatMoney(line.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="history-detail__summary">
        <SummaryRow label="Sub-Total" value={formatMoney(subtotal)} />
        <SummaryRow label="Discount" value={formatMoney(check.charges.discountCents)} />
        <SummaryRow label="Service" value={formatMoney(check.charges.serviceCents)} />
        <SummaryRow label="Tax Regular" value={formatMoney(check.charges.taxRegularCents)} />
        <SummaryRow label="Tax Alcohol" value={formatMoney(check.charges.taxAlcoholCents)} />
        <div className="history-detail__total">
          <span>Grand Total</span>
          <strong>{formatMoney(check.grandTotalCents)}</strong>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="history-detail__row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
