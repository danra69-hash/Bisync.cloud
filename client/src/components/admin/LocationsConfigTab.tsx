import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, type Company, type LocationConfig, type AppUser } from '../../api';
import { CountryAddressFields, getAddressValidationError } from '../shared/CountryAddressFields';
import { getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';

function LocationPanel({
  location, companies, users, onClose, onSave,
}: {
  location: LocationConfig;
  companies: Company[];
  users: AppUser[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(location);
  const [error, setError] = useState<string | null>(null);
  const company = companies.find(c => c.id === form.companyId);
  const country = getCountry(company?.countryCode ?? form.countryCode);

  function set<K extends keyof LocationConfig>(key: K, val: LocationConfig[K]) {
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
    const addressError = getAddressValidationError(company?.countryCode ?? form.countryCode, addressParts);
    if (addressError) {
      setError(addressError);
      return;
    }

    await api.updateLocationConfig(form.id, {
      companyId: form.companyId,
      name: form.name,
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      stateProvince: form.stateProvince,
      postcode: form.postcode,
      principalContactUserId: form.principalContactUserId,
    });
    onSave();
    onClose();
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} />
      <div className={SIDE_PANEL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Location</p>
            <h3 className="text-sm font-semibold">{form.name}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs">
              {error}
            </div>
          )}
          <div>
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company *</label>
            <select className={selectCls} value={form.companyId ?? ''} onChange={e => set('companyId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Location Name</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Country (from company)</p>
            <p className="text-xs font-medium mt-0.5">{country.name}</p>
          </div>

          <CountryAddressFields
            countryCode={company?.countryCode ?? form.countryCode}
            value={addressParts}
            onChange={setAddressParts}
          />

          <div>
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Principal Contact</label>
            <select className={selectCls} value={form.principalContactUserId ?? ''} onChange={e => set('principalContactUserId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Select user —</option>
              {users.filter(u => u.active).map(u => (
                <option key={u.id} value={u.id}>{u.fullName} · {u.role}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">User list is managed in the Users tab.</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={!form.companyId} className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50">Save Changes</button>
        </div>
      </div>
    </>
  );
}

export function LocationsConfigTab({ onOrgDataChanged }: { onOrgDataChanged?: () => void }) {
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editLocation, setEditLocation] = useState<LocationConfig | null>(null);

  function refreshList() {
    setLoading(true);
    Promise.all([api.locationsConfig(), api.companies(), api.users()])
      .then(([locs, comps, usrs]) => {
        setLocations(locs);
        setCompanies(comps);
        setUsers(usrs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function afterSave() {
    refreshList();
    onOrgDataChanged?.();
  }

  useEffect(() => { refreshList(); }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{locations.length} locations · each belongs to a company</p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading locations…</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Location', 'Company', 'Address', 'Principal Contact', 'Country'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => setEditLocation(loc)}>
                  <td className="px-4 py-3 font-medium">{loc.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{loc.companyName ?? <span className="text-accent">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[loc.addressLine1, loc.city, loc.stateProvince].filter(Boolean).join(', ') || loc.name}
                  </td>
                  <td className="px-4 py-3">{loc.principalContactName ?? '—'}</td>
                  <td className="px-4 py-3">{getCountry(loc.countryCode).name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editLocation && (
        <LocationPanel
          location={editLocation}
          companies={companies}
          users={users}
          onClose={() => setEditLocation(null)}
          onSave={afterSave}
        />
      )}
    </div>
  );
}
