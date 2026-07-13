import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { api } from '../../api';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  onClose: () => void;
  onOpenLogin?: () => void;
};

export function RegisterModal({ onClose, onOpenLogin }: Props) {
  const { t } = useAppTranslation();
  const surnameRef = useRef<HTMLInputElement>(null);
  const [surname, setSurname] = useState('');
  const [givenName, setGivenName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => surnameRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.register({
        surname,
        givenName,
        email,
        mobile,
        password,
        confirmPassword,
      });
      setSuccessEmail(result.email);
      setActivationUrl(result.activationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme';

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
        aria-labelledby="register-title"
        className="relative w-full max-w-lg rounded-2xl border border-herme-muted/60 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-herme-ink/40 transition-colors hover:bg-herme-light hover:text-herme-ink disabled:opacity-50"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        {successEmail ? (
          <div className="p-8 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9963A]">{t('auth.register')}</p>
            <h2 id="register-title" className="mt-1 text-2xl font-bold text-herme-ink">
              {t('auth.checkEmailTitle')}
            </h2>
            <p className="mt-2 text-sm text-herme-ink/60">
              {t('auth.checkEmailBody', { email: successEmail })}
            </p>
            {activationUrl && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-semibold">{t('auth.activationLinkHint')}</p>
                <a
                  href={activationUrl}
                  className="mt-2 block break-all text-[#C9963A] underline hover:text-[#A87A2E]"
                >
                  {activationUrl}
                </a>
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLogin?.();
                }}
                className="rounded-xl bg-herme px-4 py-3 text-sm font-semibold text-white hover:bg-herme-dark"
              >
                {t('auth.goToLogin')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-herme-muted/70 px-4 py-3 text-sm font-semibold text-herme-ink/70 hover:bg-herme-cream"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9963A]">{t('auth.createAccount')}</p>
            <h2 id="register-title" className="mt-1 text-2xl font-bold text-herme-ink">
              {t('auth.registerTitle')}
            </h2>
            <p className="mt-2 text-sm text-herme-ink/60">{t('auth.registerHint')}</p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-surname" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                    {t('auth.surname')}
                  </label>
                  <input
                    ref={surnameRef}
                    id="reg-surname"
                    value={surname}
                    onChange={e => { setSurname(e.target.value); setError(null); }}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="reg-given" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                    {t('auth.givenName')}
                  </label>
                  <input
                    id="reg-given"
                    value={givenName}
                    onChange={e => { setGivenName(e.target.value); setError(null); }}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.emailAddress')}
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="reg-mobile" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.mobileNumber')}
                </label>
                <input
                  id="reg-mobile"
                  type="tel"
                  autoComplete="tel"
                  value={mobile}
                  onChange={e => { setMobile(e.target.value); setError(null); }}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.createPassword')}
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    required
                    minLength={8}
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-herme-ink/35 hover:text-herme-ink/60"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-confirm" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
                  required
                  minLength={8}
                  className={inputCls}
                />
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
              className="mt-6 w-full rounded-xl bg-[#C9963A] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#A87A2E] disabled:opacity-60"
            >
              {submitting ? t('auth.registering') : t('auth.registerButton')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
