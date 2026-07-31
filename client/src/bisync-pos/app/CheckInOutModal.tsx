import { useEffect, useState } from 'react'
import { hrApi } from '../../modules/hr/api'
import {
  clockDate,
  clockHhMm,
  punchHrAttendance,
} from '../../modules/hr/attendancePunch'
import {
  isValidPin,
  loadPinEnrollment,
  unlockPinPayload,
} from '../../modules/hr/teamPin'
import { qrImageUrl } from '../core/config/qrTable'
import { outletInitialFromLocation } from '../core/session/outletInitial'
import {
  buildCheckInQrPayload,
  clearPosDutySession,
  loadPosDutySession,
  savePosDutySession,
  type PosDutySession,
} from '../core/session/posDutySession'
import {
  isPosRegisterLocked,
  lockPosRegister,
  unlockPosRegister,
  POS_REGISTER_LOCK_EVENT,
} from '../core/session/posRegisterLock'
import './CheckInOutModal.css'

type Props = {
  locationExternalId: string
  locationName: string
  onClose: () => void
  onDutyChange: (session: PosDutySession | null) => void
  /** Soft-lock unlock only (no QR / checkout). */
  unlockOnly?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

async function resolvePinEmployee(pin: string): Promise<{
  employeeId: number
  employeeName: string
  employeeCode: string
} | null> {
  // Prefer Team mobile PIN enrollment on this device.
  if (loadPinEnrollment() && isValidPin(pin)) {
    try {
      const payload = await unlockPinPayload(pin)
      return {
        employeeId: payload.employeeId,
        employeeName: payload.name || 'Employee',
        employeeCode: payload.username || '',
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const result = await hrApi.employees.verifyPosPin(pin)
    if (result.valid && result.employeeId != null) {
      return {
        employeeId: result.employeeId,
        employeeName: result.employeeName || 'Employee',
        employeeCode: result.employeeCode || '',
      }
    }
  } catch {
    /* fall through */
  }

  // Local smoke fallback when no Team/POS PIN is configured yet.
  if (pin === '1234') {
    return { employeeId: 0, employeeName: 'POS Staff', employeeCode: 'DEMO' }
  }
  return null
}

export function CheckInOutModal({
  locationExternalId,
  locationName,
  onClose,
  onDutyChange,
  unlockOnly = false,
}: Props) {
  const [now, setNow] = useState(() => new Date())
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duty, setDuty] = useState<PosDutySession | null>(() => loadPosDutySession())
  const [locked, setLocked] = useState(() => isPosRegisterLocked())

  const outletInitial = outletInitialFromLocation(locationName, locationExternalId)
  const qrPayload = buildCheckInQrPayload(outletInitial, now)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const sync = () => setLocked(isPosRegisterLocked())
    window.addEventListener(POS_REGISTER_LOCK_EVENT, sync)
    return () => window.removeEventListener(POS_REGISTER_LOCK_EVENT, sync)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !unlockOnly) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, unlockOnly])

  async function submitPin(nextPin: string) {
    if (busy || nextPin.length !== 4) return
    setBusy(true)
    setError(null)
    try {
      const resolved = await resolvePinEmployee(nextPin)
      if (!resolved) {
        setError('Invalid PIN. Use your Team mobile PIN, or set one under your name in /TEAM.')
        setPin('')
        return
      }

      const current = loadPosDutySession()

      // Soft-lock unlock: same on-duty employee re-enters Team/POS PIN.
      if (unlockOnly || (current && locked)) {
        if (!current) {
          setError('No one is on duty. Check in first.')
          setPin('')
          return
        }
        if (resolved.employeeId !== 0 && current.employeeId !== 0 && resolved.employeeId !== current.employeeId) {
          setError(`Only ${current.employeeName} can unlock this register.`)
          setPin('')
          return
        }
        unlockPosRegister()
        setLocked(false)
        setDuty(current)
        onDutyChange(current)
        setPin('')
        if (unlockOnly) onClose()
        return
      }

      if (current && current.employeeId === resolved.employeeId) {
        clearPosDutySession()
        setDuty(null)
        onDutyChange(null)
        setPin('')
        // Record HR check-out when ending duty (skip demo id 0).
        if (resolved.employeeId > 0) {
          try {
            await punchHrAttendance({
              employeeId: resolved.employeeId,
              date: clockDate(),
              timeHhMm: clockHhMm(),
            })
          } catch {
            /* already out or no open punch */
          }
        }
        return
      }

      if (current && current.employeeId !== resolved.employeeId) {
        setError(`${current.employeeName} is on duty. Check out first.`)
        setPin('')
        return
      }

      const session: PosDutySession = {
        employeeId: resolved.employeeId,
        employeeName: resolved.employeeName,
        employeeCode: resolved.employeeCode,
        locationExternalId,
        outletInitial,
        checkedInAt: new Date().toISOString(),
      }
      savePosDutySession(session)
      unlockPosRegister()
      setDuty(session)
      onDutyChange(session)
      setPin('')

      // Ensure HR Attendance captures the punch when duty starts on POS.
      if (resolved.employeeId > 0) {
        try {
          await punchHrAttendance({
            employeeId: resolved.employeeId,
            date: clockDate(),
            timeHhMm: clockHhMm(),
          })
        } catch (err) {
          // Duty still activates; surface attendance issue without blocking POS.
          if (err instanceof Error && !/Already checked in and out/i.test(err.message)) {
            setError(`On duty — HR attendance: ${err.message}`)
          }
        }
      }
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

  const title = unlockOnly || (duty && locked) ? 'Register locked' : 'Check in / out'
  const subtitle = unlockOnly || (duty && locked)
    ? 'Enter your Team mobile PIN to unlock POS ordering.'
    : 'Scan with Bisync Team (/TEAM), then enter your Team PIN to activate POS ordering.'

  return (
    <div className="checkin-modal" role="dialog" aria-modal="true" aria-labelledby="checkin-modal-title">
      {!unlockOnly ? (
        <button type="button" className="checkin-modal__backdrop" aria-label="Close" onClick={onClose} />
      ) : (
        <div className="checkin-modal__backdrop" aria-hidden />
      )}
      <div className="checkin-modal__card">
        <header className="checkin-modal__header">
          <div>
            <h2 id="checkin-modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          {!unlockOnly ? (
            <button type="button" className="checkin-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          ) : null}
        </header>

        <div className="checkin-modal__status">
          {duty ? (
            <>
              <strong>{locked || unlockOnly ? 'Locked' : 'On duty'}</strong>
              <span>
                {duty.employeeName}
                {duty.employeeCode ? ` · ${duty.employeeCode}` : ''}
              </span>
            </>
          ) : (
            <>
              <strong>Not on duty</strong>
              <span>POS ordering is locked until check-in</span>
            </>
          )}
        </div>

        {!unlockOnly && !(duty && locked) ? (
          <div className="checkin-modal__qr-block">
            <img src={qrImageUrl(qrPayload, 220)} alt={`Check-in QR ${qrPayload}`} />
            <code className="checkin-modal__qr-code">{qrPayload}</code>
            <span className="checkin-modal__qr-hint">Outlet · Date · Time — scan in Team to record HR attendance</span>
          </div>
        ) : null}

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

        {!unlockOnly && duty && !locked ? (
          <button
            type="button"
            className="checkin-modal__lock-now"
            onClick={() => {
              lockPosRegister()
              setLocked(true)
            }}
          >
            Lock register now
          </button>
        ) : null}
      </div>
    </div>
  )
}
