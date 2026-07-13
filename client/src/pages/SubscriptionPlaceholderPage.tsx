import { useAppTranslation } from '../i18n/useAppTranslation';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { clearAwaitingSubscription } from './CompanyOnboardingPage';

type Props = {
  onContinue: () => void;
};

export function SubscriptionPlaceholderPage({ onContinue }: Props) {
  const { t } = useAppTranslation();
  const { currentUser, logout } = useCurrentUser();

  function handleContinue() {
    clearAwaitingSubscription();
    onContinue();
  }

  return (
    <div className="min-h-screen bg-herme-cream">
      <header className="border-b border-herme-muted/40 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9963A]">
              {t('auth.onboardingStepSubscription')}
            </p>
            <h1 className="text-xl font-bold text-herme-ink">{t('auth.subscriptionTitle')}</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs font-semibold text-herme-ink/50 hover:text-herme-ink"
          >
            {t('common.logOut')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-dashed border-[#C9963A]/50 bg-white px-8 py-12 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#C9963A]">
            {t('auth.subscriptionComingSoon')}
          </p>
          <h2 className="mt-3 text-2xl font-bold text-herme-ink">
            {t('auth.subscriptionPlaceholderHeading')}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-herme-ink/60">
            {t('auth.subscriptionPlaceholderBody', {
              company: currentUser?.companyName ?? t('auth.yourCompany'),
            })}
          </p>
          <button
            type="button"
            onClick={handleContinue}
            className="mt-8 rounded-xl bg-herme px-6 py-3 text-sm font-semibold text-white hover:bg-herme-dark"
          >
            {t('auth.continueToApp')}
          </button>
        </div>
      </main>
    </div>
  );
}
