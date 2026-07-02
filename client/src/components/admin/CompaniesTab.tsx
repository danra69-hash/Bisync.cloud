import { useEffect, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { Plus, X } from 'lucide-react';
import { api, type Company } from '../../api';
import { CountryAddressFields, getAddressValidationError } from '../shared/CountryAddressFields';
import { CountryPhoneInput, getPhoneValidationError } from '../shared/CountryPhoneInput';
import { COUNTRIES, getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';

const blankCompany = (): Omit<Company, 'id' | 'locationCount'> => ({
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
});

function CompanyPanel({
  company, isNew, onClose, onSave,
}: {
  company: Company | Omit<Company, 'id' | 'locationCount'>;
  isNew: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(company);
  const [error, setError] = useState<string | null>(null);

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

  async function save() {
    if (!form.name.trim()) return;

    const phoneError = getPhoneValidationError(form.countryCode, form.phone, 'Phone', false);
    const faxError = getPhoneValidationError(form.countryCode, form.fax, 'Fax', false);
    const addressError = getAddressValidationError(form.countryCode, addressParts);
    const validationError = phoneError ?? faxError ?? addressError;
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isNew) await api.createCompany(form);
    else if ('id' in form) await api.updateCompany(form.id, form as Company);
    onSave();
    onClose();
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
            <h3 className="text-sm font-semibold">{isNew ? 'New Company' : form.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
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
              />
            </div>

            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">General Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="hq@company.com" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={!form.name.trim()} className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50">
            {isNew ? 'Add Company' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export function CompaniesTab({ onOrgDataChanged }: { onOrgDataChanged?: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [isNew, setIsNew] = useState(false);

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

  useEffect(() => { refreshList(); }, []);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedCompanies,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(companies, { scrollRootRef });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{companies.length} registered companies</p>
        <button onClick={() => { setIsNew(true); setEditCompany(blankCompany() as Company); }}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md">
          <Plus size={12} /> Add Company
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading companies…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Company', 'BRN', 'GST/TIN', 'Country', 'Email', 'Locations', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedCompanies.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => { setIsNew(false); setEditCompany(c); }}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-sans text-muted-foreground">{c.brn || '—'}</td>
                  <td className="px-4 py-3 font-sans text-muted-foreground">{c.gstTin || '—'}</td>
                  <td className="px-4 py-3">{getCountry(c.countryCode).name}</td>
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No companies yet. Add your first company.</td></tr>
              )}
              <InfiniteScrollTableSentinel colSpan={7} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
          </TableScrollContainer>
        )}
      </div>

      {editCompany && (
        <CompanyPanel
          company={editCompany}
          isNew={isNew}
          onClose={() => { setEditCompany(null); setIsNew(false); }}
          onSave={afterSave}
        />
      )}
    </div>
  );
}
