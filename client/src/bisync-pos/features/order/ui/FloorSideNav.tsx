import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MODE_META } from '../../../core/modes/types'
import { usePosMode } from '../../../core/modes/ModeProvider'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import {
  loadPosDutySession,
  POS_DUTY_SESSION_EVENT,
  type PosDutySession,
} from '../../../core/session/posDutySession'
import {
  POS_DINING_CHANGED_EVENT,
  readPosDiningFromEvent,
  requestPosTakeaway,
} from '../../../core/session/posDiningBridge'
import { CheckInOutModal } from '../../../app/CheckInOutModal'
import { HistoryModal } from '../../register/ui/HistoryModal'
import './FloorSideNav.css'

type NavId = 'home' | 'takeout' | 'reservation' | 'waitlist' | 'history' | 'checkin'

export function FloorSideNav() {
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
  const [duty, setDuty] = useState<PosDutySession | null>(() => loadPosDutySession())
  const [dining, setDining] = useState('')

  useEffect(() => {
    function syncDuty() {
      setDuty(loadPosDutySession())
    }
    window.addEventListener(POS_DUTY_SESSION_EVENT, syncDuty)
    window.addEventListener('storage', syncDuty)
    return () => {
      window.removeEventListener(POS_DUTY_SESSION_EVENT, syncDuty)
      window.removeEventListener('storage', syncDuty)
    }
  }, [])

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
      </nav>

      {checkInOpen && (
        <CheckInOutModal
          locationExternalId={locationId || 'outlet'}
          locationName={locationName}
          onClose={() => setCheckInOpen(false)}
          onDutyChange={setDuty}
        />
      )}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </>
  )
}
