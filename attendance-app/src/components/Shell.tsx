import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { useLocationFilter } from '../auth/LocationProvider'
import { LocationSelect } from './LocationSelect'
import { OrderNotificationBell } from './OrderNotificationBell'

export type NavItem = {
  to: string
  label: string
  icon: 'home' | 'newOrder' | 'stock' | 'lookup' | 'sales' | 'clock'
}

function NavIcon({ name }: { name: NavItem['icon'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h5.5v-6h3V21H19V9.5" />
        </svg>
      )
    case 'newOrder':
      return (
        <svg {...common}>
          <path d="M8 6h11v14H8z" />
          <path d="M5 4h11v2" />
          <path d="M11 11h5M11 15h5M11 19h3" />
        </svg>
      )
    case 'stock':
      return (
        <svg {...common}>
          <path d="M4 7h16v3H4z" />
          <path d="M4 12h16v3H4z" />
          <path d="M4 17h16v3H4z" />
          <path d="M8 7v13M16 7v13" />
        </svg>
      )
    case 'sales':
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4M12 15V8M16 15v-6" />
        </svg>
      )
    case 'lookup':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16.5 16.5 21 21" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 1.5" />
        </svg>
      )
    default:
      return null
  }
}

export function Shell({
  nav,
  attendanceLocal = false,
}: {
  nav: NavItem[]
  /** Clock-only local product — hide RMS order chrome. */
  attendanceLocal?: boolean
}) {
  const { usageRole, setUsageRole, session } = useAuth()
  const {
    locations,
    selectedLocationId,
    setSelectedLocationId,
    loading: locationsLoading,
  } = useLocationFilter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  function switchUsage() {
    const next = usageRole === 'vendor' ? 'operator' : 'vendor'
    queryClient.clear()
    setUsageRole(next)
    navigate(
      attendanceLocal
        ? '/clock'
        : next === 'vendor'
          ? '/vendor'
          : '/operator',
    )
  }

  useEffect(() => {
    const root = document.documentElement
    root.dataset.role = usageRole
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      themeMeta.setAttribute(
        'content',
        usageRole === 'vendor' ? '#00ae48' : '#2c1a0a',
      )
    }
    return () => {
      root.removeAttribute('data-role')
    }
  }, [usageRole])

  return (
    <div className="shell" data-role={usageRole}>
      <header className="topbar">
        <Link
          to={attendanceLocal ? '/clock' : usageRole === 'vendor' ? '/vendor' : '/operator'}
          className="brand-link"
        >
          <img src="/bisync-logo-white.png" alt="Bisync" className="brand-logo" />
        </Link>

        {!attendanceLocal && (
          <button
            type="button"
            className="btn btn-usage"
            onClick={switchUsage}
            title="Switch Operator / Vendor"
          >
            <span className="usage-value">
              {usageRole === 'vendor' ? 'Vendor' : 'Operator'}
            </span>
            <span className="usage-swap" aria-hidden>
              ⇄
            </span>
          </button>
        )}

        <LocationSelect
          locations={locations || []}
          selectedLocationId={selectedLocationId}
          onChange={setSelectedLocationId}
          loading={locationsLoading}
          emptyLabel={
            attendanceLocal
              ? 'No company locations'
              : usageRole === 'vendor'
                ? 'No clients'
                : 'No locations'
          }
          ariaLabel={
            attendanceLocal
              ? 'Company location'
              : usageRole === 'vendor'
                ? 'Client'
                : 'Location'
          }
          placeholderLabel={attendanceLocal ? 'Company location' : undefined}
        />

        {!attendanceLocal && <OrderNotificationBell />}

        <Link
          to="/profile"
          className="topbar-avatar-link"
          title={session?.fullName || 'My Profile'}
          aria-label="My Profile"
        >
          <img
            src={session?.profileImage || '/default-profile.png'}
            alt=""
            className="topbar-avatar"
            onError={(e) => {
              e.currentTarget.src = '/default-profile.png'
            }}
          />
        </Link>
      </header>

      <main className="shell-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/operator' || item.to === '/vendor' || item.to === '/clock'}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
