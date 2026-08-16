import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { Membership, ModuleId, User } from '../lib/api';
import type { Surface } from '../App';
import { PulseMark } from './PulseMark';

export function AppShell({
  user,
  surface,
  nav,
  memberships,
  companyId,
  locationId,
  onCompanyChange,
  onLocationChange,
  onLogout,
  children,
}: {
  user: User;
  surface: Surface;
  nav: { id: ModuleId; path: string; label: string }[];
  memberships: Membership[];
  companyId: string | null;
  locationId: string | null;
  onCompanyChange: (companyId: string) => void;
  onLocationChange: (locationId: string | null) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const membership = memberships.find((m) => m.companyId === companyId) || memberships[0];
  const locations = membership?.locations ?? [];
  const companyWide = user.role === 'management' || user.role === 'admin' || user.role === 'accounting';

  return (
    <div className="app-shell">
      <header className="topnav">
        <div className="topnav-brand">
          <PulseMark />
          <span>Pulse</span>
          <span className="surface-pill">{surface === 'admin' ? 'Admin desktop' : 'Team web'}</span>
        </div>
        <nav className="topnav-links" aria-label="Modules">
          {nav.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/app'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topnav-tenant" aria-label="Company and location">
          <label className="tenant-field">
            <span className="eyebrow">Company</span>
            <select
              value={companyId || ''}
              onChange={(e) => onCompanyChange(e.target.value)}
              aria-label="Company"
            >
              {memberships.map((m) => (
                <option key={m.companyId} value={m.companyId}>
                  {m.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="tenant-field">
            <span className="eyebrow">Location</span>
            <select
              value={locationId || 'all'}
              onChange={(e) => onLocationChange(e.target.value === 'all' ? null : e.target.value)}
              aria-label="Location"
            >
              {companyWide ? <option value="all">All locations</option> : null}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="topnav-user">
          <div>
            <strong>{user.name}</strong>
            <div className="eyebrow role-label">{user.roleLabel}</div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main" key={`${companyId || ''}:${locationId || 'all'}`}>
        {children}
      </main>
    </div>
  );
}
