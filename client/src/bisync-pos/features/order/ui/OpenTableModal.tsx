import { useState } from 'react'
import './OpenTableModal.css'

type Props = {
  tableLabel: string
  onCancel: () => void
  onConfirm: (pax: number) => void
}

/** Shown only for Dynamic QR table mode when opening a free table. */
export function OpenTableModal({ tableLabel, onCancel, onConfirm }: Props) {
  const [pax, setPax] = useState(2)

  return (
    <div className="open-table-modal" role="dialog" aria-modal="true" aria-labelledby="open-table-title">
      <button type="button" className="open-table-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="open-table-modal__card">
        <h2 id="open-table-title">Open table {tableLabel}</h2>
        <p>Enter number of pax. A dynamic QR (time / date / table) prints immediately.</p>
        <label>
          Number of pax
          <input
            type="number"
            min={1}
            max={40}
            value={pax}
            onChange={(e) => setPax(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            autoFocus
          />
        </label>
        <div className="open-table-modal__actions">
          <button type="button" className="chip-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="chip-btn chip-btn--primary"
            onClick={() => onConfirm(pax)}
          >
            Confirm &amp; print QR
          </button>
        </div>
      </div>
    </div>
  )
}
