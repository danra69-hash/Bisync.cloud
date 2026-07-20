import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAppTranslation } from '../i18n/useAppTranslation';
import { CountryAddressFields, getAddressValidationError } from '../components/shared/CountryAddressFields';
import { inputCls } from '../data/countries';
import type { AddressParts } from '../utils/countryFormat';
import { setAwaitingPayment, setShowTrialWelcome } from '../data/onboardingFlags';

type LocationDraft = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postcode: string;
};

const blankLocation = (): LocationDraft => ({
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postcode: '',
});

type Props = {
  onCompleted: () => void;
};

export function LocationOnboardingPage({ onCompleted }: Props) {
  const { t } = useAppTranslation();
  const { currentUser, applyAuthenticatedUser, logout } = useCurrentUser();
  const [form, setForm] = useState<LocationDraft>(blankLocation);
  const [countryCode, setCountryCode] = useState('MY');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const companyId = currentUser?.companyId;
    if (!companyId) return;
    void api.companies().then(companies => {
      const company = companies.find(c => c.id === companyId);
      if (company?.countryCode) setCountryCode(company.countryCode);
    }).catch(() => { /* keep MY default */ });
  }, [currentUser?.companyId]);

  function set<K extends keyof LocationDraft>(key: K, val: LocationDraft[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setError(null);
  }

  const addressParts: AddressParts = {
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    stateProvince: form.stateProvince,
    postcode: form.postcode,
  };

  function setAddressParts(parts: AddressParts) {
    setForm(f => ({
      ...f,
      addressLine1: parts.addressLine1,
      addressLine2: parts.addressLine2,
      city: parts.city,
      stateProvince: parts.stateProvince,
      postcode: parts.postcode,
    }));
    setError(null);
  }

  function showError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function save() {
    if (!currentUser) {
      showError(t('auth.loginRequired'));
      return;
    }
    if (!form.name.trim()) {
      showError(t('auth.locationNameRequired'));
      return;
    }

    const addressError = getAddressValidationError(countryCode, addressParts);
    if (addressError) {
      showError(addressError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const user = await api.completeLocationOnboarding(currentUser.id, {
        name: form.name.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        stateProvince: form.stateProvince.trim(),
        postcode: form.postcode.trim(),
      });
      setAwaitingPayment();
      setShowTrialWelcome();
      applyAuthenticatedUser(user);
      onCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.locationSaveFailed');
      showError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-herme-cream">
      <header className="border-b border-herme-muted/40 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C9963A]">
              {t('auth.onboardingStepLocation')}
            </p>
            <h1 className="text-xl font-bold text-herme-ink">{t('auth.locationRegistrationTitle')}</h1>
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

      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-6 text-sm text-herme-ink/60">
          {t('auth.locationRegistrationHint', {
            company: currentUser?.companyName ?? t('auth.yourCompany'),
          })}
        </p>

        <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
            Location Name *
          </label>
          <input
            className={inputCls}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. KLCC Flagship"
          />

          <CountryAddressFields
            countryCode={countryCode}
            value={addressParts}
            onChange={setAddressParts}
          />

          <p className="text-[11px] text-muted-foreground">
            {t('auth.locationInheritsCompanyProfile')}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {error && (
            <div
              ref={errorRef}
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-xl bg-[#C9963A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#A87A2E] disabled:opacity-60"
            >
              {saving ? t('auth.savingLocation') : t('auth.continueToPayment')}
            </button>
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            {t('auth.locationRequiredNote')}
          </p>
        </div>
      </main>
    </div>
  );
}
