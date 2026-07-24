import { useRef, useState } from 'react';
import { api, type Company } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAppTranslation } from '../i18n/useAppTranslation';
import {
  serializeStringArray,
  validateCompanyProfile,
  type CompanyBusinessType,
  type CompanyVendorPolicyTag,
} from '../data/companyProfile';
import { validateCompanyModules } from '../data/companyModules';
import type { AccessModule } from '../data/userAccess';
import { CountryAddressFields, getAddressValidationError } from '../components/shared/CountryAddressFields';
import { CountryPhoneInput, getPhoneValidationError } from '../components/shared/CountryPhoneInput';
import { COUNTRIES, inputCls, selectCls } from '../data/countries';
import type { AddressParts } from '../utils/countryFormat';
import { CompanyProfileFields } from '../components/admin/CompanyProfileFields';
import { setAwaitingLocation } from '../data/onboardingFlags';

type CompanyDraft = Omit<Company, 'id' | 'locationCount'>;

const blankCompany = (): CompanyDraft => ({
  name: '',
  brn: '',
  gstTin: '',
  countryCode: 'MY',
  addressLine1: '',
  addressLine2: '',
  city: '',
  stateProvince: '',
  postcode: '',
  phone: '',
  fax: '',
  email: '',
  active: true,
  businessTypesJson: '[]',
  vendorPolicyTagsJson: '[]',
  modulesJson: '[]',
});

type Props = {
  onCompleted: () => void;
};

export function CompanyOnboardingPage({ onCompleted }: Props) {
  const { t } = useAppTranslation();
  const { currentUser, applyAuthenticatedUser, logout } = useCurrentUser();
  const [form, setForm] = useState<CompanyDraft>(blankCompany);
  const [businessTypes, setBusinessTypes] = useState<CompanyBusinessType[]>([]);
  const [vendorPolicyTags, setVendorPolicyTags] = useState<CompanyVendorPolicyTag[]>([]);
  const [modules, setModules] = useState<AccessModule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof CompanyDraft>(key: K, val: CompanyDraft[K]) {
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
      showError(t('auth.companyNameRequired'));
      return;
    }

    const profileError = validateCompanyProfile(businessTypes, vendorPolicyTags);
    if (profileError) {
      showError(profileError);
      return;
    }
    const modulesError = validateCompanyModules(modules);
    if (modulesError) {
      showError(modulesError);
      return;
    }

    const phoneError = getPhoneValidationError(form.countryCode, form.phone, 'Phone', false);
    const faxError = getPhoneValidationError(form.countryCode, form.fax, 'Fax', false);
    const addressError = getAddressValidationError(form.countryCode, addressParts);
    const validationError = phoneError ?? faxError ?? addressError;
    if (validationError) {
      showError(validationError);
      return;
    }

    const payload: CompanyDraft = {
      ...form,
      active: true,
      businessTypesJson: serializeStringArray(businessTypes),
      vendorPolicyTagsJson: serializeStringArray(vendorPolicyTags),
      modulesJson: serializeStringArray(modules),
      email: form.email.trim() || currentUser.email,
    };

    setSaving(true);
    setError(null);
    try {
      const user = await api.completeCompanyOnboarding(currentUser.id, payload);
      setAwaitingLocation();
      applyAuthenticatedUser(user);
      onCompleted();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('auth.companySaveFailed');
      // Prior attempt may have linked the company already — continue onboarding.
      if (/already linked/i.test(message)) {
        setAwaitingLocation();
        onCompleted();
        return;
      }
      showError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-herme-cream">
      <header className="border-b border-herme-muted/40 bg-white">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F37021]">
              {t('auth.onboardingStepCompany')}
            </p>
            <h1 className="text-xl font-bold text-herme-ink">{t('auth.companyRegistrationTitle')}</h1>
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

      <main className="mx-auto w-full max-w-none px-6 py-8">
        <p className="mb-6 text-sm text-herme-ink/60">{t('auth.companyRegistrationHint')}</p>

        <div className="space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
          <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
            Company Name *
          </label>
          <input
            className={inputCls}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Bisync Hospitality Sdn Bhd"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">BRN</label>
              <input className={inputCls} value={form.brn} onChange={e => set('brn', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">GST / TIN</label>
              <input className={inputCls} value={form.gstTin} onChange={e => set('gstTin', e.target.value)} />
            </div>
          </div>

          <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Country *</label>
          <select
            className={selectCls}
            value={form.countryCode}
            onChange={e => {
              setForm(f => ({
                ...f,
                countryCode: e.target.value,
                addressLine1: '',
                addressLine2: '',
                city: '',
                stateProvince: '',
                postcode: '',
                phone: '',
                fax: '',
              }));
              setError(null);
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>

          <CountryAddressFields
            countryCode={form.countryCode}
            value={addressParts}
            onChange={setAddressParts}
          />

          <div className="grid grid-cols-2 gap-3">
            <CountryPhoneInput
              countryCode={form.countryCode}
              value={form.phone}
              onChange={value => set('phone', value)}
              label="Phone"
            />
            <CountryPhoneInput
              countryCode={form.countryCode}
              value={form.fax}
              onChange={value => set('fax', value)}
              label="Fax"
              variant="fax"
            />
          </div>

          <label className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
            General Email
          </label>
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder={currentUser?.email ?? 'hq@company.com'}
          />

          <CompanyProfileFields
            businessTypes={businessTypes}
            vendorPolicyTags={vendorPolicyTags}
            modules={modules}
            onBusinessTypesChange={values => {
              setBusinessTypes(values);
              setError(null);
            }}
            onVendorPolicyTagsChange={values => {
              setVendorPolicyTags(values);
              setError(null);
            }}
            onModulesChange={values => {
              setModules(values);
              setError(null);
            }}
            moduleScope="company"
          />
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
              className="rounded-xl bg-[#F37021] px-6 py-3 text-sm font-semibold text-white hover:bg-[#D4550A] disabled:opacity-60"
            >
              {saving ? t('auth.savingCompany') : t('auth.continueToLocation')}
            </button>
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            Required: company name, business type, module, and vendor product policy.
          </p>
        </div>
      </main>
    </div>
  );
}
