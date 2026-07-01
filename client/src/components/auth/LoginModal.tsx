import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';

type Props = {
  onClose: () => void;
};

export function LoginModal({ onClose }: Props) {
  const { login } = useCurrentUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-herme-ink/40 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative w-full max-w-md rounded-2xl border border-herme-muted/60 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-herme-ink/40 transition-colors hover:bg-herme-light hover:text-herme-ink disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <form onSubmit={handleSubmit} className="p-8 pt-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-herme">Sign in</p>
          <h2 id="login-title" className="mt-1 text-2xl font-bold text-herme-ink">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-herme-ink/60">
            Enter your platform credentials to access Bisync.cloud.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                Username (email)
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                placeholder="you@bisync.cloud"
                required
                className="w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 pr-11 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-herme-ink/35 hover:text-herme-ink/60"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-herme px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-herme-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
