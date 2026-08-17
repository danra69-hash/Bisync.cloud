import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Surface } from '../App';
import { PulseMark } from '../components/PulseMark';

const DEMOS = [
  { email: 'dra@cubevalue.com', label: 'Superuser' },
  { email: 'admin@pulse.club', label: 'Pulse Admin' },
  { email: 'mgmt@pulse.club', label: 'Management' },
  { email: 'accounting@pulse.club', label: 'Accounting' },
  { email: 'sales@pulse.club', label: 'Sales' },
  { email: 'coach@pulse.club', label: 'Coach (no Product)' },
  { email: 'admin@atlas.fit', label: 'Atlas Admin' },
];

export function LoginPage({
  surface,
  onLogin,
  error,
  setError,
}: {
  surface: Surface;
  onLogin: (email: string, password: string) => Promise<void>;
  error: string | null;
  setError: (v: string | null) => void;
}) {
  // Default to admin so Product (and the full module set) is visible on first sign-in.
  // Coach demos still work via the account chips — coaches intentionally lack Product.
  const [email, setEmail] = useState('admin@pulse.club');
  const [password, setPassword] = useState('pulse123');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-copy">
        <div>
          <div className="login-brand">
            <PulseMark size={28} />
            Pulse
          </div>
          <div className="login-hero reveal is-in">
            <p className="eyebrow">Fitness membership ops</p>
            <h1>Run every club from one workbench.</h1>
            <p>
              Multi-tenant membership CRM across companies and locations — role-gated for
              Management, Admin, Accounting, Coaches, and Sales.
            </p>
          </div>
        </div>
        <div className="graphite-band reveal is-in">
          <div className="eyebrow">Surface</div>
          <strong>{surface === 'admin' ? 'Admin desktop' : 'Team webapp'}</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0', color: 'oklch(75% 0.02 250)' }}>
            {surface === 'admin'
              ? 'Electron shell for Admin / Management control plane.'
              : 'Browser workspace for day-to-day team roles.'}
          </p>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card reveal is-in" onSubmit={submit}>
          <p className="eyebrow">Sign in</p>
          <h2>{surface === 'admin' ? 'Admin console' : 'Team portal'}</h2>
          <p className="lede">Use a demo account or your club credentials.</p>
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="form-grid">
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              data-state={busy ? 'loading' : undefined}
            >
              {busy ? 'Signing in…' : 'Enter Pulse'}
            </button>
          </div>
          <div className="demo-users" aria-label="Demo users">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                className="chip"
                onClick={() => {
                  setEmail(d.email);
                  setPassword('pulse123');
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Coach / member app:{' '}
            <a href="/m/" style={{ color: 'inherit', fontWeight: 600 }}>
              mobile.pulse (/m/)
            </a>
          </p>
        </form>
      </section>
    </div>
  );
}
