import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Fingerprint, X } from 'lucide-react';
import {
  isBiometricEnrolled,
  isWebAuthnPlatformAvailable,
} from '../../auth/platformBiometric';
import { isPinEnabled, isValidPin } from '../../auth/platformPin';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  onClose: () => void;
};

/** Logged-in settings to enable/disable Face ID / fingerprint and Bisync device PIN. */
export function DeviceUnlockSettingsModal({ onClose }: Props) {
  const { t } = useAppTranslation();
  const { enrollBiometric, enrollPin, clearBiometric, clearPin } = useCurrentUser();
  const webAuthnReady = isWebAuthnPlatformAvailable();

  const [bioOn, setBioOn] = useState(() => isBiometricEnrolled());
  const [pinOn, setPinOn] = useState(() => isPinEnabled());
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleEnableBiometric() {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      await enrollBiometric();
      setBioOn(true);
      setStatus(t('auth.biometricEnabled'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.biometricFailed'));
    } finally {
      setBusy(false);
    }
  }

  function handleTurnOffBiometric() {
    clearBiometric();
    setBioOn(false);
    setStatus(t('auth.biometricTurnedOff'));
    setError(null);
  }

  async function handleSavePin() {
    setError(null);
    setStatus(null);
    if (!isValidPin(pin)) {
      setError(t('auth.pinMustBeDigits'));
      return;
    }
    if (pin !== pinConfirm) {
      setError(t('auth.pinMismatch'));
      return;
    }
    setBusy(true);
    try {
      await enrollPin(pin);
      setPinOn(true);
      setPin('');
      setPinConfirm('');
      setStatus(t('auth.pinSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  function handleTurnOffPin() {
    clearPin();
    setPinOn(false);
    setPin('');
    setPinConfirm('');
    setStatus(t('auth.pinTurnedOff'));
    setError(null);
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-unlock-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        <div className="p-6 pt-8 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{t('auth.signIn')}</p>
            <h2 id="device-unlock-title" className="mt-1 text-xl font-bold text-foreground">
              {t('auth.deviceUnlock')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('auth.deviceUnlockHint')}
            </p>
          </div>

          <section className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">{t('auth.biometricLogin')}</p>
            <p className="text-xs text-muted-foreground">{t('auth.biometricHint')}</p>
            {bioOn ? (
              <>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('auth.biometricEnabled')}</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleTurnOffBiometric}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {t('auth.turnOffBiometric')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy || !webAuthnReady}
                onClick={() => void handleEnableBiometric()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Fingerprint size={16} aria-hidden />
                {busy ? t('auth.biometricEnabling') : t('auth.enableBiometric')}
              </button>
            )}
            {!webAuthnReady ? (
              <p className="text-[11px] text-muted-foreground">{t('auth.httpsRequired')}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">{t('auth.devicePin')}</p>
            <p className="text-xs text-muted-foreground">{t('auth.devicePinExplain')}</p>
            {pinOn ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('auth.pinSaved')}</p>
            ) : null}
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={pinOn ? t('auth.newDevicePin') : t('auth.setDevicePin')}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinConfirm}
                onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={t('auth.confirmDevicePin')}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                disabled={busy || pin.length < 4}
                onClick={() => void handleSavePin()}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pinOn ? t('auth.updateDevicePin') : t('auth.setDevicePin')}
              </button>
              {pinOn ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleTurnOffPin}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {t('auth.turnOffPin')}
                </button>
              ) : null}
            </div>
          </section>

          {status ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
