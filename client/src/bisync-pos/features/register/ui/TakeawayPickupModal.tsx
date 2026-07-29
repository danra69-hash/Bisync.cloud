import { useState } from 'react'
import {
  nextHalfHourSlot,
  PICKUP_HOURS,
  PICKUP_MINUTES,
  type TakeawayPickup,
} from '../domain/pickupTime'
import './TakeawayPickupModal.css'

type Props = {
  onCancel: () => void
  onConfirm: (pickup: TakeawayPickup) => void
}

export function TakeawayPickupModal({ onCancel, onConfirm }: Props) {
  const initial = nextHalfHourSlot()
  const [hour, setHour] = useState(initial.hour)
  const [minute, setMinute] = useState<0 | 30>(initial.minute)

  return (
    <div className="takeaway-pickup-modal" role="dialog" aria-modal="true" aria-labelledby="takeaway-pickup-title">
      <button type="button" className="takeaway-pickup-modal__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="takeaway-pickup-modal__card">
        <h2 id="takeaway-pickup-title">Takeaway order</h2>
        <p>Choose when this order should be ready.</p>

        <button
          type="button"
          className="takeaway-pickup-modal__now"
          onClick={() => onConfirm({ mode: 'now' })}
        >
          Make now
        </button>

        <div className="takeaway-pickup-modal__divider">
          <span>or pick up time</span>
        </div>

        <div className="takeaway-pickup-modal__time">
          <label>
            Hour
            <select
              value={hour}
              onChange={e => setHour(Number(e.target.value))}
              aria-label="Pick up hour"
            >
              {PICKUP_HOURS.map(h => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minute
            <select
              value={minute}
              onChange={e => setMinute(Number(e.target.value) === 30 ? 30 : 0)}
              aria-label="Pick up minute"
            >
              {PICKUP_MINUTES.map(m => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="takeaway-pickup-modal__actions">
          <button type="button" className="chip-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="chip-btn chip-btn--primary"
            onClick={() => onConfirm({ mode: 'scheduled', hour, minute })}
          >
            Confirm pick up
          </button>
        </div>
      </div>
    </div>
  )
}
