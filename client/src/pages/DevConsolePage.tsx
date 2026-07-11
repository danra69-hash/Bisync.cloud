import { useMemo, useState } from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { UsageDashboard } from '../components/dev/UsageDashboard';
import { AutomatedQaPanel } from '../components/dev/AutomatedQaPanel';
import { DEV_CONSOLE_PATH } from '../config/devConsole';
import { canAccessDevConsole } from '../data/devTeamAccess';
import { parseUserAccess } from '../data/userAccess';
import { useCurrentUser } from '../hooks/useCurrentUser';

/**
 * Set to `true` when reactivating Dev Console login / Dev Team gate.
 */
const REQUIRE_DEV_CONSOLE_LOGIN = false;

function DevLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock size={16} />
          <span className="text-[11px] uppercase tracking-widest font-sans">Dev Team only</span>
        </div>
        <h1 className="text-lg font-semibold">Sign in to Dev Console</h1>
        <p className="text-xs text-muted-foreground">
          Hidden console at <span className="font-sans">{DEV_CONSOLE_PATH}</span>. Not linked from the main app.
        </p>
        {error && (
          <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>
        )}
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary text-primary-foreground text-sm font-medium py-2 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function DevForbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-3">
        <Shield size={28} className="mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Dev Team access required</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in, but this console is limited to Dev Team accounts.
        </p>
        <a href="/" className="inline-block text-xs text-primary hover:underline">Back to app</a>
      </div>
    </div>
  );
}

export function DevConsolePage() {
  const { currentUser, isAuthenticated, loading } = useCurrentUser();
  const [tick, setTick] = useState(0);
  const allowed = useMemo(
    () => canAccessDevConsole(currentUser, currentUser ? parseUserAccess(currentUser.accessJson) : undefined),
    [currentUser, tick],
  );

  if (REQUIRE_DEV_CONSOLE_LOGIN) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      );
    }
    if (!isAuthenticated || !currentUser) {
      return <DevLoginGate onSuccess={() => setTick(t => t + 1)} />;
    }
    if (!allowed) {
      return <DevForbidden />;
    }
  }

  const triggeredBy = currentUser?.fullName || currentUser?.email || 'Dev Console';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandEngineLockup size="sm" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
                Hidden · Dev Team{!REQUIRE_DEV_CONSOLE_LOGIN ? ' · auth paused' : ''}
              </p>
              <h1 className="text-sm font-semibold truncate">Dev Console</h1>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium">{currentUser?.fullName ?? 'Guest access'}</p>
            <p className="text-[11px] text-muted-foreground font-sans">{DEV_CONSOLE_PATH}</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-10">
        <UsageDashboard />
        <AutomatedQaPanel triggeredBy={triggeredBy} />
      </main>
    </div>
  );
}
