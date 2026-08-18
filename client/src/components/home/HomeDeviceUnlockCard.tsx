import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { isBiometricEnrolled } from '../../auth/platformBiometric';
import { isPinEnabled } from '../../auth/platformPin';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import { DeviceUnlockSettingsModal } from '../auth/DeviceUnlockSettingsModal';

type Props = {
  className?: string;
};

function deviceUnlockEnabled() {
  return isBiometricEnrolled() || isPinEnabled();
}

/** Compact entry under Home chat to open Face ID / PIN setup (same modal as sidebar). */
export function HomeDeviceUnlockCard({ className = '' }: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(deviceUnlockEnabled);

  function closeModal() {
    setOpen(false);
    setEnabled(deviceUnlockEnabled());
  }

  return (
    <>
      <section
        className={[
          'bg-card border border-border rounded-xl overflow-hidden shrink-0',
          className,
        ].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors"
          title={t('auth.deviceUnlockHint')}
        >
          <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
            <Fingerprint size={13} className="text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight">{t('auth.setupTitle')}</h2>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {enabled ? t('home.deviceUnlock.enabledHint') : t('home.deviceUnlock.setupHint')}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-primary">
            {enabled ? t('home.deviceUnlock.manage') : t('home.deviceUnlock.setup')}
          </span>
        </button>
      </section>
      {open ? <DeviceUnlockSettingsModal onClose={closeModal} /> : null}
    </>
  );
}
