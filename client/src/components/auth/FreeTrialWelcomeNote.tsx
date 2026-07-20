import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clearShowTrialWelcome, shouldShowTrialWelcome } from '../../data/onboardingFlags';
import { useAppTranslation } from '../../i18n/useAppTranslation';

/**
 * Open sticky-note message shown once after self-serve registration,
 * confirming the 1-month free trial is active.
 */
export function FreeTrialWelcomeNote() {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShowTrialWelcome()) return;
    setOpen(true);
    const id = window.setTimeout(() => setVisible(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  function dismiss() {
    setVisible(false);
    window.setTimeout(() => {
      clearShowTrialWelcome();
      setOpen(false);
    }, 220);
  }

  if (!open) return null;

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 1);
  const expiryLabel = expiry.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[120] flex items-start justify-end p-4 sm:p-8"
      aria-live="polite"
    >
      <aside
        role="dialog"
        aria-label={t('auth.trialWelcomeTitle')}
        className={`pointer-events-auto relative w-[min(20rem,calc(100vw-2rem))] origin-top-right transition-all duration-200 ease-out ${
          visible ? 'translate-y-0 rotate-[-2.5deg] opacity-100 scale-100' : 'translate-y-3 rotate-0 opacity-0 scale-95'
        }`}
        style={{
          background: 'linear-gradient(160deg, #fff7a8 0%, #f5e56b 55%, #ead84a 100%)',
          boxShadow:
            '2px 6px 0 rgba(0,0,0,0.06), 8px 18px 28px rgba(40, 30, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.55)',
        }}
      >
        {/* Tape strip */}
        <div
          className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 rotate-[-1deg] opacity-70"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.15))',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
          aria-hidden
        />

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 rounded p-1 text-[#5c4a12]/70 hover:bg-black/5 hover:text-[#5c4a12]"
          aria-label={t('common.close')}
        >
          <X size={14} />
        </button>

        <div className="px-5 pb-5 pt-6">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a6418]"
          >
            {t('auth.trialWelcomeEyebrow')}
          </p>
          <h2
            className="mt-2 text-[1.35rem] font-bold leading-snug text-[#3d320c]"
            style={{ fontFamily: '"Nunito", ui-sans-serif, sans-serif' }}
          >
            {t('auth.trialWelcomeTitle')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#4a3d10]">
            {t('auth.trialWelcomeBody', { expiry: expiryLabel })}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-4 inline-flex items-center rounded-md border border-[#3d320c]/25 bg-[#3d320c]/8 px-3 py-1.5 text-xs font-semibold text-[#fff8c8] hover:bg-[#3d320c]"
          >
            {t('auth.trialWelcomeDismiss')}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
