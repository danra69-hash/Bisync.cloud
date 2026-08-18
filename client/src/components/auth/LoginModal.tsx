import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Fingerprint, X } from 'lucide-react';
import {
  canShowBiometricLogin,
  isBiometricEnrolled,
  isWebAuthnPlatformAvailable,
} from '../../auth/platformBiometric';
import { canShowPinLogin, isPinEnabled, isValidPin } from '../../auth/platformPin';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  onClose: () => void;
};

type LoginStep = 'credentials' | 'setup';
type CredentialMode = 'password' | 'pin';

export function LoginModal({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { login, loginWithBiometric, loginWithPin, enrollBiometric, enrollPin } = useCurrentUser();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const autoBioTried = useRef(false);

  const [step, setStep] = useState<LoginStep>('credentials');
  const [mode, setMode] = useState<CredentialMode>(() => (canShowPinLogin() ? 'pin' : 'password'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [biometricReady, setBiometricReady] = useState(() => canShowBiometricLogin());
  const [pinReady, setPinReady] = useState(() => canShowPinLogin());
  const [webAuthnReady] = useState(() => isWebAuthnPlatformAvailable());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && step === 'credentials') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting, step]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (mode === 'pin') pinInputRef.current?.focus();
      else emailInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, step]);

  async function handleBiometricUnlock() {
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await loginWithBiometric();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.biometricFailed'));
      setBiometricReady(canShowBiometricLogin());
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (autoBioTried.current || step !== 'credentials' || !biometricReady) return;
    autoBioTried.current = true;
    void handleBiometricUnlock();
    // Intentionally once on open when biometric enrollment exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricReady, step]);

  function shouldOfferSetup() {
    const needBio = webAuthnReady && !isBiometricEnrolled();
    const needPin = !isPinEnabled();
    return needBio || needPin;
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await login(email, password);
      if (shouldOfferSetup()) {
        setStep('setup');
        setSetupPin('');
        setSetupPinConfirm('');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    if (!isValidPin(pin)) {
      setError(t('auth.pinMustBeDigits'));
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPin(pin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.incorrectPin'));
      setPin('');
      setPinReady(canShowPinLogin());
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnableBiometric() {
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await enrollBiometric();
      setBiometricReady(true);
      setStatus(t('auth.biometricEnabled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.biometricFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSetupPin() {
    setError(null);
    setStatus(null);
    if (!isValidPin(setupPin)) {
      setError(t('auth.pinMustBeDigits'));
      return;
    }
    if (setupPin !== setupPinConfirm) {
      setError(t('auth.pinMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await enrollPin(setupPin);
      setPinReady(true);
      setSetupPin('');
      setSetupPinConfirm('');
      setStatus(t('auth.pinSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const setupBioDone = isBiometricEnrolled();
  const setupPinDone = isPinEnabled();

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-herme-ink/40 backdrop-blur-sm"
        onClick={() => !submitting && step === 'credentials' && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="relative w-full max-w-md rounded-2xl border border-herme-muted/60 bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {step === 'credentials' ? (
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-herme-ink/40 transition-colors hover:bg-herme-light hover:text-herme-ink disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        ) : null}

        {step === 'credentials' && mode === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="p-8 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-herme">{t('auth.signIn')}</p>
            <h2 id="login-title" className="mt-1 text-2xl font-bold text-herme-ink">
              {t('auth.welcomeBack')}
            </h2>
            <p className="mt-2 text-sm text-herme-ink/60">
              {t('auth.credentialsHint')}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.usernameEmail')}
                </label>
                <input
                  ref={emailInputRef}
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  className="w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                    className="w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 pr-11 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme"
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
              {submitting ? t('auth.signingIn') : t('auth.loginButton')}
            </button>

            {(biometricReady || pinReady) && (
              <div className="mt-3 space-y-2">
                {biometricReady ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleBiometricUnlock()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm font-semibold text-herme-ink transition-colors hover:bg-herme-light disabled:opacity-60"
                  >
                    <Fingerprint size={18} className="text-herme" aria-hidden />
                    {submitting ? t('auth.unlocking') : t('auth.biometricLogin')}
                  </button>
                ) : null}
                {pinReady ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setMode('pin');
                      setError(null);
                      setPassword('');
                    }}
                    className="w-full rounded-xl border border-herme-muted/70 px-4 py-2.5 text-sm font-medium text-herme-ink/80 transition-colors hover:bg-herme-light disabled:opacity-60"
                  >
                    {t('auth.usePinInstead')}
                  </button>
                ) : null}
              </div>
            )}
            {biometricReady ? (
              <p className="mt-3 text-center text-xs text-herme-ink/45">
                {t('auth.biometricHint')}
              </p>
            ) : webAuthnReady ? (
              <p className="mt-3 text-center text-xs text-herme-ink/45">
                {t('auth.setupAfterLoginHint')}
              </p>
            ) : null}
          </form>
        ) : null}

        {step === 'credentials' && mode === 'pin' ? (
          <form onSubmit={handlePinSubmit} className="p-8 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-herme">{t('auth.signIn')}</p>
            <h2 id="login-title" className="mt-1 text-2xl font-bold text-herme-ink">
              {t('auth.pinLogin')}
            </h2>
            <p className="mt-2 text-sm text-herme-ink/60">
              {t('auth.pinHint')}
            </p>

            <div className="mt-6">
              <label htmlFor="login-pin" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                {t('auth.devicePin')}
              </label>
              <input
                ref={pinInputRef}
                id="login-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={pin}
                onChange={e => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                  setError(null);
                }}
                placeholder={t('auth.pinPlaceholder')}
                required
                className="w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-center text-lg tracking-[0.35em] text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || pin.length < 4}
              className="mt-6 w-full rounded-xl bg-herme px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-herme-dark disabled:opacity-60"
            >
              {submitting ? t('auth.unlocking') : t('auth.pinLoginButton')}
            </button>

            <div className="mt-3 space-y-2">
              {biometricReady ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleBiometricUnlock()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm font-semibold text-herme-ink transition-colors hover:bg-herme-light disabled:opacity-60"
                >
                  <Fingerprint size={18} className="text-herme" aria-hidden />
                  {t('auth.biometricLogin')}
                </button>
              ) : null}
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setMode('password');
                  setError(null);
                  setPin('');
                }}
                className="w-full rounded-xl border border-herme-muted/70 px-4 py-2.5 text-sm font-medium text-herme-ink/80 transition-colors hover:bg-herme-light disabled:opacity-60"
              >
                {t('auth.usePasswordInstead')}
              </button>
            </div>
          </form>
        ) : null}

        {step === 'setup' ? (
          <div className="p-8 pt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-herme">{t('auth.signIn')}</p>
            <h2 id="login-title" className="mt-1 text-2xl font-bold text-herme-ink">
              {t('auth.setupTitle')}
            </h2>
            <p className="mt-2 text-sm text-herme-ink/60">
              {t('auth.setupHint')}
            </p>

            <div className="mt-6 space-y-4">
              {webAuthnReady ? (
                <div className="rounded-xl border border-herme-muted/60 bg-herme-cream/60 px-4 py-4">
                  <p className="text-sm font-semibold text-herme-ink">{t('auth.biometricLogin')}</p>
                  <p className="mt-1 text-xs text-herme-ink/55">{t('auth.biometricHint')}</p>
                  {setupBioDone ? (
                    <p className="mt-3 text-sm font-medium text-emerald-700">{t('auth.biometricEnabled')}</p>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleEnableBiometric()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-herme px-4 py-2.5 text-sm font-semibold text-white hover:bg-herme-dark disabled:opacity-60"
                    >
                      <Fingerprint size={16} aria-hidden />
                      {submitting ? t('auth.biometricEnabling') : t('auth.enableBiometric')}
                    </button>
                  )}
                </div>
              ) : null}

              <div className="rounded-xl border border-herme-muted/60 bg-herme-cream/60 px-4 py-4">
                <p className="text-sm font-semibold text-herme-ink">{t('auth.devicePin')}</p>
                <p className="mt-1 text-xs text-herme-ink/55">{t('auth.devicePinExplain')}</p>
                {setupPinDone ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">{t('auth.pinSaved')}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={setupPin}
                      onChange={e => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder={t('auth.setDevicePin')}
                      className="w-full rounded-xl border border-herme-muted/70 bg-white px-4 py-2.5 text-sm text-herme-ink focus:outline-none focus:ring-2 focus:ring-herme"
                    />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={setupPinConfirm}
                      onChange={e => setSetupPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder={t('auth.confirmDevicePin')}
                      className="w-full rounded-xl border border-herme-muted/70 bg-white px-4 py-2.5 text-sm text-herme-ink focus:outline-none focus:ring-2 focus:ring-herme"
                    />
                    <button
                      type="button"
                      disabled={submitting || setupPin.length < 4}
                      onClick={() => void handleSaveSetupPin()}
                      className="w-full rounded-xl border border-herme-muted/70 bg-white px-4 py-2.5 text-sm font-semibold text-herme-ink hover:bg-herme-light disabled:opacity-60"
                    >
                      {t('auth.setDevicePin')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {status && (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {status}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-herme px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-herme-dark disabled:opacity-60"
            >
              {(setupBioDone || setupPinDone) ? t('auth.setupDone') : t('auth.skipSetup')}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
