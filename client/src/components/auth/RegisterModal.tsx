import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import { api } from '../../api';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { setAppLocale } from '../../i18n';
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LANGUAGES,
  readStoredLocale,
  type AppLocale,
} from '../../i18n/languages';
import {
  DEFAULT_PHONE_COUNTRY,
  getPhoneCountry,
  preferredLanguageForCountry,
} from '../../data/phoneCountries';
import { RegisterPhoneInput } from './RegisterPhoneInput';

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
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY);
  const [preferredLanguage, setPreferredLanguage] = useState<AppLocale>(() => readStoredLocale());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activationUrl, setActivationUrl] = useState<string | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<'loading' | 'ready'>('loading');
  const [demoRestricted, setDemoRestricted] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string[]>(['cubevalue.com', 'pasar.ai']);
  const countryManualRef = useRef(false);
  const languageManualRef = useRef(false);

  // Keep registration UI in the selected preferred language for the whole flow.
  useEffect(() => {
    void setAppLocale(preferredLanguage);
  }, [preferredLanguage]);

  useEffect(() => {
    let cancelled = false;
    api.registrationPolicy()
      .then(policy => {
        if (cancelled) return;
        setDemoRestricted(Boolean(policy.registrationRestricted));
        if (Array.isArray(policy.allowedEmailDomains) && policy.allowedEmailDomains.length > 0) {
          setAllowedDomains(policy.allowedEmailDomains);
        }
      })
      .catch(() => {
        // Default to demo-safe restriction messaging if policy endpoint is unavailable.
        if (!cancelled) setDemoRestricted(true);
      });
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hint = await api.geoHint();
        if (cancelled) return;
        const country = getPhoneCountry(hint.countryCode).code;
        if (!countryManualRef.current) {
          setPhoneCountryCode(country);
          setMobile(prev => {
            if (prev.trim()) return prev;
            return getPhoneCountry(country).dialCode;
          });
        }
        // Only infer language from IP when the user has not chosen one yet in this session.
        if (!languageManualRef.current && preferredLanguage === readStoredLocale() && !sessionStorage.getItem('bisync.registerLanguageChosen')) {
          const inferred = preferredLanguageForCountry(country);
          const nextLocale = isAppLocale(inferred) ? inferred : DEFAULT_LOCALE;
          setPreferredLanguage(nextLocale);
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setGeoStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- geo once on open

  async function handleLanguageChange(code: AppLocale) {
    languageManualRef.current = true;
    try {
      sessionStorage.setItem('bisync.registerLanguageChosen', code);
    } catch {
      // ignore
    }
    setPreferredLanguage(code);
    setError(null);
    await setAppLocale(code);
  }

  function handlePhoneCountryChange(code: string) {
    countryManualRef.current = true;
    setPhoneCountryCode(code);
    setError(null);
  }

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
    const digits = mobile.replace(/\D/g, '');
    if (digits.length < 8) {
      setError(t('auth.mobileRequired'));
      return;
    }
    if (demoRestricted) {
      const at = email.trim().toLowerCase().lastIndexOf('@');
      const domain = at >= 0 ? email.trim().toLowerCase().slice(at + 1) : '';
      if (!allowedDomains.includes(domain)) {
        setError(`Demo site: registration is limited to ${allowedDomains.map(d => `@${d}`).join(' / ')} until Go live.`);
        return;
      }
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
        preferredLanguage,
        phoneCountryCode,
      });
      setSuccessEmail(result.email);
      setActivationUrl(result.activationUrl);
      if (isAppLocale(result.preferredLanguage)) {
        await setAppLocale(result.preferredLanguage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme';
  const selectCls = `${inputCls} cursor-pointer`;
  const phoneSelectCls =
    'shrink-0 w-[9.5rem] rounded-xl border border-herme-muted/70 bg-herme-cream px-2 py-3 text-sm text-herme-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme cursor-pointer';
  const phoneInputCls =
    'min-w-0 flex-1 rounded-xl border border-herme-muted/70 bg-herme-cream px-4 py-3 text-sm text-herme-ink placeholder:text-herme-ink/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-herme';

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
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-herme-muted/60 bg-white shadow-xl"
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
              <div>
                <label htmlFor="reg-language" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.preferredLanguage')}
                </label>
                <select
                  id="reg-language"
                  required
                  value={preferredLanguage}
                  onChange={e => {
                    const code = e.target.value;
                    if (isAppLocale(code)) void handleLanguageChange(code);
                  }}
                  className={selectCls}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.nativeName} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>

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
                {demoRestricted && (
                  <p className="mt-1.5 text-xs text-herme-ink/45">
                    Demo site — use {allowedDomains.map(d => `@${d}`).join(' or ')} until Go live.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg-mobile" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-herme-ink/70">
                  {t('auth.mobileNumber')}
                </label>
                <RegisterPhoneInput
                  id="reg-mobile"
                  countryCode={phoneCountryCode}
                  onCountryCodeChange={handlePhoneCountryChange}
                  value={mobile}
                  onChange={next => { setMobile(next); setError(null); }}
                  required
                  inputClassName={phoneInputCls}
                  selectClassName={phoneSelectCls}
                />
                <p className="mt-1.5 text-xs text-herme-ink/45">
                  {geoStatus === 'loading'
                    ? t('auth.detectingCountry')
                    : t('auth.mobileCountryHint', {
                        country: getPhoneCountry(phoneCountryCode).name,
                        dialCode: getPhoneCountry(phoneCountryCode).dialCode,
                      })}
                </p>
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
