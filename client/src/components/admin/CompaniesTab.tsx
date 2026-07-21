import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus, X, Mail } from 'lucide-react';
import { api, type Company } from '../../api';
import {
  parseStringArrayJson,
  serializeStringArray,
  validateCompanyProfile,
  type CompanyBusinessType,
  type CompanyVendorPolicyTag,
} from '../../data/companyProfile';
import {
  COMPANY_ACCESS_COLUMN_MODULES,
  parseCompanyModules,
  validateCompanyModules,
} from '../../data/companyModules';
import type { AccessModule } from '../../data/userAccess';
import { CountryAddressFields, getAddressValidationError } from '../shared/CountryAddressFields';
import { CountryPhoneInput, getPhoneValidationError } from '../shared/CountryPhoneInput';
import { COUNTRIES, getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';
import { CompanyProfileFields } from './CompanyProfileFields';
import { ToggleSwitch } from './ToggleSwitch';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import {
  defaultsForOutboundProvider,
  normalizeOutboundProviderMode,
  outboundEmailReady,
  tipForOutboundMode,
  OUTBOUND_PROVIDER_MODES,
  type OutboundProviderMode,
} from '../../data/outboundEmailProvider';

type CompanySortColumn = 'name' | 'brn' | 'gstTin' | 'country' | 'email' | 'locations' | 'status';
type CompanyTableColumn = CompanySortColumn | 'accessControl';

const COMPANY_TABLE_COLUMNS: SortableColumnDef<CompanyTableColumn>[] = [
  { key: 'name', label: 'Company' },
  { key: 'brn', label: 'BRN' },
  { key: 'gstTin', label: 'GST/TIN' },
  { key: 'country', label: 'Country' },
  { key: 'accessControl', label: 'Access Control', sortable: false, className: 'w-[11.5rem]' },
  { key: 'email', label: 'Email' },
  { key: 'locations', label: 'Locations', align: 'center' },
  { key: 'status', label: 'Status' },
];

function CompanyAccessControlCell({
  company,
  disabled,
  onToggle,
}: {
  company: Company;
  disabled: boolean;
  onToggle: (moduleId: AccessModule) => void;
}) {
  const enabled = parseCompanyModules(company.modulesJson);

  return (
    <div className="space-y-1 py-0.5" onClick={e => e.stopPropagation()}>
      {COMPANY_ACCESS_COLUMN_MODULES.map(module => {
        const checked = enabled.includes(module.id);
        return (
          <label
            key={module.id}
            className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            title={module.label}
            onClick={e => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={e => {
                e.stopPropagation();
                if (!disabled) onToggle(module.id);
              }}
              className="rounded border-border shrink-0"
            />
            <span className="text-[11px] leading-tight text-foreground truncate">{module.label}</span>
          </label>
        );
      })}
    </div>
  );
}

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
  smtpHost: '',
  smtpPort: 587,
  smtpUseSsl: true,
  smtpUsername: '',
  smtpPassword: '',
  smtpFromEmail: '',
  smtpFromName: '',
  smtpPasswordSet: false,
  smtpProviderMode: 'auto',
});

function CompanyPanel({
  company, isNew, onClose, onSave,
}: {
  company: Company | CompanyDraft;
  isNew: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(company);
  const [businessTypes, setBusinessTypes] = useState<CompanyBusinessType[]>(
    () => parseStringArrayJson(company.businessTypesJson) as CompanyBusinessType[],
  );
  const [vendorPolicyTags, setVendorPolicyTags] = useState<CompanyVendorPolicyTag[]>(
    () => parseStringArrayJson(company.vendorPolicyTagsJson) as CompanyVendorPolicyTag[],
  );
  const [modules, setModules] = useState<AccessModule[]>(
    () => parseCompanyModules(company.modulesJson),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smtpPasswordDraft, setSmtpPasswordDraft] = useState('');
  const [testToEmail, setTestToEmail] = useState(() => company.email || company.smtpFromEmail || '');
  const [testingEmail, setTestingEmail] = useState(false);
  /** Success/error for outbound test — kept near the Send button (not only the top banner). */
  const [outboundFeedback, setOutboundFeedback] = useState<{
    kind: 'ok' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Reset panel form only when switching companies — do not wipe outbound feedback when the
  // parent refreshes the same company after save (that previously cleared errors silently).
  const companyKey = !('id' in company) ? 'new' : String(company.id);
  useEffect(() => {
    const mode = normalizeOutboundProviderMode(
      'smtpProviderMode' in company ? company.smtpProviderMode : 'auto',
    );
    const email = company.smtpFromEmail || '';
    const defaults = defaultsForOutboundProvider(mode, email);
    setForm({
      ...company,
      smtpProviderMode: mode,
      smtpHost: (company.smtpHost ?? '').trim() || defaults.host,
      smtpPort: company.smtpPort && company.smtpPort > 0 ? company.smtpPort : defaults.port,
      smtpUseSsl: company.smtpUseSsl ?? defaults.useSsl,
      smtpUsername: (company.smtpUsername ?? '').trim() || email,
    });
    setBusinessTypes(parseStringArrayJson(company.businessTypesJson) as CompanyBusinessType[]);
    setVendorPolicyTags(parseStringArrayJson(company.vendorPolicyTagsJson) as CompanyVendorPolicyTag[]);
    setModules(parseCompanyModules(company.modulesJson));
    setSmtpPasswordDraft('');
    setTestToEmail(company.email || company.smtpFromEmail || '');
    setOutboundFeedback(null);
    setError(null);
  }, [companyKey]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: reset on company switch only

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setError(null);
    if (key === 'smtpFromEmail' || key === 'smtpFromName' || key === 'smtpProviderMode'
      || key === 'smtpHost' || key === 'smtpPort' || key === 'smtpUseSsl' || key === 'smtpUsername') {
      setOutboundFeedback(null);
    }
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

  const providerMode = normalizeOutboundProviderMode(form.smtpProviderMode);
  const outboundAddress = (form.smtpFromEmail ?? '').trim();
  const providerInfo = tipForOutboundMode(providerMode, outboundAddress);

  function buildPayload(active = form.active) {
    const outboundEmail = (form.smtpFromEmail ?? '').trim();
    const mode = providerMode;
    const defaults = defaultsForOutboundProvider(mode, outboundEmail);
    const host = (form.smtpHost ?? '').trim() || defaults.host;
    const username = (form.smtpUsername ?? '').trim() || outboundEmail;
    return {
      ...form,
      active,
      businessTypesJson: serializeStringArray(businessTypes),
      vendorPolicyTagsJson: serializeStringArray(vendorPolicyTags),
      modulesJson: serializeStringArray(modules),
      smtpProviderMode: mode,
      smtpFromEmail: outboundEmail,
      smtpUsername: username,
      smtpPassword: smtpPasswordDraft.trim(),
      smtpFromName: (form.smtpFromName ?? '').trim(),
      smtpHost: host,
      smtpPort: form.smtpPort && form.smtpPort > 0 ? form.smtpPort : defaults.port,
      smtpUseSsl: form.smtpUseSsl ?? defaults.useSsl,
    };
  }

  const canTestOutbound =
    !isNew
    && 'id' in form
    && outboundEmailReady(
      outboundAddress,
      smtpPasswordDraft,
      Boolean(form.smtpPasswordSet),
      providerMode,
      (form.smtpHost ?? '').trim() || defaultsForOutboundProvider(providerMode, outboundAddress).host,
    );

  function applyProviderMode(mode: OutboundProviderMode) {
    const defaults = defaultsForOutboundProvider(mode, outboundAddress);
    setForm(f => ({
      ...f,
      smtpProviderMode: mode,
      // Prefill recommended host/port; custom keeps existing host if already typed.
      smtpHost: mode === 'custom' && (f.smtpHost ?? '').trim()
        ? f.smtpHost
        : defaults.host,
      smtpPort: defaults.port,
      smtpUseSsl: defaults.useSsl,
    }));
    setError(null);
    setOutboundFeedback(null);
  }

  async function toggleActive() {
    if (isNew || !('id' in form)) return;

    setSaving(true);
    setError(null);
    try {
      const nextActive = !form.active;
      await api.updateCompany(form.id, { ...buildPayload(nextActive), id: form.id } as Company);
      setForm(f => ({ ...f, active: nextActive }));
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update company status.');
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Company name is required.');
      return;
    }

    const profileError = validateCompanyProfile(businessTypes, vendorPolicyTags);
    if (profileError) {
      setError(profileError);
      return;
    }
    const modulesError = validateCompanyModules(modules);
    if (modulesError) {
      setError(modulesError);
      return;
    }

    const phoneError = getPhoneValidationError(form.countryCode, form.phone, 'Phone', false);
    const faxError = getPhoneValidationError(form.countryCode, form.fax, 'Fax', false);
    const addressError = getAddressValidationError(form.countryCode, addressParts);
    const validationError = phoneError ?? faxError ?? addressError;
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildPayload();

    setSaving(true);
    setError(null);
    try {
      if (isNew) await api.createCompany(payload);
      else if ('id' in form) {
        const saved = await api.updateCompany(form.id, { ...payload, id: form.id } as Company);
        setForm(f => ({
          ...f,
          ...saved,
          smtpPassword: '',
          smtpPasswordSet: saved.smtpPasswordSet
            ?? (smtpPasswordDraft.trim().length > 0 || Boolean(f.smtpPasswordSet)),
        }));
        setSmtpPasswordDraft('');
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!('id' in form)) {
      setOutboundFeedback({
        kind: 'error',
        text: 'Save the company first, then send a test email.',
      });
      return;
    }
    const address = (form.smtpFromEmail ?? '').trim();
    if (!outboundEmailReady(
      address,
      smtpPasswordDraft,
      Boolean(form.smtpPasswordSet),
      providerMode,
      (form.smtpHost ?? '').trim() || defaultsForOutboundProvider(providerMode, address).host,
    )) {
      setOutboundFeedback({
        kind: 'error',
        text: !(form.smtpHost ?? '').trim() && !defaultsForOutboundProvider(providerMode, address).host
          ? 'Enter the SMTP host before testing.'
          : 'Enter the outbound email, password, and SMTP host before testing.',
      });
      return;
    }
    const to = testToEmail.trim();
    if (!to.includes('@') || !to.includes('.')) {
      setOutboundFeedback({
        kind: 'error',
        text: 'Enter a valid test recipient email.',
      });
      return;
    }

    setTestingEmail(true);
    setError(null);
    setOutboundFeedback({
      kind: 'info',
      text: 'Saving settings, then connecting to the mail server… this can take up to 30 seconds.',
    });
    try {
      const passwordForTest = smtpPasswordDraft.trim();
      const payload = buildPayload();
      // Persist credentials first, but do NOT refresh the parent list yet — that used to
      // remount/resync the panel and wipe the error banner before it was visible.
      const saved = await api.updateCompany(form.id, { ...payload, id: form.id } as Company);
      setForm(f => ({
        ...f,
        ...saved,
        smtpPassword: '',
        smtpProviderMode: normalizeOutboundProviderMode(saved.smtpProviderMode ?? providerMode),
        smtpPasswordSet: saved.smtpPasswordSet
          ?? (passwordForTest.length > 0 || Boolean(f.smtpPasswordSet)),
      }));

      setOutboundFeedback({
        kind: 'info',
        text: `Connecting via ${providerInfo.label}…`,
      });

      const result = await api.testCompanyOutboundEmail(form.id, {
        toEmail: to,
        smtpFromEmail: address,
        smtpFromName: (form.smtpFromName ?? '').trim() || undefined,
        smtpUsername: (form.smtpUsername ?? '').trim() || address,
        smtpProviderMode: providerMode,
        smtpHost: (payload.smtpHost as string) || undefined,
        smtpPort: Number(payload.smtpPort) || 587,
        smtpUseSsl: Boolean(payload.smtpUseSsl ?? true),
        // Pass draft password explicitly so test does not depend on a race with save.
        smtpPassword: passwordForTest || undefined,
      });
      setSmtpPasswordDraft('');
      setOutboundFeedback({ kind: 'ok', text: result.message });
      if (result.provider) {
        setForm(f => ({
          ...f,
          smtpProviderLabel: result.provider,
          smtpProviderMode: normalizeOutboundProviderMode(result.smtpProviderMode ?? providerMode),
        }));
      }
      onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test email failed.';
      setOutboundFeedback({ kind: 'error', text: message });
      // Also mirror at top so other save errors stay consistent if user scrolls up.
      setError(message);
    } finally {
      setTestingEmail(false);
    }
  }

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">{isNew ? 'New Company' : form.name}</h3>
              {!isNew && (
                <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${form.active ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                  {form.active ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50"><X size={14} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company Name *</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bisync Hospitality Sdn Bhd" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">BRN</label>
                <input className={inputCls} value={form.brn} onChange={e => set('brn', e.target.value)} placeholder="e.g. 202301012345" />
              </div>
              <div>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">GST / TIN</label>
                <input className={inputCls} value={form.gstTin} onChange={e => set('gstTin', e.target.value)} placeholder="e.g. SST-2023-00123456" />
              </div>
            </div>

            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Country *</label>
            <select className={selectCls} value={form.countryCode} onChange={e => {
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
            }}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
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

            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">General Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="hq@company.com" />

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Mail size={14} className="mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Outbound email</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Enter the mailbox details your tenant provides: email, password, provider, and SMTP host.
                    Choosing a provider prefills the usual host — you can edit everything before testing.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Email address *
                  </label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.smtpFromEmail ?? ''}
                    onChange={e => {
                      const next = e.target.value;
                      setForm(f => {
                        const mode = normalizeOutboundProviderMode(f.smtpProviderMode);
                        const defaults = defaultsForOutboundProvider(mode, next);
                        const shouldPrefillHost = mode !== 'custom'
                          && (!(f.smtpHost ?? '').trim()
                            || f.smtpHost === 'smtp.office365.com'
                            || f.smtpHost === 'smtp.gmail.com'
                            || f.smtpHost === defaultsForOutboundProvider(mode, f.smtpFromEmail ?? '').host);
                        return {
                          ...f,
                          smtpFromEmail: next,
                          smtpUsername: !(f.smtpUsername ?? '').trim()
                            || f.smtpUsername === (f.smtpFromEmail ?? '')
                            ? next
                            : f.smtpUsername,
                          smtpHost: shouldPrefillHost ? defaults.host : f.smtpHost,
                          smtpPort: shouldPrefillHost ? defaults.port : f.smtpPort,
                        };
                      });
                      setError(null);
                      setOutboundFeedback(null);
                    }}
                    placeholder="orders@company.com"
                    autoComplete="off"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Password *{form.smtpPasswordSet ? ' (saved)' : ''}
                  </label>
                  <input
                    type="password"
                    className={inputCls}
                    value={smtpPasswordDraft}
                    onChange={e => {
                      setSmtpPasswordDraft(e.target.value);
                      setError(null);
                      setOutboundFeedback(null);
                    }}
                    placeholder={form.smtpPasswordSet ? 'Leave blank to keep saved password' : 'Email password or App Password'}
                    autoComplete="new-password"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Display name (optional)
                  </label>
                  <input
                    className={inputCls}
                    value={form.smtpFromName ?? ''}
                    onChange={e => set('smtpFromName', e.target.value)}
                    placeholder="Company Purchasing"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Mail provider *
                  </label>
                  <select
                    className={selectCls}
                    value={providerMode}
                    onChange={e => applyProviderMode(e.target.value as OutboundProviderMode)}
                    disabled={testingEmail || saving}
                  >
                    {OUTBOUND_PROVIDER_MODES.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    SMTP host *
                  </label>
                  <input
                    className={inputCls}
                    value={form.smtpHost ?? ''}
                    onChange={e => set('smtpHost', e.target.value)}
                    placeholder="smtp.office365.com"
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Microsoft: smtp.office365.com · Google: smtp.gmail.com · Relay: e.g. smtp.sendgrid.net
                  </p>
                </div>
                <div>
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    Port *
                  </label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.smtpPort ?? 587}
                    onChange={e => set('smtpPort', Number(e.target.value) || 587)}
                    min={1}
                    max={65535}
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(form.smtpUseSsl ?? true)}
                      onChange={e => set('smtpUseSsl', e.target.checked)}
                    />
                    Use TLS / SSL
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                    SMTP username
                  </label>
                  <input
                    className={inputCls}
                    value={form.smtpUsername ?? ''}
                    onChange={e => set('smtpUsername', e.target.value)}
                    placeholder="Usually the same as the email address"
                    autoComplete="off"
                  />
                </div>
              </div>

              {providerInfo && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1">
                  <p className="text-[11px] font-medium">
                    {providerMode === 'auto' ? `Suggested: ${providerInfo.label}` : providerInfo.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{providerInfo.tip}</p>
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-2">
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                  Test recipient email
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    className={inputCls}
                    value={testToEmail}
                    onChange={e => {
                      setTestToEmail(e.target.value);
                      setError(null);
                      setOutboundFeedback(null);
                    }}
                    placeholder="you@company.com"
                    disabled={isNew || testingEmail || saving}
                  />
                  <button
                    type="button"
                    disabled={isNew || testingEmail || saving}
                    onClick={() => void sendTestEmail()}
                    title={
                      isNew
                        ? 'Save the company first'
                        : canTestOutbound
                          ? 'Save and send a test email'
                          : 'Enter email, password, and SMTP host first'
                    }
                    className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail size={12} />
                    {testingEmail ? 'Sending…' : 'Send test email'}
                  </button>
                </div>
                {isNew && (
                  <p className="text-[11px] text-muted-foreground">
                    Save the company once, then reopen to send a test email.
                  </p>
                )}
                {!isNew && !canTestOutbound && (
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    {!outboundAddress.includes('@')
                      ? 'Enter the outbound email address above.'
                      : !(smtpPasswordDraft.trim() || form.smtpPasswordSet)
                        ? 'Enter the email password (Google/Microsoft MFA usually needs an App Password).'
                        : !(form.smtpHost ?? '').trim()
                            && !defaultsForOutboundProvider(providerMode, outboundAddress).host
                          ? 'Enter the SMTP host.'
                          : 'Complete outbound email settings to send a test.'}
                  </p>
                )}
                {outboundFeedback && (
                  <div
                    role="status"
                    className={
                      outboundFeedback.kind === 'error'
                        ? 'px-3 py-2 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-[11px] whitespace-pre-wrap break-words'
                        : outboundFeedback.kind === 'ok'
                          ? 'px-3 py-2 rounded-md border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-[11px] whitespace-pre-wrap break-words'
                          : 'px-3 py-2 rounded-md border border-border bg-muted/40 text-muted-foreground text-[11px] whitespace-pre-wrap break-words'
                    }
                  >
                    {outboundFeedback.text}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div>
                <p className="text-xs font-medium">Company status</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Inactive companies stay in the registry but are hidden from day-to-day selection.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{form.active ? 'Active' : 'Inactive'}</span>
                <ToggleSwitch
                  checked={form.active}
                  disabled={saving}
                  onChange={active => set('active', active)}
                  label={form.active ? 'Deactivate company' : 'Activate company'}
                />
              </div>
            </div>

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
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3">
            {!isNew && 'id' in form ? (
              <button
                type="button"
                onClick={() => void toggleActive()}
                disabled={saving}
                className={`text-xs font-sans border rounded-md px-4 py-2 disabled:opacity-50 ${
                  form.active
                    ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                    : 'border-[#5A7A2A]/30 text-[#5A7A2A] hover:bg-[#5A7A2A]/10'
                }`}
              >
                {saving ? 'Saving…' : form.active ? 'Deactivate Company' : 'Activate Company'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={saving} className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50">
                {saving ? 'Saving…' : isNew ? 'Add Company' : 'Save Changes'}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">
            Required: company name, at least one business type, and one vendor product policy.
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function CompaniesTab({ onOrgDataChanged }: { onOrgDataChanged?: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelDraft, setPanelDraft] = useState<Company | CompanyDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [togglingCompanyId, setTogglingCompanyId] = useState<number | null>(null);

  function refreshList() {
    setLoading(true);
    api.companies()
      .then(rows => {
        setCompanies(rows);
        // Keep the open panel in sync without remounting (companyKey stays the same,
        // so outbound success/error feedback is not cleared).
        setPanelDraft(prev => {
          if (!prev || !('id' in prev)) return prev;
          const next = rows.find(c => c.id === prev.id);
          return next ?? prev;
        });
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }

  function afterSave() {
    refreshList();
    onOrgDataChanged?.();
  }

  async function toggleCompanyModule(company: Company, moduleId: AccessModule) {
    const current = parseCompanyModules(company.modulesJson);
    const next = current.includes(moduleId)
      ? current.filter(value => value !== moduleId)
      : [...current, moduleId];
    const modulesError = validateCompanyModules(next);
    if (modulesError) return;

    setTogglingCompanyId(company.id);
    const modulesJson = serializeStringArray(next);
    try {
      await api.updateCompany(company.id, { ...company, modulesJson });
      setCompanies(prev => prev.map(c => (c.id === company.id ? { ...c, modulesJson } : c)));
      onOrgDataChanged?.();
    } catch {
      refreshList();
    } finally {
      setTogglingCompanyId(null);
    }
  }

  useEffect(() => { refreshList(); }, []);

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<CompanySortColumn>();

  useEffect(() => { resetSort(); }, [companies, resetSort]);

  const sortedCompanies = useMemo(
    () =>
      sortTableRows(
        companies,
        sortColumn,
        sortDirection,
        {
          name: c => c.name,
          brn: c => c.brn || '',
          gstTin: c => c.gstTin || '',
          country: c => getCountry(c.countryCode).name,
          email: c => c.email || '',
          locations: c => c.locationCount,
          status: c => c.active,
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [companies, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedCompanies,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount, nextPageSize, loadMore } = useInfiniteScrollSlice(sortedCompanies, { scrollRootRef });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{companies.length} registered companies</p>
        <button
          type="button"
          onClick={() => { setIsNew(true); setPanelDraft(blankCompany()); }}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md">
          <Plus size={12} /> Add Company
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <MillstoneLoader size="sm" layout="block" label="Loading companies…" />
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <SortableTableHeaderRow
                columns={COMPANY_TABLE_COLUMNS as SortableColumnDef<CompanySortColumn>[]}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border bg-muted/30"
              />
            </thead>
            <tbody>
              {pagedCompanies.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => { setIsNew(false); setPanelDraft(c); }}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-sans text-muted-foreground">{c.brn || '—'}</td>
                  <td className="px-4 py-3 font-sans text-muted-foreground">{c.gstTin || '—'}</td>
                  <td className="px-4 py-3">{getCountry(c.countryCode).name}</td>
                  <td className="px-3 py-2 align-top">
                    <CompanyAccessControlCell
                      company={c}
                      disabled={togglingCompanyId === c.id}
                      onToggle={moduleId => void toggleCompanyModule(c, moduleId)}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 font-sans text-center">{c.locationCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-sans px-1.5 py-0.5 rounded ${c.active ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No companies yet. Add your first company.</td></tr>
              )}
              <InfiniteScrollTableSentinel colSpan={8} hasMore={hasMore} onLoadMore={loadMore} nextPageSize={nextPageSize} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
          </TableScrollContainer>
        )}
      </div>

      {panelDraft && (
        <CompanyPanel
          company={panelDraft}
          isNew={isNew}
          onClose={() => { setPanelDraft(null); setIsNew(false); }}
          onSave={afterSave}
        />
      )}
    </div>
  );
}
