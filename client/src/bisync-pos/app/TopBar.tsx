import { useLocation, useNavigate } from 'react-router-dom'
import { MODE_META } from '../core/modes/types'
import { usePosMode } from '../core/modes/ModeProvider'
import { usePosSessionOptional } from '../core/session/PosSessionContext'
import './TopBar.css'

type Props = {
  menuOpen: boolean
  onToggleMenu: () => void
}

export function TopBar({ menuOpen, onToggleMenu }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { setMode } = usePosMode()
  const session = usePosSessionOptional()
  const locations = session?.locations ?? []
  const locationId = session?.locationId ?? ''
  /** Venue home is always Floor Plan (not mode-specific BOH/Cashier homes). */
  const homePath = MODE_META.order.homePath
  const isHome =
    pathname === '/order/floor'
    || (pathname.startsWith('/order/floor') && !pathname.includes('/edit'))
  const isSetup = pathname.startsWith('/boh/settings')

  function goHome() {
    setMode('order')
    navigate(homePath)
  }

  function goSetup() {
    setMode('boh')
    navigate('/boh/settings')
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand"
        onClick={goHome}
        aria-label="Go to POS home"
      >
        <img
          src="/bisync-logo.png"
          alt="Bisync"
          className="topbar__logo-img"
        />
        <span className="topbar__name">POS</span>
      </button>

      <div className="topbar__controls">
        <label className="topbar__location">
          <span className="topbar__location-label">Location</span>
          <select
            value={locationId}
            disabled={!session || locations.length === 0}
            onChange={e => session?.setLocationId(e.target.value)}
            aria-label="POS location filter"
          >
            {locations.length === 0 ? (
              <option value="">No locations</option>
            ) : (
              locations.map(loc => (
                <option key={loc.externalId} value={loc.externalId}>
                  {loc.name}
                </option>
              ))
            )}
          </select>
        </label>

        <button
          type="button"
          className={`topbar__setup${isSetup ? ' is-active' : ''}`}
          onClick={goSetup}
          aria-current={isSetup ? 'page' : undefined}
        >
          POS Setup
        </button>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__actions">
        <button type="button" className="topbar__icon-btn" aria-label="Toggle theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
        <button type="button" className="topbar__icon-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M6 9a6 6 0 0112 0c0 7 3 7 3 7H3s3 0 3-7" />
            <path d="M10 19a2 2 0 004 0" />
          </svg>
          <span className="topbar__dot" />
        </button>
        <button
          type="button"
          className={`topbar__home${isHome ? ' is-active' : ''}`}
          onClick={goHome}
          aria-label="Home"
          aria-current={isHome ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
          </svg>
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`topbar__admin${menuOpen ? ' is-open' : ''}`}
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-controls="app-side-menu"
        >
          Admin
        </button>
      </div>
    </header>
  )
}
