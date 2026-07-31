import { NavLink } from 'react-router-dom'
import { MODE_NAV, NAV_ICONS, type NavIconKey } from '../core/modes/nav'
import { usePosMode } from '../core/modes/ModeProvider'
import { ModeSwitcher } from '../core/modes/ModeSwitcher'
import './Sidebar.css'

type Props = {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const { mode } = usePosMode()
  const groups = MODE_NAV[mode]

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop${open ? ' is-open' : ''}`}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        id="app-side-menu"
        className={`sidebar${open ? ' is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="sidebar__header">
          <span className="sidebar__header-title">Menu</span>
          <button
            type="button"
            className="sidebar__close"
            aria-label="Close menu"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <ModeSwitcher onNavigate={onClose} />

        <nav className="sidebar__nav">
          {groups.map((group) => (
            <div key={group.title} className="sidebar__group">
              <div className="sidebar__group-title">{group.title}</div>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `sidebar__link${isActive ? ' is-active' : ''}`
                      }
                      onClick={onClose}
                    >
                      <span className="sidebar__link-icon">
                        {renderIcon(NAV_ICONS[item.to])}
                      </span>
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="sidebar__badge">{item.badge}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <NavLink
            to="/boh/eod"
            className={({ isActive }) =>
              `sidebar__link sidebar__footer-link${isActive ? ' is-active' : ''}`
            }
            onClick={onClose}
          >
            <span className="sidebar__link-icon">
              <IconEod />
            </span>
            <span>EOD</span>
          </NavLink>
          <NavLink
            to="/boh/settings"
            className={({ isActive }) =>
              `sidebar__link sidebar__footer-link${isActive ? ' is-active' : ''}`
            }
            onClick={onClose}
          >
            <span className="sidebar__link-icon">
              <IconGear />
            </span>
            <span>Config</span>
          </NavLink>
          <button type="button" className="sidebar__logout">
            <IconLogout />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

function renderIcon(key: NavIconKey | undefined) {
  switch (key) {
    case 'order':
      return <IconPos />
    case 'floor':
      return <IconTable />
    case 'floorEdit':
      return <IconFloorEdit />
    case 'calendar':
      return <IconCalendar />
    case 'modifiers':
      return <IconModifiers />
    case 'eightySix':
      return <IconAlert />
    case 'checkout':
      return <IconCard />
    case 'split':
      return <IconSplit />
    case 'tips':
      return <IconTip />
    case 'drawer':
      return <IconDrawer />
    case 'dispatch':
      return <IconBike />
    case 'voids':
      return <IconVoid />
    case 'kiosk':
      return <IconKiosk />
    case 'kioskMenu':
      return <IconPos />
    case 'kioskPay':
      return <IconCard />
    case 'kds':
      return <IconKds />
    case 'bds':
      return <IconBds />
    case 'cds':
      return <IconCds />
    case 'routing':
      return <IconRoute />
    case 'clock':
      return <IconClock />
    case 'reports':
      return <IconChart />
    case 'permissions':
      return <IconUser />
    case 'settings':
      return <IconGear />
    default:
      return <IconPos />
  }
}

function IconPos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 9h16M6 9v10M18 9v10M9 13h6" />
    </svg>
  )
}

function IconFloorEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 9h10M6 9v10M14 9v4" />
      <path d="M14.5 15.5l5-5 2 2-5 5h-2v-2z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function IconModifiers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16M4 12h10M4 17h7" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function IconSplit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v18M5 8l7-4 7 4M5 16l7 4 7-4" />
    </svg>
  )
}

function IconTip() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5" />
    </svg>
  )
}

function IconDrawer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M10 14h4" />
    </svg>
  )
}

function IconBike() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M6 17l3-8h5l3 5h1" />
    </svg>
  )
}

function IconVoid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8" />
      <path d="M8 8l8 8" />
    </svg>
  )
}

function IconKiosk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="6" y="2" width="12" height="16" rx="2" />
      <path d="M9 22h6M12 18v4" />
    </svg>
  )
}

function IconKds() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  )
}

function IconBds() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 8h12v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8z" />
      <path d="M9 8V6a3 3 0 016 0v2M9 13h6M9 16h4" />
    </svg>
  )
}

function IconCds() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M8 10h5M8 13h3" />
    </svg>
  )
}

function IconRoute() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h6a4 4 0 010 8H8" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-4" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  )
}

function IconEod() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M10 7V5a2 2 0 012-2h7v18h-7a2 2 0 01-2-2v-2" />
      <path d="M15 12H3m0 0l3-3m-3 3l3 3" />
    </svg>
  )
}
