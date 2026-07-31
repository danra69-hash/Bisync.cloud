import { useEffect, useState, type ReactNode } from 'react'
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
import './FloorSideNav.css'

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'] as const

type NavId = 'home' | 'takeout' | 'reservation' | 'waitlist' | 'history' | 'checkin'

type Props = {
  adminOpen: boolean
  onToggleAdmin: () => void
}

export function FloorSideNav({ adminOpen, onToggleAdmin }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setMode } = usePosMode()
  const session = usePosSessionOptional()
  const locationId = session?.locationId ?? ''
  const locationName =
    session?.locations.find(loc => loc.externalId === locationId)?.name || locationId || 'Outlet'

  const homePath = MODE_META.order.homePath
  const isHome =
    pathname === '/order/floor'
    || (pathname.startsWith('/order/floor') && !pathname.includes('/edit'))
  const isRegister = pathname.startsWith('/order/register')
  const isReservation = pathname.startsWith('/order/reservations')
  const isWaitlist = pathname.startsWith('/order/waitlist')

  const [checkInOpen, setCheckInOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { duty, setDuty, refreshDuty } = usePosDutySession()
  const [dining, setDining] = useState('')
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinStatus, setPinStatus] = useState<string | null>(null)

  useEffect(() => {
    function onDiningChanged(event: Event) {
      setDining(readPosDiningFromEvent(event))
    }
    window.addEventListener(POS_DINING_CHANGED_EVENT, onDiningChanged)
    return () => window.removeEventListener(POS_DINING_CHANGED_EVENT, onDiningChanged)
  }, [])

  function goHome() {
    setMode('order')
    navigate(homePath)
  }

  function goTakeOut() {
    setMode('order')
    if (!isRegister) {
      navigate('/order/register')
    }
    window.setTimeout(() => requestPosTakeaway(), isRegister ? 0 : 50)
  }

  function goReservation() {
    setMode('order')
    navigate('/order/reservations')
  }

  function goWaitlist() {
    setMode('order')
    navigate('/order/waitlist')
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
      setPinStatus(
        result.action === 'check-in'
          ? `Signed in · ${result.session?.employeeName ?? 'Staff'}`
          : 'Signed out · POS locked',
      )
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

  const items: Array<{
    id: NavId
    label: string
    active: boolean
    onClick: () => void
    icon: ReactNode
  }> = [
    {
      id: 'home',
      label: 'Home',
      active: isHome,
      onClick: goHome,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
        </svg>
      ),
    },
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
      active: isReservation,
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
      label: duty ? `On duty · ${duty.employeeName}` : 'Check in/out',
      active: Boolean(duty) || checkInOpen,
      onClick: () => setCheckInOpen(true),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      ),
    },
  ]

  return (
    <>
      <nav className="floor-side-nav" aria-label="POS home navigation">
        <div className="floor-side-nav__list">
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              className={`floor-side-nav__btn${item.active ? ' is-active' : ''}${item.id === 'checkin' && duty ? ' is-on-duty' : ''}`}
              onClick={item.onClick}
              aria-current={item.active && item.id !== 'history' && item.id !== 'checkin' ? 'page' : undefined}
            >
              <span className="floor-side-nav__icon">{item.icon}</span>
              <span className="floor-side-nav__label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="floor-side-nav__pin" aria-label="POS sign-in PIN pad">
          <div className="floor-side-nav__pin-head">
            <span className="floor-side-nav__pin-title">
              {duty ? 'Sign out / break' : 'Sign in to POS'}
            </span>
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
