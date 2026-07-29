import { useLocation, useNavigate } from 'react-router-dom'
import { MODE_META } from '../core/modes/types'
import { usePosMode } from '../core/modes/ModeProvider'
import './HomeBar.css'

/** Top home screen bar — Home opens the mode home (Order → Floor Plan). */
export function HomeBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { mode, meta } = usePosMode()
  const homePath = MODE_META[mode].homePath
  const isHome = pathname === homePath || (mode === 'order' && pathname === '/order/floor')

  return (
    <div className="home-bar" role="navigation" aria-label="POS home">
      <button
        type="button"
        className={`home-bar__home${isHome ? ' is-active' : ''}`}
        onClick={() => navigate(homePath)}
        aria-current={isHome ? 'page' : undefined}
      >
        <span className="home-bar__home-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
          </svg>
        </span>
        <span className="home-bar__home-label">Home</span>
      </button>

      <div className="home-bar__title">
        <span className="home-bar__screen">
          {isHome ? 'Floor Plan' : screenLabel(pathname)}
        </span>
        <span className="home-bar__mode">{meta.shortLabel}</span>
      </div>
    </div>
  )
}

function screenLabel(pathname: string): string {
  if (pathname.startsWith('/order/register')) return 'Register'
  if (pathname.startsWith('/order/floor')) return 'Floor Plan'
  if (pathname.startsWith('/order/reservations')) return 'Reservations'
  if (pathname.startsWith('/cashier')) return 'Cashier'
  if (pathname.startsWith('/kiosk')) return 'Kiosk'
  if (pathname.startsWith('/boh')) return 'Back of House'
  return 'POS'
}
