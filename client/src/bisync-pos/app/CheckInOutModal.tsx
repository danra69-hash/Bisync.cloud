import { useEffect, useState } from 'react'
import { qrImageUrl } from '../core/config/qrTable'
import { outletInitialFromLocation } from '../core/session/outletInitial'
import { applyPosDutyPin } from '../core/session/posDutyPin'
import {
  buildCheckInQrPayload,
  loadPosDutySession,
  type PosDutySession,
} from '../core/session/posDutySession'
import { syncPosDutyWithHrAttendance } from '../core/session/posDutySync'
import './CheckInOutModal.css'

type Props = {
  locationExternalId: string
  locationName: string
  onClose: () => void
  onDutyChange: (session: PosDutySession | null) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

export function CheckInOutModal({
  locationExternalId,
  locationName,
  onClose,
  onDutyChange,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duty, setDuty] = useState<PosDutySession | null>(() => loadPosDutySession())

  const outletInitial = outletInitialFromLocation(locationName, locationExternalId)
  const qrPayload = buildCheckInQrPayload(outletInitial, now)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    // Reconcile with Team/HR when the QR screen opens (mobile may have checked out).
    let cancelled = false
    void syncPosDutyWithHrAttendance().then(next => {
      if (cancelled) return
      setDuty(next)
      onDutyChange(next)
    })
    return () => {
      cancelled = true
    }
    // Run once when the modal opens — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submitPin(nextPin: string) {
    if (busy || nextPin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const result = await applyPosDutyPin({
        pin: nextPin,
        locationExternalId,
        locationName,
      })
      if (!result.ok) {
        setError(result.error)
        setPin('')
        return
      }

      setDuty(result.session)
      onDutyChange(result.session)
      setPin('')
      // Close the QR / check-in page once duty starts (or ends).
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify PIN')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function onKeyPad(key: (typeof KEYS)[number]) {
    if (busy) return
    setError(null)
    if (key === 'C') {
      setPin('')
      return
    }
    if (key === '⌫') {
      setPin(prev => prev.slice(0, -1))
      return
    }
    setPin(prev => {
      if (prev.length >= 4) return prev
      const next = prev + key
      if (next.length === 4) {
        window.setTimeout(() => void submitPin(next), 0)
      }
      return next
    })
  }

  return (
    <div className="checkin-modal" role="dialog" aria-modal="true" aria-labelledby="checkin-modal-title">
      <button type="button" className="checkin-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="checkin-modal__card">
        <header className="checkin-modal__header">
          <div>
            <h2 id="checkin-modal-title">Check in / out</h2>
            <p>
              {duty
                ? 'Enter the same Team PIN to check out for a break or end of shift. You can check back in later the same day.'
                : 'Scan with Bisync Team (/TEAM), or enter your Team / POS PIN below. This screen closes after check-in.'}
            </p>
          </div>
          <button type="button" className="checkin-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="checkin-modal__status">
          {duty ? (
            <>
              <strong>On duty</strong>
              <span>
                {duty.employeeName}
                {duty.employeeCode ? ` · ${duty.employeeCode}` : ''}
              </span>
            </>
          ) : (
            <>
              <strong>Not on duty</strong>
              <span>POS ordering is locked until check-in (breaks allowed anytime)</span>
            </>
          )}
        </div>

        <div className="checkin-modal__qr-block">
          <img src={qrImageUrl(qrPayload, 220)} alt={`Check-in QR ${qrPayload}`} />
          <code className="checkin-modal__qr-code">{qrPayload}</code>
          <span className="checkin-modal__qr-hint">Outlet · Date · Time — scan in Team to record HR attendance</span>
        </div>

        <div className="checkin-modal__pin-block">
          <label htmlFor="checkin-pin-display">Team / POS PIN</label>
          <div id="checkin-pin-display" className="checkin-modal__pin-dots" aria-live="polite">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className={i < pin.length ? 'is-filled' : ''}>
                {i < pin.length ? '•' : ''}
              </span>
            ))}
          </div>

          <div className="checkin-modal__keypad" role="group" aria-label="PIN keypad">
            {KEYS.map(key => (
              <button
                key={key}
                type="button"
                className={`checkin-modal__key${key === 'C' || key === '⌫' ? ' is-action' : ''}`}
                onClick={() => onKeyPad(key)}
                disabled={busy}
              >
                {key}
              </button>
            ))}
          </div>

          {error ? <p className="checkin-modal__error" role="alert">{error}</p> : null}
          {busy ? <p className="checkin-modal__busy">Verifying…</p> : null}
        </div>
      </div>
    </div>
  )
}
