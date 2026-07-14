import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { BrandEngineLockup } from '../components/layout/BrandEngineLockup';
import { DEV_CONSOLE_PATH } from '../config/devConsole';
import { devConsoleAuthApi, type PasswordLoginResult } from '../data/devConsoleAuthApi';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gis]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGis = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

type Step = 'password' | 'google';

export function DevConsoleLoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<PasswordLoginResult | null>(null);
  const [domains, setDomains] = useState<string[]>(['cubevalue.com', 'pasar.ai']);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    devConsoleAuthApi.config()
      .then(cfg => {
        if (cfg.allowedDomains?.length) setDomains(cfg.allowedDomains);
      })
      .catch(() => { /* ignore */ });
  }, []);

  const finishGoogle = useCallback(async (credential: string) => {
    if (!ticket) return;
    setSubmitting(true);
    setError(null);
    try {
      await devConsoleAuthApi.completeGoogle(ticket.passwordTicket, credential);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setSubmitting(false);
    }
  }, [ticket, onSuccess]);

  useEffect(() => {
    if (step !== 'google' || !ticket) return;
    const clientId = ticket.googleClientId?.trim()
      || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
      || '';
    if (!clientId || ticket.allowPasswordOnly && !ticket.googleRequired) return;

    let cancelled = false;
    (async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: res => {
            void finishGoogle(res.credential);
          },
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google Sign-In unavailable');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, ticket, finishGoogle]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await devConsoleAuthApi.passwordLogin(email.trim(), password);
      setTicket(result);
      if (result.googleRequired && result.googleClientId) {
        setStep('google');
      } else if (result.allowPasswordOnly) {
        await devConsoleAuthApi.completePasswordOnly(result.passwordTicket);
        onSuccess();
      } else {
        setError('Google Sign-In is required but Google Client ID is not configured on the server.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordOnlyContinue() {
    if (!ticket) return;
    setSubmitting(true);
    setError(null);
    try {
      await devConsoleAuthApi.completePasswordOnly(ticket.passwordTicket);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock size={16} />
          <span className="text-[11px] uppercase tracking-widest font-sans">Dev Team only</span>
        </div>
        <BrandEngineLockup size="sm" tone="onLight" />
        <h1 className="text-lg font-semibold">Sign in to Dev Console</h1>
        <p className="text-xs text-muted-foreground">
          Separate from customer app login. Emails must be @{domains.join(' or @')}.
          Path: <span className="font-sans">{DEV_CONSOLE_PATH}</span>
        </p>

        {error && (
          <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={handlePassword} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder={`you@${domains[0] ?? 'cubevalue.com'}`}
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
              {submitting ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 'google' && ticket && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p className="font-medium">{ticket.fullName}</p>
              <p className="text-muted-foreground font-sans">{ticket.email}</p>
              <p className="text-muted-foreground">Password verified. Complete Google Sign-In with the same email.</p>
            </div>
            <div ref={googleBtnRef} className="flex justify-center min-h-[44px]" />
            {ticket.allowPasswordOnly && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handlePasswordOnlyContinue()}
                className="w-full rounded-md border border-border text-sm py-2 disabled:opacity-50"
              >
                Continue without Google (local only)
              </button>
            )}
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:underline"
              onClick={() => {
                setStep('password');
                setTicket(null);
                setError(null);
              }}
            >
              Use a different account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DevConsoleForbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center space-y-3">
        <Shield size={28} className="mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Dev Team access required</h1>
        <p className="text-sm text-muted-foreground">
          This console is limited to Dev Team accounts managed by the root Super User.
        </p>
        <a href="/" className="inline-block text-xs text-primary hover:underline">Back to app</a>
      </div>
    </div>
  );
}
