import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MODE_META } from '../../../core/modes/types'
import { usePosMode } from '../../../core/modes/ModeProvider'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import { applyPosDutyPin } from '../../../core/session/posDutyPin'
import { usePosDutySession } from '../../../core/session/usePosDutySession'
import {
  POS_DINING_CHANGED_EVENT,
  readPosDiningFromEvent,
  requestPosTakeaway,
} from '../../../core/session/posDiningBridge'
import { CheckInOutModal } from '../../../app/CheckInOutModal'
import { HistoryModal } from '../../register/ui/HistoryModal'
import {
  addReservation,
  assignReservationToTable,
  formatReservationWhen,
  loadReservations,
  RESERVATIONS_CHANGED_EVENT,
  upcomingReservations,
  type PosReservation,
} from '../domain/reservations'
import type { FloorTable } from '../domain/tables'
import { AssignTableModal } from './AssignTableModal'
import './FloorSideNav.css'

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

type NavId = 'home' | 'takeout' | 'reservation' | 'waitlist' | 'history' | 'checkin'

type Props = {
  adminOpen: boolean
  onToggleAdmin: () => void
}

function emptyNewReservation() {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let hours = now.getHours()
  let mins = Math.ceil((now.getMinutes() + 1) / 15) * 15
  if (mins >= 60) {
    hours = (hours + 1) % 24
    mins = 0
  }
  return {
    name: '',
    mobile: '',
    pax: 2,
    date,
    time: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
  }
}

export function FloorSideNav({ adminOpen, onToggleAdmin }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setMode } = usePosMode()
  const session = usePosSessionOptional()
  const companyId = session?.companyId ?? 0
  const locationId = session?.locationId ?? ''
  const locationName =
    session?.locations.find(loc => loc.externalId === locationId)?.name || locationId || 'Outlet'

  const homePath = MODE_META.order.homePath
  const isHome =
    pathname === '/order/floor'
    || (pathname.startsWith('/order/floor') && !pathname.includes('/edit'))
  const isRegister = pathname.startsWith('/order/register')
  const isWaitlist = pathname.startsWith('/order/waitlist')

  const [checkInOpen, setCheckInOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reservationsOpen, setReservationsOpen] = useState(
    () => pathname.startsWith('/order/reservations'),
  )
  const [reservations, setReservations] = useState<PosReservation[]>(() =>
    loadReservations(companyId, locationId),
  )
  const [assigning, setAssigning] = useState<PosReservation | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState(emptyNewReservation)
  const [flash, setFlash] = useState<string | null>(null)
  const { setDuty, refreshDuty } = usePosDutySession()
  const [dining, setDining] = useState('')
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinStatus, setPinStatus] = useState<string | null>(null)

  const upcoming = useMemo(
    () => upcomingReservations(reservations),
    [reservations],
  )

  useEffect(() => {
    function onDiningChanged(event: Event) {
      setDining(readPosDiningFromEvent(event))
    }
    window.addEventListener(POS_DINING_CHANGED_EVENT, onDiningChanged)
    return () => window.removeEventListener(POS_DINING_CHANGED_EVENT, onDiningChanged)
  }, [])

  useEffect(() => {
    function refresh() {
      setReservations(loadReservations(companyId, locationId))
    }
    refresh()
    window.addEventListener(RESERVATIONS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RESERVATIONS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [companyId, locationId])

  useEffect(() => {
    if (pathname.startsWith('/order/reservations')) {
      setReservationsOpen(true)
      setMode('order')
      navigate(homePath, { replace: true })
    }
  }, [pathname, homePath, navigate, setMode])

  function goHome() {
    setMode('order')
    setReservationsOpen(false)
    navigate(homePath)
  }

  function goTakeOut() {
    setMode('order')
    setReservationsOpen(false)
    if (!isRegister) {
      navigate('/order/register')
    }
    window.setTimeout(() => requestPosTakeaway(), isRegister ? 0 : 50)
  }

  function goReservation() {
    setMode('order')
    navigate(homePath)
    setReservationsOpen(open => !open)
  }

  function goWaitlist() {
    setMode('order')
    setReservationsOpen(false)
    navigate('/order/waitlist')
  }

  function notify(message: string) {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 2400)
  }

  function handleAssignPick(table: FloorTable) {
    if (!assigning) return
    const result = assignReservationToTable({
      companyId,
      locationId,
      reservationId: assigning.id,
      table,
    })
    setAssigning(null)
    if (!result) {
      notify('Could not assign table.')
      return
    }
    setReservations(loadReservations(companyId, locationId))
    notify(`${result.reservation.name} → ${result.table.label}`)
  }

  function handleAddReservation(e: FormEvent) {
    e.preventDefault()
    const name = draft.name.trim()
    const mobile = draft.mobile.trim()
    if (!name || !mobile || !draft.date || !draft.time || draft.pax < 1) {
      notify('Name, mobile, pax, date and time are required.')
      return
    }
    addReservation(companyId, locationId, {
      name,
      mobile,
      pax: Math.max(1, Math.round(draft.pax)),
      date: draft.date,
      time: draft.time,
    })
    setReservations(loadReservations(companyId, locationId))
    setDraft(emptyNewReservation())
    setShowAdd(false)
    notify(`Reservation added · ${name}`)
  }

  async function submitSidePin(nextPin: string) {
    if (pinBusy || nextPin.length !== 4) return
    setPinBusy(true)
    setPinError(null)
    setPinStatus(null)
    try {
      const result = await applyPosDutyPin({
        pin: nextPin,
        locationExternalId: locationId || 'outlet',
        locationName,
      })
      setPin('')
      if (!result.ok) {
        setPinError(result.error)
        return
      }
      setDuty(result.session)
      void refreshDuty()
      setPinStatus(result.action === 'check-in' ? 'Checked in' : 'Checked out')
      if (result.warning) setPinError(result.warning)
    } catch (err) {
      setPin('')
      setPinError(err instanceof Error ? err.message : 'Could not verify PIN')
    } finally {
      setPinBusy(false)
    }
  }

  function onSidePinKey(key: (typeof PIN_KEYS)[number]) {
    if (pinBusy) return
    setPinError(null)
    setPinStatus(null)
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
        window.setTimeout(() => void submitSidePin(next), 0)
      }
      return next
    })
  }

  const topItems: Array<{
    id: NavId
    label: string
    active: boolean
    onClick: () => void
    icon: ReactNode
  }> = [
    {
      id: 'home',
      label: 'Home',
      active: isHome && !reservationsOpen,
      onClick: goHome,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
        </svg>
      ),
    },
  ]

  const bottomItems: Array<{
    id: NavId
    label: string
    active: boolean
    onClick: () => void
    icon: ReactNode
  }> = [
    {
      id: 'takeout',
      label: 'Take Out',
      active: dining === 'takeaway',
      onClick: goTakeOut,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M4 8h16l-1.2 11.2a2 2 0 01-2 1.8H7.2a2 2 0 01-2-1.8L4 8z" />
          <path d="M8 8V6a4 4 0 018 0v2" />
        </svg>
      ),
    },
    {
      id: 'reservation',
      label: 'Reservation',
      active: reservationsOpen,
      onClick: goReservation,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      ),
    },
    {
      id: 'waitlist',
      label: 'Waitlist',
      active: isWaitlist,
      onClick: goWaitlist,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      active: historyOpen,
      onClick: () => setHistoryOpen(true),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M3 12a9 9 0 109-9" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      id: 'checkin',
      label: 'Check in/out',
      active: checkInOpen,
      onClick: () => setCheckInOpen(true),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      ),
    },
  ]

  function renderNavBtn(item: (typeof topItems)[number]) {
    return (
      <button
        key={item.id}
        type="button"
        className={`floor-side-nav__btn${item.active ? ' is-active' : ''}`}
        onClick={item.onClick}
        aria-current={item.active && item.id !== 'history' && item.id !== 'checkin' ? 'page' : undefined}
      >
        <span className="floor-side-nav__icon">{item.icon}</span>
        <span className="floor-side-nav__label">{item.label}</span>
      </button>
    )
  }

  return (
    <>
      <nav className="floor-side-nav" aria-label="POS home navigation">
        <div className="floor-side-nav__list">
          {topItems.map(renderNavBtn)}

          {reservationsOpen ? (
            <section className="floor-side-nav__reservations" aria-label="Upcoming reservations">
              <header className="floor-side-nav__rsv-head">
                <div>
                  <strong>Upcoming</strong>
                  <span>{upcoming.length}</span>
                </div>
                <button
                  type="button"
                  className="floor-side-nav__rsv-add"
                  onClick={() => setShowAdd(open => !open)}
                >
                  {showAdd ? 'Close' : '+ Add'}
                </button>
              </header>

              {showAdd ? (
                <form className="floor-side-nav__rsv-form" onSubmit={handleAddReservation}>
                  <label>
                    Name
                    <input
                      value={draft.name}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Guest name"
                      required
                    />
                  </label>
                  <label>
                    Mobile
                    <input
                      value={draft.mobile}
                      onChange={e => setDraft(d => ({ ...d, mobile: e.target.value }))}
                      placeholder="Mobile number"
                      required
                    />
                  </label>
                  <div className="floor-side-nav__rsv-row">
                    <label>
                      Pax
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={draft.pax}
                        onChange={e => setDraft(d => ({ ...d, pax: Number(e.target.value) || 1 }))}
                        required
                      />
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={draft.date}
                        onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Time
                      <input
                        type="time"
                        value={draft.time}
                        onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <button type="submit" className="floor-side-nav__rsv-save">
                    Save reservation
                  </button>
                </form>
              ) : null}

              <div className="floor-side-nav__rsv-list">
                {upcoming.length === 0 ? (
                  <p className="floor-side-nav__rsv-empty">No upcoming reservations.</p>
                ) : (
                  upcoming.map(rsv => (
                    <article
                      key={rsv.id}
                      className={`floor-side-nav__rsv-card${rsv.status === 'assigned' ? ' is-assigned' : ''}`}
                    >
                      <div className="floor-side-nav__rsv-main">
                        <strong>{rsv.name}</strong>
                        <span>{rsv.mobile}</span>
                        <span>
                          {rsv.pax} pax · {formatReservationWhen(rsv)}
                        </span>
                        {rsv.tableLabel ? (
                          <em>Table {rsv.tableLabel}</em>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="floor-side-nav__rsv-assign"
                        onClick={() => setAssigning(rsv)}
                      >
                        {rsv.tableLabel ? 'Reassign' : 'Assign table'}
                      </button>
                    </article>
                  ))
                )}
              </div>
              {flash ? <p className="floor-side-nav__rsv-flash">{flash}</p> : null}
            </section>
          ) : null}

          {bottomItems.map(renderNavBtn)}
        </div>

        <div className="floor-side-nav__pin" aria-label="Staff check-in PIN pad">
          <div className="floor-side-nav__pin-head">
            <span className="floor-side-nav__pin-title">Staff PIN</span>
            <span className="floor-side-nav__pin-dots" aria-live="polite">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={i < pin.length ? 'is-filled' : ''} />
              ))}
            </span>
          </div>
          <div className="floor-side-nav__keypad" role="group" aria-label="Numeric PIN pad">
            {PIN_KEYS.map(key => (
              <button
                key={key}
                type="button"
                className={`floor-side-nav__key${key === 'C' || key === '⌫' ? ' is-action' : ''}`}
                onClick={() => onSidePinKey(key)}
                disabled={pinBusy}
              >
                {key}
              </button>
            ))}
          </div>
          {pinStatus ? <p className="floor-side-nav__pin-ok">{pinStatus}</p> : null}
          {pinError ? <p className="floor-side-nav__pin-error" role="alert">{pinError}</p> : null}
          {pinBusy ? <p className="floor-side-nav__pin-busy">Verifying…</p> : null}
        </div>

        <button
          type="button"
          className={`floor-side-nav__admin${adminOpen ? ' is-open' : ''}`}
          onClick={onToggleAdmin}
          aria-expanded={adminOpen}
          aria-controls="app-side-menu"
        >
          Admin
        </button>
      </nav>

      {assigning ? (
        <AssignTableModal
          companyId={companyId}
          locationId={locationId}
          guestName={assigning.name}
          pax={assigning.pax}
          onCancel={() => setAssigning(null)}
          onPick={handleAssignPick}
        />
      ) : null}

      {checkInOpen && (
        <CheckInOutModal
          locationExternalId={locationId || 'outlet'}
          locationName={locationName}
          onClose={() => {
            setCheckInOpen(false)
            void refreshDuty()
          }}
          onDutyChange={next => {
            setDuty(next)
            void refreshDuty()
          }}
        />
      )}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </>
  )
}
