import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api, type Company } from '../../api';
import { COUNTRIES, getCountry, inputCls, selectCls } from '../../data/countries';

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
  const country = getCountry(form.countryCode);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function save() {
    if (!form.name.trim()) return;
    if (isNew) await api.createCompany(form);
    else if ('id' in form) await api.updateCompany(form.id, form as Company);
    onSave();
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/10" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
            <h3 className="text-sm font-semibold">{isNew ? 'New Company' : form.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Company Name *</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bisync Hospitality Sdn Bhd" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">BRN</label>
                <input className={inputCls} value={form.brn} onChange={e => set('brn', e.target.value)} placeholder="e.g. 202301012345" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">GST / TIN</label>
                <input className={inputCls} value={form.gstTin} onChange={e => set('gstTin', e.target.value)} placeholder="e.g. SST-2023-00123456" />
              </div>
            </div>

            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Country *</label>
            <select className={selectCls} value={form.countryCode} onChange={e => set('countryCode', e.target.value)}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>

            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Address Line 1</label>
            <input className={inputCls} value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} placeholder="Street address" />

            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Address Line 2</label>
            <input className={inputCls} value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} placeholder="Suite, unit, building (optional)" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.cityLabel}</label>
                <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.stateLabel}</label>
                <select className={selectCls} value={form.stateProvince} onChange={e => set('stateProvince', e.target.value)}>
                  <option value="">— Select —</option>
                  {country.states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{country.postcodeLabel}</label>
            <input className={inputCls} value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder={country.postcodePlaceholder} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Phone</label>
                <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder={country.phonePlaceholder} />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Fax</label>
                <input className={inputCls} value={form.fax} onChange={e => set('fax', e.target.value)} placeholder={country.faxPlaceholder} />
              </div>
            </div>

            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">General Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} placeholder="hq@company.com" />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="text-xs font-mono border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={!form.name.trim()} className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50">
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
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Company', 'BRN', 'GST/TIN', 'Country', 'Email', 'Locations', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => { setIsNew(false); setEditCompany(c); }}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{c.brn || '—'}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{c.gstTin || '—'}</td>
                  <td className="px-4 py-3">{getCountry(c.countryCode).name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 font-mono text-center">{c.locationCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.active ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No companies yet. Add your first company.</td></tr>
              )}
            </tbody>
          </table>
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
