import { useEffect, useRef, useState } from 'react'
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

function viewportHeightPx(): number {
  const vv = window.visualViewport?.height
  if (typeof vv === 'number' && vv > 0) return Math.round(vv)
  return window.innerHeight || 640
}

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
  const [vh, setVh] = useState(() => viewportHeightPx())
  const keypadRef = useRef<HTMLDivElement>(null)
  const closedRef = useRef(false)

  const outletInitial = outletInitialFromLocation(locationName, locationExternalId)
  const qrPayload = buildCheckInQrPayload(outletInitial, now)
  const compact = vh < 720
  const qrSize = compact ? 132 : 200

  function closeModal() {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }

  useEffect(() => {
    const syncVh = () => setVh(viewportHeightPx())
    syncVh()
    const vv = window.visualViewport
    vv?.addEventListener('resize', syncVh)
    vv?.addEventListener('scroll', syncVh)
    window.addEventListener('resize', syncVh)
    window.addEventListener('orientationchange', syncVh)
    return () => {
      vv?.removeEventListener('resize', syncVh)
      vv?.removeEventListener('scroll', syncVh)
      window.removeEventListener('resize', syncVh)
      window.removeEventListener('orientationchange', syncVh)
    }
  }, [])

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
    const poll = window.setInterval(() => {
      void syncPosDutyWithHrAttendance().then(next => {
        if (cancelled) return
        setDuty(next)
        onDutyChange(next)
      })
    }, 8_000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
    // Run when the modal opens — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // closeModal is stable via closedRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Keep the PIN pad in view on short Android screens after open / duty change.
    keypadRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [duty, vh])

  async function submitPin(nextPin: string) {
    if (busy || nextPin.length !== 4 || closedRef.current) return
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
      // Close as soon as QR check-in + PIN unlock succeed.
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify PIN')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  function onKeyPad(key: (typeof KEYS)[number]) {
    if (busy || closedRef.current) return
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
    <div
      className={`checkin-modal${compact ? ' is-compact' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-modal-title"
      style={{ ['--checkin-vh' as string]: `${vh}px` }}
    >
      <button type="button" className="checkin-modal__backdrop" aria-label="Close" onClick={closeModal} />
      <div className="checkin-modal__card">
        <div className="checkin-modal__scroll">
          <header className="checkin-modal__header">
            <div>
              <h2 id="checkin-modal-title">Check in / out</h2>
              <p>
                Scan QR in Team to check in, then enter PIN to unlock POS.
              </p>
            </div>
            <button type="button" className="checkin-modal__close" onClick={closeModal} aria-label="Close">
              ×
            </button>
          </header>

          <div className="checkin-modal__status">
            <strong>Staff attendance</strong>
            <span>
              {duty
                ? 'Checked in — enter PIN to unlock, then this window closes.'
                : 'Scan Team QR to check in, then enter PIN.'}
            </span>
          </div>

          <div className="checkin-modal__qr-block">
            <img src={qrImageUrl(qrPayload, qrSize)} alt={`Check-in QR ${qrPayload}`} width={qrSize} height={qrSize} />
            <code className="checkin-modal__qr-code">{qrPayload}</code>
            <span className="checkin-modal__qr-hint">Scan in Team (/TEAM)</span>
          </div>
        </div>

        <div className="checkin-modal__pin-block" ref={keypadRef}>
          <label htmlFor="checkin-pin-display">POS unlock PIN</label>
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
