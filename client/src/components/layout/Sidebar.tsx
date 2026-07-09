import { X } from 'lucide-react';
import { NAV_ITEMS, type NavItem } from '../../data/revenueManagement';
import { isNavItemEnabled } from '../../data/companyModules';
import type { AccessModule } from '../../data/userAccess';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { userInitials } from '../../context/currentUserContext';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  open: boolean;
  activeNav: NavItem;
  enabledModules: AccessModule[];
  onClose: () => void;
  onNavigate: (item: NavItem) => void;
};

export function Sidebar({ open, activeNav, enabledModules, onClose, onNavigate }: Props) {
  const { t, navLabel } = useAppTranslation();
  const { currentUser, users, setCurrentUserId, logout } = useCurrentUser();
  const displayName = currentUser?.fullName ?? t('common.unknownUser');
  const displayRole = currentUser?.role ?? '—';

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <aside
        className={`fixed top-0 left-0 h-full w-56 z-50 transition-transform duration-200 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#2C1A0A' }}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
          <span className="text-white font-bold text-sm tracking-tight">Bisync.cloud</span>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10">
            <X size={14} className="text-white/60" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const enabled = isNavItemEnabled(item, enabledModules);
            const isActive = activeNav === item;
            return (
            <button
              key={item}
              type="button"
              disabled={!enabled}
              onClick={() => { if (enabled) onNavigate(item); onClose(); }}
              title={!enabled ? t('common.moduleNotEnabled') : undefined}
              className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: isActive && enabled ? '#E87722' : 'transparent',
                color: isActive && enabled ? '#2C1A0A' : 'rgba(255,255,255,0.6)',
                fontWeight: isActive && enabled ? 700 : 500,
              }}
            >
              {navLabel(item)}
            </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#E87722', color: '#2C1A0A' }}>
              {userInitials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-white/45 truncate">{displayRole}</p>
            </div>
          </div>
          {users.length > 1 && (
            <select
              value={currentUser?.id ?? ''}
              onChange={e => setCurrentUserId(Number(e.target.value))}
              className="w-full rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              title={t('common.switchUser')}
            >
              {users.map(user => (
                <option key={user.id} value={user.id} style={{ color: '#1a1a1a', background: '#ffffff' }}>
                  {user.fullName}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('common.logOut')}
          </button>
        </div>
      </aside>
    </>
  );
}
