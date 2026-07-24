import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { api, type AppUser, type Company, type LocationConfig } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useAppTranslation } from '../i18n/useAppTranslation';
import {
  COMPANY_BUSINESS_TYPES,
  parseStringArrayJson,
  serializeStringArray,
  type CompanyBusinessType,
} from '../data/companyProfile';
import {
  LOCATION_PLATFORM_MODULES,
  PLATFORM_MODULES,
  parseCompanyModules,
} from '../data/companyModules';
import type { AccessModule } from '../data/userAccess';
import { clearAwaitingPayment, setShowTrialWelcome } from '../data/onboardingFlags';
import {
  PAYMENT_MODULE_LABELS,
  PAYMENT_TYPE_LABELS,
  addExtraPaymentCompanyId,
  clearExtraPaymentCompanyIds,
  formatMoney,
  getExtraPaymentCompanyIds,
  priceLocationLine,
  sumPricedLines,
} from '../data/subscriptionPricing';
import { inputCls } from '../data/countries';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';

type CompanyDraft = {
  id: number;
  name: string;
  countryCode: string;
  vendorPolicyTagsJson: string;
  types: CompanyBusinessType[];
  modules: AccessModule[];
};

type LocationDraft = {
  id: number;
  companyId: number;
  name: string;
  /** Single type from company types. */
  type: CompanyBusinessType | null;
};

type Props = {
  onContinue: () => void;
};

type AddMode = 'choice' | 'location' | 'company' | null;

export function PaymentPage({ onContinue }: Props) {
  const { t } = useAppTranslation();
  const { currentUser, applyAuthenticatedUser, logout } = useCurrentUser();
  const [companies, setCompanies] = useState<CompanyDraft[]>([]);
  const [locations, setLocations] = useState<LocationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);

  const load = useCallback(async () => {
    if (!currentUser?.companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [allCompanies, allLocations] = await Promise.all([
        api.companies(),
        api.locationsConfig(),
      ]);
      const extraIds = getExtraPaymentCompanyIds();
      const allowedCompanyIds = new Set<number>([
        currentUser.companyId,
        ...extraIds,
      ]);
      const scopedCompanies = allCompanies.filter(c => allowedCompanyIds.has(c.id));
      const scopedLocations = allLocations.filter(
        l => l.companyId != null && allowedCompanyIds.has(l.companyId),
      );

      setCompanies(scopedCompanies.map(toCompanyDraft));
      setLocations(scopedLocations.map(l => toLocationDraft(l, scopedCompanies)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.paymentLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [currentUser?.companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyById = useMemo(
    () => new Map(companies.map(c => [c.id, c])),
    [companies],
  );

  const pricedLines = useMemo(() => {
    return locations.map(loc => {
      const company = companyById.get(loc.companyId);
      return priceLocationLine({
        companyId: loc.companyId,
        companyName: company?.name ?? t('auth.yourCompany'),
        locationId: loc.id,
        locationName: loc.name,
        locationType: loc.type,
        countryCode: company?.countryCode ?? 'MY',
      });
    });
  }, [locations, companyById, t]);

  const totals = useMemo(() => sumPricedLines(pricedLines), [pricedLines]);

  function setCompanyTypes(companyId: number, types: CompanyBusinessType[]) {
    setCompanies(prev => prev.map(c => (c.id === companyId ? { ...c, types } : c)));
    setLocations(prev => prev.map(l => {
      if (l.companyId !== companyId) return l;
      if (l.type && !types.includes(l.type)) {
        return { ...l, type: types[0] ?? null };
      }
      return l;
    }));
    setError(null);
  }

  function setCompanyModules(companyId: number, modules: AccessModule[]) {
    setCompanies(prev => prev.map(c => (c.id === companyId ? { ...c, modules } : c)));
    setError(null);
  }

  function setLocationType(locationId: number, type: CompanyBusinessType) {
    setLocations(prev => prev.map(l => (l.id === locationId ? { ...l, type } : l)));
    setError(null);
  }

  async function handleContinue() {
    if (!currentUser) return;
    for (const company of companies) {
      if (company.types.length === 0) {
        setError(t('auth.paymentCompanyTypesRequired', { company: company.name }));
        return;
      }
      if (company.modules.length === 0) {
        setError(t('auth.paymentCompanyModulesRequired', { company: company.name }));
        return;
      }
    }
    for (const loc of locations) {
      if (!loc.type) {
        setError(t('auth.paymentLocationTypeRequired', { location: loc.name }));
        return;
      }
      const company = companyById.get(loc.companyId);
      if (company && !company.types.includes(loc.type)) {
        setError(t('auth.paymentLocationTypeMustInherit', { location: loc.name }));
        return;
      }
    }
    if (locations.length === 0) {
      setError(t('auth.paymentMinLocation'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const allCompanies = await api.companies();
      for (const draft of companies) {
        const original = allCompanies.find(c => c.id === draft.id);
        if (!original) continue;
        await api.updateCompany(draft.id, {
          ...original,
          businessTypesJson: serializeStringArray(draft.types),
          modulesJson: serializeStringArray(draft.modules),
        });
      }

      const allLocations = await api.locationsConfig();
      for (const draft of locations) {
        const original = allLocations.find(l => l.id === draft.id);
        if (!original || original.companyId == null) continue;
        await api.updateLocationConfig(draft.id, {
          name: original.name,
          companyId: original.companyId,
          addressLine1: original.addressLine1,
          addressLine2: original.addressLine2,
          city: original.city,
          stateProvince: original.stateProvince,
          postcode: original.postcode,
          principalContactUserId: original.principalContactUserId,
          secondaryContactUserId: original.secondaryContactUserId ?? null,
          businessTypesJson: serializeStringArray(draft.type ? [draft.type] : []),
          vendorPolicyTagsJson: '[]',
          // Empty modules = inherit from company (Accounting never on location).
          modulesJson: '[]',
        });
      }

      clearAwaitingPayment();
      clearExtraPaymentCompanyIds();
      setShowTrialWelcome();

      // Provision dedicated operational + archive DBs after profiles are saved (idempotent).
      for (const draft of companies) {
        try {
          await api.provisionCompanyDb({ companyId: draft.id, userId: currentUser.id });
        } catch {
          // Non-fatal: shared DB remains usable; operator can retry provision later.
        }
      }

      onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.paymentSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function onAdded(user?: AppUser) {
    if (user) applyAuthenticatedUser(user);
    setAddMode(null);
    await load();
  }

  return (
    <div className="min-h-screen bg-herme-cream">
      <header className="border-b border-herme-muted/40 bg-white">
        <div className="mx-auto flex w-full max-w-none items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F37021]">
              {t('auth.onboardingStepPayment')}
            </p>
            <h1 className="text-xl font-bold text-herme-ink">{t('auth.paymentTitle')}</h1>
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
        <p className="mb-6 text-sm text-herme-ink/60">{t('auth.paymentSetupHint')}</p>

        {loading ? (
          <MillstoneLoader layout="block" size="lg" label={t('common.loading')} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 font-semibold text-herme-ink">{t('auth.paymentColBase')}</th>
                  <th className="px-4 py-3 font-semibold text-herme-ink">{t('auth.paymentColType')}</th>
                  <th className="px-4 py-3 font-semibold text-herme-ink">{t('auth.paymentColModule')}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <CompanyRows
                    key={`c-${company.id}`}
                    company={company}
                    locations={locations.filter(l => l.companyId === company.id)}
                    onTypesChange={types => setCompanyTypes(company.id, types)}
                    onModulesChange={modules => setCompanyModules(company.id, modules)}
                    onLocationTypeChange={setLocationType}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setAddMode('choice')}
            className="inline-flex items-center gap-2 rounded-xl border border-[#F37021]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#F37021] hover:bg-[#F37021]/5"
          >
            <Plus size={16} />
            {t('auth.paymentAdd')}
          </button>

          <div className="rounded-xl border border-border bg-white px-5 py-3 text-right shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('auth.paymentPriceTotal')}
            </p>
            <p className="mt-1 text-lg font-bold text-herme-ink">
              {totals.myr > 0 && <span>{formatMoney(totals.myr, 'MYR')} MYR</span>}
              {totals.myr > 0 && totals.usd > 0 && <span className="mx-2 text-muted-foreground">·</span>}
              {totals.usd > 0 && <span>{formatMoney(totals.usd, 'USD')}</span>}
              {totals.myr === 0 && totals.usd === 0 && <span>0.00</span>}
            </p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {pricedLines.map(line => (
                <li key={line.locationId}>
                  {line.locationName}: {formatMoney(line.amount, line.currency)}
                  {line.currency === 'MYR' ? ' MYR' : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleContinue()}
            className="rounded-xl bg-[#F37021] px-6 py-3 text-sm font-semibold text-white hover:bg-[#D4550A] disabled:opacity-60"
          >
            {saving ? t('auth.paymentSaving') : t('auth.continueToApp')}
          </button>
        </div>
      </main>

      {addMode && currentUser && (
        <AddSetupModal
          mode={addMode}
          setMode={setAddMode}
          currentUser={currentUser}
          companies={companies}
          onAdded={onAdded}
          onError={setError}
        />
      )}
    </div>
  );
}

function toCompanyDraft(company: Company): CompanyDraft {
  return {
    id: company.id,
    name: company.name,
    countryCode: company.countryCode || 'MY',
    vendorPolicyTagsJson: company.vendorPolicyTagsJson || '["non-halal"]',
    types: parseStringArrayJson(company.businessTypesJson) as CompanyBusinessType[],
    modules: parseCompanyModules(company.modulesJson),
  };
}

function toLocationDraft(location: LocationConfig, companies: Company[]): LocationDraft {
  const company = companies.find(c => c.id === location.companyId);
  const companyTypes = parseStringArrayJson(company?.businessTypesJson) as CompanyBusinessType[];
  const locTypes = parseStringArrayJson(location.businessTypesJson) as CompanyBusinessType[];
  const inherited = locTypes.length === 0 ? companyTypes : locTypes;
  const single = inherited.find(t => companyTypes.includes(t)) ?? companyTypes[0] ?? null;
  return {
    id: location.id,
    companyId: location.companyId!,
    name: location.name,
    type: single,
  };
}

function CompanyRows({
  company,
  locations,
  onTypesChange,
  onModulesChange,
  onLocationTypeChange,
}: {
  company: CompanyDraft;
  locations: LocationDraft[];
  onTypesChange: (types: CompanyBusinessType[]) => void;
  onModulesChange: (modules: AccessModule[]) => void;
  onLocationTypeChange: (locationId: number, type: CompanyBusinessType) => void;
}) {
  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="px-4 py-4 font-semibold text-herme-ink">{company.name}</td>
        <td className="px-4 py-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F37021]">
              Can tick multiple
            </p>
            {COMPANY_BUSINESS_TYPES.map(type => (
              <label key={type} className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={company.types.includes(type)}
                  onChange={() => {
                    const next = company.types.includes(type)
                      ? company.types.filter(v => v !== type)
                      : [...company.types, type];
                    onTypesChange(next);
                  }}
                />
                <span>{PAYMENT_TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F37021]">
              Can tick multiple
            </p>
            {PLATFORM_MODULES.map(mod => (
              <label key={mod.id} className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={company.modules.includes(mod.id)}
                  onChange={() => {
                    const next = company.modules.includes(mod.id)
                      ? company.modules.filter(v => v !== mod.id)
                      : [...company.modules, mod.id];
                    onModulesChange(next);
                  }}
                />
                <span>{PAYMENT_MODULE_LABELS[mod.id]}</span>
              </label>
            ))}
          </div>
        </td>
      </tr>
      {locations.map(loc => (
        <tr key={loc.id} className="border-b border-border bg-muted/10 align-top">
          <td className="px-4 py-4 pl-8 text-herme-ink/80">{loc.name}</td>
          <td className="px-4 py-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Only one from company types
              </p>
              {company.types.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select company types first</p>
              ) : (
                company.types.map(type => (
                  <label key={type} className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="radio"
                      name={`loc-type-${loc.id}`}
                      className="mt-0.5"
                      checked={loc.type === type}
                      onChange={() => onLocationTypeChange(loc.id, type)}
                    />
                    <span>{PAYMENT_TYPE_LABELS[type]}</span>
                  </label>
                ))
              )}
            </div>
          </td>
          <td className="px-4 py-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Inherits from company
              </p>
              {LOCATION_PLATFORM_MODULES.map(mod => {
                const enabled = company.modules.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex items-start gap-2 text-xs ${enabled ? '' : 'opacity-40'}`}
                  >
                    <input type="checkbox" className="mt-0.5" checked={enabled} disabled readOnly />
                    <span>{PAYMENT_MODULE_LABELS[mod.id]}</span>
                  </label>
                );
              })}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function AddSetupModal({
  mode,
  setMode,
  currentUser,
  companies,
  onAdded,
  onError,
}: {
  mode: Exclude<AddMode, null>;
  setMode: (mode: AddMode) => void;
  currentUser: AppUser;
  companies: CompanyDraft[];
  onAdded: (user?: AppUser) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const { t } = useAppTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? currentUser.companyId ?? 0);
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<CompanyBusinessType | null>(
    companies[0]?.types[0] ?? null,
  );
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTypes, setNewCompanyTypes] = useState<CompanyBusinessType[]>([]);
  const [newCompanyModules, setNewCompanyModules] = useState<AccessModule[]>(['RMS']);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationType, setNewLocationType] = useState<CompanyBusinessType | null>(null);

  const selectedCompany = companies.find(c => c.id === companyId);

  useEffect(() => {
    if (selectedCompany?.types.length && locationType && !selectedCompany.types.includes(locationType)) {
      setLocationType(selectedCompany.types[0] ?? null);
    }
  }, [selectedCompany, locationType]);

  async function assignLocationToUser(locationId: number) {
    const ids = [...new Set([...(currentUser.locationIds ?? []), locationId])];
    return api.updateUser(currentUser.id, {
      employeeId: currentUser.employeeId ?? null,
      fullName: currentUser.fullName,
      email: currentUser.email,
      role: currentUser.role,
      phone: currentUser.phone,
      active: currentUser.active,
      accessJson: currentUser.accessJson,
      companyId: currentUser.companyId,
      locationIdsJson: JSON.stringify(ids),
    });
  }

  async function submitLocation() {
    if (!locationName.trim()) {
      setLocalError(t('auth.locationNameRequired'));
      return;
    }
    if (!companyId || !locationType) {
      setLocalError(t('auth.paymentLocationTypeRequired', { location: locationName || 'Location' }));
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    onError(null);
    try {
      const created = await api.createLocationConfig({
        name: locationName.trim(),
        companyId,
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateProvince: '',
        postcode: '',
        principalContactUserId: currentUser.id,
        businessTypesJson: serializeStringArray([locationType]),
        vendorPolicyTagsJson: '[]',
        modulesJson: '[]',
      });
      const user = await assignLocationToUser(created.id);
      await onAdded(user);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('auth.locationSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCompany() {
    if (!newCompanyName.trim()) {
      setLocalError(t('auth.companyNameRequired'));
      return;
    }
    if (newCompanyTypes.length === 0) {
      setLocalError(t('auth.paymentCompanyTypesRequired', { company: newCompanyName }));
      return;
    }
    if (newCompanyModules.length === 0) {
      setLocalError(t('auth.paymentCompanyModulesRequired', { company: newCompanyName }));
      return;
    }
    if (!newLocationName.trim()) {
      setLocalError(t('auth.locationNameRequired'));
      return;
    }
    const locType = newLocationType ?? newCompanyTypes[0];
    if (!locType || !newCompanyTypes.includes(locType)) {
      setLocalError(t('auth.paymentLocationTypeRequired', { location: newLocationName }));
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    onError(null);
    try {
      const primary = companies[0];
      const createdCompany = await api.createCompany({
        name: newCompanyName.trim(),
        brn: '',
        gstTin: '',
        countryCode: primary?.countryCode ?? 'MY',
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateProvince: '',
        postcode: '',
        phone: '',
        fax: '',
        email: currentUser.email,
        active: true,
        businessTypesJson: serializeStringArray(newCompanyTypes),
        vendorPolicyTagsJson: primary?.vendorPolicyTagsJson || '["non-halal"]',
        modulesJson: serializeStringArray(newCompanyModules),
      });
      addExtraPaymentCompanyId(createdCompany.id);

      await api.createLocationConfig({
        name: newLocationName.trim(),
        companyId: createdCompany.id,
        addressLine1: '',
        addressLine2: '',
        city: '',
        stateProvince: '',
        postcode: '',
        principalContactUserId: currentUser.id,
        businessTypesJson: serializeStringArray([locType]),
        vendorPolicyTagsJson: '[]',
        modulesJson: '[]',
      });
      // Extra companies stay on the payment basket; user remains on primary companyId.
      await onAdded();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t('auth.companySaveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-herme-ink/40 backdrop-blur-sm" onClick={() => !submitting && setMode(null)} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-herme-ink/40 hover:text-herme-ink"
          onClick={() => !submitting && setMode(null)}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        {mode === 'choice' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-herme-ink">{t('auth.paymentAddTitle')}</h2>
            <p className="text-sm text-herme-ink/60">{t('auth.paymentAddHint')}</p>
            <button
              type="button"
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-[#F37021]/50 hover:bg-[#F37021]/5"
              onClick={() => setMode('location')}
            >
              {t('auth.paymentAddLocation')}
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-border px-4 py-3 text-left text-sm font-semibold hover:border-[#F37021]/50 hover:bg-[#F37021]/5"
              onClick={() => setMode('company')}
            >
              {t('auth.paymentAddCompany')}
            </button>
          </div>
        )}

        {mode === 'location' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-herme-ink">{t('auth.paymentAddLocation')}</h2>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </label>
            <select
              className={inputCls}
              value={companyId}
              onChange={e => {
                const id = Number(e.target.value);
                setCompanyId(id);
                const c = companies.find(x => x.id === id);
                setLocationType(c?.types[0] ?? null);
              }}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Location name *
            </label>
            <input className={inputCls} value={locationName} onChange={e => setLocationName(e.target.value)} />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type *</p>
              {(selectedCompany?.types ?? []).map(type => (
                <label key={type} className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="new-loc-type"
                    checked={locationType === type}
                    onChange={() => setLocationType(type)}
                  />
                  <span>{PAYMENT_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
            {localError && <p className="text-sm text-destructive">{localError}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitLocation()}
              className="w-full rounded-xl bg-[#F37021] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? t('auth.savingLocation') : t('auth.paymentAddConfirm')}
            </button>
          </div>
        )}

        {mode === 'company' && (
          <div className="max-h-[80vh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-bold text-herme-ink">{t('auth.paymentAddCompany')}</h2>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company name *
            </label>
            <input className={inputCls} value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company types *</p>
              {COMPANY_BUSINESS_TYPES.map(type => (
                <label key={type} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={newCompanyTypes.includes(type)}
                    onChange={() => {
                      const next = newCompanyTypes.includes(type)
                        ? newCompanyTypes.filter(v => v !== type)
                        : [...newCompanyTypes, type];
                      setNewCompanyTypes(next);
                      if (newLocationType && !next.includes(newLocationType)) {
                        setNewLocationType(next[0] ?? null);
                      } else if (!newLocationType && next[0]) {
                        setNewLocationType(next[0]);
                      }
                    }}
                  />
                  <span>{PAYMENT_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modules *</p>
              {PLATFORM_MODULES.map(mod => (
                <label key={mod.id} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={newCompanyModules.includes(mod.id)}
                    onChange={() => {
                      setNewCompanyModules(prev =>
                        prev.includes(mod.id) ? prev.filter(v => v !== mod.id) : [...prev, mod.id],
                      );
                    }}
                  />
                  <span>{PAYMENT_MODULE_LABELS[mod.id]}</span>
                </label>
              ))}
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              First location name *
            </label>
            <input className={inputCls} value={newLocationName} onChange={e => setNewLocationName(e.target.value)} />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location type *</p>
              {newCompanyTypes.map(type => (
                <label key={type} className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="new-co-loc-type"
                    checked={newLocationType === type}
                    onChange={() => setNewLocationType(type)}
                  />
                  <span>{PAYMENT_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
            {localError && <p className="text-sm text-destructive">{localError}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitCompany()}
              className="w-full rounded-xl bg-[#F37021] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? t('auth.savingCompany') : t('auth.paymentAddConfirm')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated Prefer PaymentPage — kept as alias for existing imports. */
export function SubscriptionPlaceholderPage(props: Props) {
  return <PaymentPage {...props} />;
}
