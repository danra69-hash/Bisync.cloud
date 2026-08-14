import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { ModuleId, User } from '../lib/api';
import type { Surface } from '../App';
import { PulseMark } from './PulseMark';

export function AppShell({
  user,
  surface,
  nav,
  onLogout,
  children,
}: {
  user: User;
  surface: Surface;
  nav: { id: ModuleId; path: string; label: string }[];
  onLogout: () => void;
  children: ReactNode;
}) {
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
      <main className="app-main">{children}</main>
    </div>
  );
}
