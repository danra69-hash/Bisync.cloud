import { useNavigate } from 'react-router-dom'
import { usePosSessionOptional } from '../core/session/PosSessionContext'
import './TopBar.css'

type Props = {
  menuOpen: boolean
  onToggleMenu: () => void
}

export function TopBar({ menuOpen, onToggleMenu }: Props) {
  const navigate = useNavigate()
  const session = usePosSessionOptional()
  const locations = session?.locations ?? []
  const locationId = session?.locationId ?? ''

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <img
          src="/bisync-logo.png"
          alt="Bisync"
          className="topbar__logo-img"
        />
        <span className="topbar__name">POS</span>
      </div>

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
          className="topbar__setup"
          onClick={() => navigate('/boh/settings')}
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
