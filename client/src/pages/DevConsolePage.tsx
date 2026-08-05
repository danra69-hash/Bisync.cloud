import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Users } from 'lucide-react';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { contentFrameClass } from '../components/layout/pageLayout';
import { UsageDashboard } from '../components/dev/UsageDashboard';
import { TenantRollupsPanel } from '../components/dev/TenantRollupsPanel';
import { DemoLaunchPanel } from '../components/dev/DemoLaunchPanel';
import { AutomatedQaPanel } from '../components/dev/AutomatedQaPanel';
import { SystemAuditTrailTab } from '../components/admin/SystemAuditTrailTab';
import { GhostSupportTab } from '../components/admin/GhostSupportTab';
import { RefLibraryTab } from '../components/dev/RefLibraryTab';
import { SalesModulePage } from '../components/revenue/SalesModulePage';
import { DevTeamPanel } from '../components/dev/DevTeamPanel';
import { DevConsoleChangePasswordModal } from '../components/dev/DevConsoleChangePasswordModal';
import { DEV_CONSOLE_PATH } from '../config/devConsole';
import { clearDevConsoleSession, getDevConsoleToken } from '../data/devConsoleSession';
import {
  DEV_CONSOLE_TAB_IDS,
  normalizeDevConsoleAccessTabs,
  type DevConsoleTabId,
  devConsoleAuthApi,
} from '../data/devConsoleAuthApi';
import {
  DevConsoleForbidden,
  DevConsoleLoginGate,
  parseDevConsoleTokenPath,
} from './DevConsoleLoginGate';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

/** Dev Console always requires its own login (separate from customer Access Control). */
const REQUIRE_DEV_CONSOLE_LOGIN = true;

type DevConsoleTab = DevConsoleTabId;

const DEV_CONSOLE_TABS: { id: DevConsoleTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tenant-rollups', label: 'Tenant Rollups' },
  { id: 'sales-module', label: 'Sales Module' },
  { id: 'automated-qa', label: 'Automated QA' },
  { id: 'audit-trail', label: 'Audit Trail' },
  { id: 'ghost-support', label: 'Ghost Support' },
  { id: 'ref-library', label: 'Ref & Library' },
];

type DevSessionUser = {
  email: string;
  fullName: string;
  position: string;
  teamType: string;
  isRoot: boolean;
  accessTabs: string[];
  expiresAt: string;
  mustChangePassword: boolean;
};

export function DevConsolePage() {
  const tokenPath = parseDevConsoleTokenPath(window.location.pathname);
  const [tab, setTab] = useState<DevConsoleTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<DevSessionUser | null>(null);
  const [authTick, setAuthTick] = useState(0);
  const [teamOpen, setTeamOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const token = getDevConsoleToken();
      if (!token) {
        setSessionUser(null);
        return;
      }
      const me = await devConsoleAuthApi.me();
      const nextUser: DevSessionUser = {
        email: me.email,
        fullName: me.fullName,
        position: me.position ?? '',
        teamType: me.teamType ?? '',
        isRoot: me.isRoot,
        accessTabs: me.isRoot
          ? [...DEV_CONSOLE_TAB_IDS]
          : (() => {
              const normalized = normalizeDevConsoleAccessTabs(me.accessTabs);
              return normalized.length > 0 ? normalized : ['overview'];
            })(),
        expiresAt: me.expiresAt,
        mustChangePassword: me.mustChangePassword === true,
      };
      setSessionUser(nextUser);
      if (nextUser.mustChangePassword) {
        setChangePasswordOpen(true);
      }
    } catch {
      clearDevConsoleSession();
      setSessionUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession, authTick]);

  const visibleTabs = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.isRoot) return DEV_CONSOLE_TABS;
    const allowed = new Set(sessionUser.accessTabs.map(t => t.toLowerCase()));
    return DEV_CONSOLE_TABS.filter(t => allowed.has(t.id));
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser || visibleTabs.length === 0) return;
    if (!visibleTabs.some(t => t.id === tab)) {
      setTab(visibleTabs[0]!.id);
    }
  }, [sessionUser, visibleTabs, tab]);

  async function handleLogout() {
    try {
      await devConsoleAuthApi.logout();
    } catch {
      clearDevConsoleSession();
    }
    setSessionUser(null);
    setAuthTick(t => t + 1);
  }

  if (tokenPath) {
    return (
      <DevConsoleLoginGate
        mode={tokenPath.kind}
        token={tokenPath.token}
        onSuccess={() => {
          window.history.replaceState({}, '', DEV_CONSOLE_PATH);
          setAuthTick(t => t + 1);
        }}
      />
    );
  }

  if (REQUIRE_DEV_CONSOLE_LOGIN) {
    if (loading) {
      return <MillstoneLoader layout="screen" size="lg" label="Loading developer console…" />;
    }
    if (!sessionUser) {
      return <DevConsoleLoginGate onSuccess={() => setAuthTick(t => t + 1)} />;
    }
  }

  if (!sessionUser) {
    return <DevConsoleForbidden />;
  }

  const triggeredBy = sessionUser.fullName || sessionUser.email || 'Dev Console';

  return (
    <div className="min-h-screen w-full max-w-none bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10 w-full">
        <div className={contentFrameClass('py-3 flex items-center justify-between gap-3')}>
          <div className="flex items-center gap-3 min-w-0">
            <BrandEngineLockup size="sm" tone="onLight" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
                Hidden · Dev Team
              </p>
              <h1 className="text-sm font-semibold truncate">Dev Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left hover:bg-muted/50"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  {(sessionUser.fullName || sessionUser.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="text-right hidden sm:block min-w-0">
                  <p className="text-xs font-medium truncate max-w-[10rem]">{sessionUser.fullName}</p>
                  <p className="text-[11px] text-muted-foreground font-sans truncate max-w-[10rem]">
                    {sessionUser.email}
                  </p>
                </div>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {profileOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close profile menu"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card py-1 shadow-lg"
                  >
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium truncate">{sessionUser.fullName}</p>
                      <p className="text-[11px] text-muted-foreground font-sans truncate">{sessionUser.email}</p>
                      {(sessionUser.position || sessionUser.teamType) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {[sessionUser.position, sessionUser.teamType].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/60"
                      onClick={() => {
                        setProfileOpen(false);
                        setChangePasswordOpen(true);
                      }}
                    >
                      <KeyRound size={12} />
                      Change password
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      onClick={() => {
                        setProfileOpen(false);
                        void handleLogout();
                      }}
                    >
                      <LogOut size={12} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={contentFrameClass()}>
          <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Dev Console sections">
            {visibleTabs.map(item => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className={contentFrameClass('py-6 space-y-10')}>
        <p className="text-[11px] text-muted-foreground font-sans -mt-4">{DEV_CONSOLE_PATH}</p>
        {tab === 'overview' && (
          <>
            {sessionUser.isRoot && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Team</p>
                  <p className="text-xs text-muted-foreground">
                    Create Dev Console operators with tab access. Default password is Pass@123; members must change it after first login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-2 shrink-0"
                >
                  <Users size={13} />
                  Team
                </button>
              </div>
            )}
            <DemoLaunchPanel isRoot={sessionUser.isRoot} />
            <UsageDashboard />
          </>
        )}
        {tab === 'tenant-rollups' && (
          <TenantRollupsPanel />
        )}
        {tab === 'sales-module' && (
          <SalesModulePage
            sessionEmail={sessionUser.email}
            sessionName={sessionUser.fullName}
          />
        )}
        {tab === 'automated-qa' && (
          <AutomatedQaPanel triggeredBy={triggeredBy} />
        )}
        {tab === 'audit-trail' && (
          <SystemAuditTrailTab allowDevConsoleAccess />
        )}
        {tab === 'ghost-support' && (
          <GhostSupportTab
            allowDevConsoleAccess
            isDevConsoleRoot={sessionUser.isRoot}
            devConsoleEmail={sessionUser.email}
          />
        )}
        {tab === 'ref-library' && (
          <RefLibraryTab />
        )}
      </main>

      <DevTeamPanel open={teamOpen} onClose={() => setTeamOpen(false)} />
      <DevConsoleChangePasswordModal
        open={changePasswordOpen}
        required={sessionUser.mustChangePassword}
        onClose={() => {
          if (sessionUser.mustChangePassword) return;
          setChangePasswordOpen(false);
        }}
        onSuccess={() => {
          setSessionUser(prev => (prev ? { ...prev, mustChangePassword: false } : prev));
          setChangePasswordOpen(false);
          void refreshSession();
        }}
      />
    </div>
  );
}
