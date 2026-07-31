import { useEffect, useState } from 'react'
import {
  PERMISSION_LABEL,
  ROLE_PERMISSIONS,
  type PermissionAction,
  type StaffRole,
} from '../domain/permissions'
import {
  bumpKitchenTicket,
  KDS_TICKETS_EVENT,
  loadKitchenTickets,
  ticketAgeLabel,
  type KitchenTicket,
} from '../domain/kitchenTickets'
import { FeaturePage } from '../../common/FeaturePage'
import { useConfig } from '../../../core/config/ConfigProvider'
import type { QrTableMode } from '../../../core/config/qrTable'
import { ColGroup } from '../../../../components/shared/SortableTableHead'
import './BohPages.css'

export function KdsPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>(() => loadKitchenTickets())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    function refresh() {
      setTickets(loadKitchenTickets())
    }
    window.addEventListener(KDS_TICKETS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    const ageId = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      window.removeEventListener(KDS_TICKETS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.clearInterval(ageId)
    }
  }, [])

  const openTickets = tickets.filter(t => t.status === 'open')

  return (
    <FeaturePage
      crumb="BOH / Kitchen Display"
      title="Kitchen Order Routing (KDS)"
      subtitle="Saved register orders route here — Beverage to Bar, Food to Kitchen."
    >
      {openTickets.length === 0 ? (
        <p className="kds-empty">No open tickets. Save an order on the register to fire Bar / Kitchen.</p>
      ) : (
        <div className="kds-board">
          {openTickets.map(ticket => (
            <article key={ticket.id} className="kds-ticket">
              <header>
                <strong>#{ticket.checkNumber}</strong>
                <span>{ticket.station}</span>
                <em>{ticketAgeLabel(ticket.createdAt, now)}</em>
              </header>
              <p className="kds-ticket__meta">
                {ticket.tableLabel}
                {ticket.dining ? ` · ${ticket.dining}` : ''}
              </p>
              <ul>
                {ticket.items.map(item => (
                  <li key={`${ticket.id}-${item.name}`}>
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="chip-btn chip-btn--primary"
                onClick={() => {
                  bumpKitchenTicket(ticket.id)
                  setTickets(loadKitchenTickets())
                }}
              >
                Bump
              </button>
            </article>
          ))}
        </div>
      )}
    </FeaturePage>
  )
}

export function RoutingPage() {
  return (
    <FeaturePage
      crumb="BOH / Routing"
      title="Order Routing Rules"
      subtitle="Send drinks to the bar, apps to fry, and mains to the grill — configurable by menu category."
    >
      <div className="panel-grid">
        {[
          ['Beverages', 'Bar'],
          ['Salads', 'Cold station'],
          ['Pizza / Fry', 'Fry / oven'],
          ['Soup / Rice', 'Expo / hot line'],
        ].map(([from, to]) => (
          <div key={from} className="panel-card">
            <h3>{from}</h3>
            <p>Routes to → {to}</p>
          </div>
        ))}
      </div>
    </FeaturePage>
  )
}

export function TimeClockPage() {
  return (
    <FeaturePage
      crumb="BOH / Time Clock"
      title="Time Clock & Labor"
      subtitle="Clock in/out with PIN or swipe, and track labor cost against live sales."
    >
      <div className="clock-pad panel-card">
        <h3>Staff PIN</h3>
        <div className="clock-pad__dots" aria-hidden>
          <span /><span /><span /><span />
        </div>
        <div className="clock-pad__grid">
          {['1','2','3','4','5','6','7','8','9','C','0','↵'].map((key) => (
            <button key={key} type="button" className="clock-pad__key">
              {key}
            </button>
          ))}
        </div>
        <div className="cashier-actions">
          <button type="button" className="chip-btn chip-btn--primary">Clock In</button>
          <button type="button" className="chip-btn">Clock Out</button>
        </div>
      </div>
    </FeaturePage>
  )
}

export function ReportsPage() {
  return (
    <FeaturePage
      crumb="BOH / Reports"
      title="Cloud Reporting & Analytics"
      subtitle="Daily sales, top items, server performance, and peak service hours."
    >
      <div className="panel-grid">
        {[
          ['Today sales', '$4,820'],
          ['Top item', 'Basil Salad'],
          ['Covers', '186'],
          ['Peak hour', '19:00–20:00'],
          ['Server lead', 'Maya · $1,240'],
          ['Labor %', '28%'],
        ].map(([label, value]) => (
          <div key={label} className="panel-card">
            <p>{label}</p>
            <h3 style={{ fontSize: '1.4rem', marginTop: 8 }}>{value}</h3>
          </div>
        ))}
      </div>
    </FeaturePage>
  )
}

export function PermissionsPage() {
  const roles = Object.keys(ROLE_PERMISSIONS) as StaffRole[]
  const actions = Object.keys(PERMISSION_LABEL) as PermissionAction[]

  return (
    <FeaturePage
      crumb="BOH / Permissions"
      title="User Permissions"
      subtitle="Restrict refunds, large voids, comps, and drawer opens to the right roles."
    >
      <div className="perm-table-wrap">
        <table className="perm-table">
          <ColGroup
            widths={[
              '28%',
              ...roles.map(() => `${(72 / Math.max(roles.length, 1)).toFixed(2)}%`),
            ]}
          />
          <thead>
            <tr>
              <th>Action</th>
              {roles.map((role) => (
                <th key={role}>{role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action}>
                <td>{PERMISSION_LABEL[action]}</td>
                {roles.map((role) => (
                  <td key={role}>
                    {ROLE_PERMISSIONS[role].includes(action) ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FeaturePage>
  )
}

export { EodPage } from './EodPage'

export function BohSettingsPage() {
  const { qrTableMode, setQrTableMode } = useConfig()

  return (
    <FeaturePage
      crumb="POS Setup"
      title="POS Setup"
      subtitle="Restaurant-wide settings for table QR, menus, printers, and integrations."
    >
      <section className="config-section panel-card">
        <h3>Table QR mode</h3>
        <p className="config-section__copy">
          Choose how dine-in table QR codes work. There is no QR Order box — only Fixed or Dynamic table QR.
        </p>
        <div className="qr-mode-switch" role="radiogroup" aria-label="Table QR mode">
          <button
            type="button"
            role="radio"
            aria-checked={qrTableMode === 'fixed'}
            className={`qr-mode-switch__option${qrTableMode === 'fixed' ? ' is-active' : ''}`}
            onClick={() => setQrTableMode('fixed')}
          >
            <strong>Fixed QR table</strong>
            <span>
              Print a permanent QR from the Floor Plan using Location, Date, and Table Number.
              It stays the same until you print again. Opening a table does not ask for pax or print.
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={qrTableMode === 'dynamic'}
            className={`qr-mode-switch__option${qrTableMode === 'dynamic' ? ' is-active' : ''}`}
            onClick={() => setQrTableMode('dynamic')}
          >
            <strong>Dynamic QR table</strong>
            <span>
              When a table transaction starts, ask for number of pax and print a QR immediately
              using Time, Date, and Table Number.
            </span>
          </button>
        </div>
        <p className="config-section__hint">
          Current: <strong>{labelMode(qrTableMode)}</strong>
        </p>
      </section>

      <div className="panel-grid" style={{ marginTop: 20 }}>
        {['Menus & dayparts', 'Tax & service charge', 'Printers / KDS', 'Delivery apps'].map(
          (label) => (
            <div key={label} className="panel-card">
              <h3>{label}</h3>
              <p>Configuration placeholder</p>
            </div>
          ),
        )}
      </div>
    </FeaturePage>
  )
}

function labelMode(mode: QrTableMode) {
  return mode === 'fixed' ? 'Fixed QR table' : 'Dynamic QR table'
}
