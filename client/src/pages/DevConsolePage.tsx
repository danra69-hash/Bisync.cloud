import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { UsageDashboard } from '../components/dev/UsageDashboard';
import { TenantRollupsPanel } from '../components/dev/TenantRollupsPanel';
import { AutomatedQaPanel } from '../components/dev/AutomatedQaPanel';
import { AuditTrailPanel } from '../components/dev/AuditTrailPanel';
import { SystemAuditTrailTab } from '../components/admin/SystemAuditTrailTab';
import { GhostSupportTab } from '../components/admin/GhostSupportTab';
import { DEV_CONSOLE_PATH } from '../config/devConsole';
import { clearDevConsoleSession, getDevConsoleToken } from '../data/devConsoleSession';
import { devConsoleAuthApi } from '../data/devConsoleAuthApi';
import { DevConsoleForbidden, DevConsoleLoginGate } from './DevConsoleLoginGate';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

/** Dev Console always requires its own login (separate from customer Access Control). */
const REQUIRE_DEV_CONSOLE_LOGIN = true;

type DevConsoleTab = 'overview' | 'automated-qa' | 'qa-history' | 'audit-trail' | 'ghost-support';

const DEV_CONSOLE_TABS: { id: DevConsoleTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'automated-qa', label: 'Power-user Automated QA' },
  { id: 'qa-history', label: 'QA History' },
  { id: 'audit-trail', label: 'Audit Trail' },
  { id: 'ghost-support', label: 'Ghost Support' },
];

type DevSessionUser = {
  email: string;
  fullName: string;
  isRoot: boolean;
  expiresAt: string;
};

export function DevConsolePage() {
  const [tab, setTab] = useState<DevConsoleTab>('overview');
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<DevSessionUser | null>(null);
  const [authTick, setAuthTick] = useState(0);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const token = getDevConsoleToken();
      if (!token) {
        setSessionUser(null);
        return;
      }
      const me = await devConsoleAuthApi.me();
      setSessionUser({
        email: me.email,
        fullName: me.fullName,
        isRoot: me.isRoot,
        expiresAt: me.expiresAt,
      });
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

  async function handleLogout() {
    try {
      await devConsoleAuthApi.logout();
    } catch {
      clearDevConsoleSession();
    }
    setSessionUser(null);
    setAuthTick(t => t + 1);
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandEngineLockup size="sm" tone="onLight" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
                Hidden · Dev Team
              </p>
              <h1 className="text-sm font-semibold truncate">Dev Console</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs font-medium">{sessionUser.fullName}</p>
              <p className="text-[11px] text-muted-foreground font-sans">{sessionUser.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Sign out of Dev Console"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px" aria-label="Dev Console sections">
            {DEV_CONSOLE_TABS.map(item => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
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

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        <p className="text-[11px] text-muted-foreground font-sans -mt-4">{DEV_CONSOLE_PATH}</p>
        {tab === 'overview' && (
          <>
            <UsageDashboard />
            <TenantRollupsPanel />
          </>
        )}
        {tab === 'automated-qa' && (
          <AutomatedQaPanel triggeredBy={triggeredBy} />
        )}
        {tab === 'qa-history' && (
          <AuditTrailPanel />
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
      </main>
    </div>
  );
}
