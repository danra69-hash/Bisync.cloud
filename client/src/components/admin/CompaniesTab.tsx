import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus, X } from 'lucide-react';
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

  useEffect(() => {
    setForm(company);
    setBusinessTypes(parseStringArrayJson(company.businessTypesJson) as CompanyBusinessType[]);
    setVendorPolicyTags(parseStringArrayJson(company.vendorPolicyTagsJson) as CompanyVendorPolicyTag[]);
    setModules(parseCompanyModules(company.modulesJson));
    setError(null);
  }, [company]);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
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

  function buildPayload(active = form.active) {
    return {
      ...form,
      active,
      businessTypesJson: serializeStringArray(businessTypes),
      vendorPolicyTagsJson: serializeStringArray(vendorPolicyTags),
      modulesJson: serializeStringArray(modules),
    };
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
      else if ('id' in form) await api.updateCompany(form.id, { ...payload, id: form.id } as Company);
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company.');
    } finally {
      setSaving(false);
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
      .then(setCompanies)
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
