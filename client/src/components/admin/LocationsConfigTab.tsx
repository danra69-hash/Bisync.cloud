import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Plus, X } from 'lucide-react';
import { api, type Company, type LocationConfig, type AppUser } from '../../api';
import { CountryAddressFields, getAddressValidationError } from '../shared/CountryAddressFields';
import { getCountry, inputCls, selectCls } from '../../data/countries';
import type { AddressParts } from '../../utils/countryFormat';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CLS } from '../layout/sidePanelShared';
import { CompanyProfileFields } from './CompanyProfileFields';
import {
  buildLocationProfilePayload,
  formatBusinessTypesCell,
  formatVendorPolicyCell,
  parseStringArrayJson,
  profileArraysFromCompany,
  resolveLocationProfileForDisplay,
  validateCompanyProfile,
  validateLocationBusinessTypesSubset,
  type CompanyBusinessType,
  type CompanyVendorPolicyTag,
} from '../../data/companyProfile';
import {
  buildLocationModulesPayload,
  modulesFromCompany,
  resolveLocationModulesForDisplay,
  validateLocationModules,
} from '../../data/companyModules';
import type { AccessModule } from '../../data/userAccess';

type LocationSortColumn =
  | 'location'
  | 'company'
  | 'address'
  | 'principalContact'
  | 'businessType'
  | 'productPolicy'
  | 'country';

const LOCATION_TABLE_COLUMNS: SortableColumnDef<LocationSortColumn>[] = [
  { key: 'location', label: 'Location' },
  { key: 'company', label: 'Company' },
  { key: 'address', label: 'Address' },
  { key: 'principalContact', label: 'Principal Contact' },
  { key: 'businessType', label: 'Type of Business' },
  { key: 'productPolicy', label: 'Product Policy' },
  { key: 'country', label: 'Country' },
];

function blankLocation(companyId: number | null = null): LocationConfig {
  return {
    id: 0,
    externalId: '',
    name: '',
    companyId,
    companyName: null,
    countryCode: 'MY',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postcode: '',
    principalContactUserId: null,
    principalContactName: null,
    businessTypesJson: '[]',
    vendorPolicyTagsJson: '[]',
    modulesJson: '[]',
  };
}

function LocationPanel({
  location, isNew, companies, users, onClose, onSave,
}: {
  location: LocationConfig;
  isNew: boolean;
  companies: Company[];
  users: AppUser[];
  onClose: () => void;
  onSave: (saved: LocationConfig) => void;
}) {
  const [form, setForm] = useState(location);
  const initialCompany = companies.find(c => c.id === location.companyId);
  const [inheritsCompanyProfile, setInheritsCompanyProfile] = useState(
    () => isNew || location.profileOverridden !== true,
  );
  const [businessTypes, setBusinessTypes] = useState<CompanyBusinessType[]>(() => {
    if (!isNew && location.profileOverridden) {
      return parseStringArrayJson(location.businessTypesJson) as CompanyBusinessType[];
    }
    return profileArraysFromCompany(initialCompany ?? location).businessTypes;
  });
  const [vendorPolicyTags, setVendorPolicyTags] = useState<CompanyVendorPolicyTag[]>(() => {
    if (!isNew && location.profileOverridden) {
      return parseStringArrayJson(location.vendorPolicyTagsJson) as CompanyVendorPolicyTag[];
    }
    return profileArraysFromCompany(initialCompany ?? location).vendorPolicyTags;
  });
  const [modules, setModules] = useState<AccessModule[]>(() => {
    if (!isNew && location.profileOverridden) {
      return resolveLocationModulesForDisplay(location, initialCompany ?? null);
    }
    return initialCompany ? modulesFromCompany(initialCompany) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const company = companies.find(c => c.id === form.companyId);
  const country = getCountry(company?.countryCode ?? form.countryCode);

  useEffect(() => {
    setForm(location);
    const initial = companies.find(c => c.id === location.companyId);
    const inherits = isNew || location.profileOverridden !== true;
    setInheritsCompanyProfile(inherits);
    if (!isNew && location.profileOverridden) {
      setBusinessTypes(parseStringArrayJson(location.businessTypesJson) as CompanyBusinessType[]);
      setVendorPolicyTags(parseStringArrayJson(location.vendorPolicyTagsJson) as CompanyVendorPolicyTag[]);
      setModules(resolveLocationModulesForDisplay(location, initial ?? null));
    } else {
      const profile = profileArraysFromCompany(initial ?? location);
      setBusinessTypes(profile.businessTypes);
      setVendorPolicyTags(profile.vendorPolicyTags);
      setModules(initial ? modulesFromCompany(initial) : []);
    }
    setError(null);
  }, [location, isNew, companies]);

  useEffect(() => {
    if (!inheritsCompanyProfile || !form.companyId) return;
    const selectedCompany = companies.find(c => c.id === form.companyId);
    if (!selectedCompany) return;
    const profile = profileArraysFromCompany(selectedCompany);
    setBusinessTypes(profile.businessTypes);
    setVendorPolicyTags(profile.vendorPolicyTags);
    setModules(modulesFromCompany(selectedCompany));
  }, [form.companyId, inheritsCompanyProfile, companies]);

  useEffect(() => {
    if (!company) return;
    const companyTypes = profileArraysFromCompany(company).businessTypes;
    setBusinessTypes(prev => prev.filter(type => companyTypes.includes(type)));
    setModules(prev => prev.filter(module => modulesFromCompany(company).includes(module)));
  }, [company?.businessTypesJson, company?.modulesJson]);

  function set<K extends keyof LocationConfig>(key: K, val: LocationConfig[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setError(null);
  }

  function markProfileOverridden() {
    setInheritsCompanyProfile(false);
    setError(null);
  }

  function applyCompanyDefaults() {
    if (!company) return;
    const profile = profileArraysFromCompany(company);
    setBusinessTypes(profile.businessTypes);
    setVendorPolicyTags(profile.vendorPolicyTags);
    setModules(modulesFromCompany(company));
    setInheritsCompanyProfile(true);
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
    if (!form.companyId) {
      setError('Select a company.');
      return;
    }
    if (!form.name.trim()) {
      setError('Location name is required.');
      return;
    }

    const addressError = getAddressValidationError(company?.countryCode ?? form.countryCode, addressParts);
    if (addressError) {
      setError(addressError);
      return;
    }

    if (!company) {
      setError('Selected company could not be found.');
      return;
    }

    const profileError = validateCompanyProfile(businessTypes, vendorPolicyTags);
    if (profileError) {
      setError(profileError);
      return;
    }
    const companyBusinessTypes = profileArraysFromCompany(company).businessTypes;
    const companyModules = modulesFromCompany(company);
    const subsetError = validateLocationBusinessTypesSubset(businessTypes, companyBusinessTypes);
    if (subsetError) {
      setError(subsetError);
      return;
    }
    const modulesError = validateLocationModules(modules, companyModules);
    if (modulesError) {
      setError(modulesError);
      return;
    }

    const profilePayload = buildLocationProfilePayload(
      company,
      businessTypes,
      vendorPolicyTags,
      inheritsCompanyProfile,
    );
    const modulesPayload = buildLocationModulesPayload(company, modules, inheritsCompanyProfile);

    const payload = {
      companyId: form.companyId,
      name: form.name.trim(),
      addressLine1: form.addressLine1,
      addressLine2: form.addressLine2,
      city: form.city,
      stateProvince: form.stateProvince,
      postcode: form.postcode,
      principalContactUserId: form.principalContactUserId,
      businessTypesJson: profilePayload.businessTypesJson,
      vendorPolicyTagsJson: profilePayload.vendorPolicyTagsJson,
      modulesJson: modulesPayload.modulesJson,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = isNew
        ? await api.createLocationConfig(payload)
        : await api.updateLocationConfig(form.id, payload);
      onSave({
        ...form,
        ...saved,
        companyName: company.name,
        countryCode: company.countryCode,
        principalContactName: users.find(u => u.id === form.principalContactUserId)?.fullName ?? null,
        businessTypesJson: saved.businessTypesJson ?? profilePayload.effectiveBusinessTypesJson,
        vendorPolicyTagsJson: saved.vendorPolicyTagsJson ?? profilePayload.effectiveVendorPolicyTagsJson,
        modulesJson: saved.modulesJson ?? modulesPayload.effectiveModulesJson,
        profileOverridden: saved.profileOverridden ?? (profilePayload.profileOverridden || modulesPayload.modulesJson !== '[]'),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} />
      <div className={SIDE_PANEL_SHELL_CLS}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Location</p>
            <h3 className="text-sm font-semibold">{isNew ? 'New Location' : form.name}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-50"><X size={14} className="text-muted-foreground" /></button>
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
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Location Name *</label>
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

          <CompanyProfileFields
            businessTypes={businessTypes}
            vendorPolicyTags={vendorPolicyTags}
            modules={modules}
            availableBusinessTypes={company ? profileArraysFromCompany(company).businessTypes : undefined}
            availableModules={company ? modulesFromCompany(company) : undefined}
            moduleScope="location"
            onBusinessTypesChange={values => {
              setBusinessTypes(values);
              markProfileOverridden();
            }}
            onVendorPolicyTagsChange={values => {
              setVendorPolicyTags(values);
              markProfileOverridden();
            }}
            onModulesChange={values => {
              setModules(values);
              markProfileOverridden();
            }}
            hint={inheritsCompanyProfile
              ? 'Following the company policy. Change any option below to set a custom policy for this location only.'
              : 'This location uses a custom policy. Use company defaults to follow the parent company again.'}
            onUseCompanyDefaults={company ? applyCompanyDefaults : undefined}
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

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Add Location' : 'Save Changes'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">
            Required: company, location name, address, and business/policy settings (inherited from company is fine).
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function LocationsConfigTab({
  selectedCompanyId,
  onOrgDataChanged,
}: {
  selectedCompanyId: number | null;
  onOrgDataChanged?: () => void;
}) {
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editLocation, setEditLocation] = useState<LocationConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

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

  function afterSave(saved: LocationConfig) {
    setLocations(prev => {
      const index = prev.findIndex(loc => loc.id === saved.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...saved };
        return next;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    onOrgDataChanged?.();
    void Promise.all([api.locationsConfig(), api.companies(), api.users()])
      .then(([locs, comps, usrs]) => {
        setCompanies(comps);
        setUsers(usrs);
        if (locs.some(loc => 'businessTypesJson' in loc && loc.businessTypesJson !== undefined)) {
          setLocations(locs);
        }
      })
      .catch(() => {});
  }

  function openCreate() {
    setIsNew(true);
    setEditLocation(blankLocation(selectedCompanyId));
  }

  function closePanel() {
    setEditLocation(null);
    setIsNew(false);
  }

  useEffect(() => { refreshList(); }, []);

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<LocationSortColumn>();

  useEffect(() => { resetSort(); }, [locations, selectedCompanyId, resetSort]);

  const filteredLocations = useMemo(
    () => selectedCompanyId
      ? locations.filter(loc => loc.companyId === selectedCompanyId)
      : locations,
    [locations, selectedCompanyId],
  );

  const sortedLocations = useMemo(
    () =>
      sortTableRows(
        filteredLocations,
        sortColumn,
        sortDirection,
        {
          location: loc => loc.name,
          company: loc => loc.companyName || '',
          address: loc => [loc.addressLine1, loc.city, loc.stateProvince].filter(Boolean).join(', ') || loc.name,
          principalContact: loc => loc.principalContactName || '',
          businessType: loc => {
            const company = companies.find(c => c.id === loc.companyId);
            return formatBusinessTypesCell(resolveLocationProfileForDisplay(loc, company).businessTypesJson);
          },
          productPolicy: loc => {
            const company = companies.find(c => c.id === loc.companyId);
            return formatVendorPolicyCell(resolveLocationProfileForDisplay(loc, company).vendorPolicyTagsJson);
          },
          country: loc => getCountry(loc.countryCode).name,
        },
        { tieBreaker: (a, b) => compareSortValues(a.name, b.name) },
      ),
    [filteredLocations, sortColumn, sortDirection, companies],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedLocations,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedLocations, { scrollRootRef });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {selectedCompanyId
            ? `${filteredLocations.length} of ${locations.length} locations · filtered by company`
            : `${locations.length} locations · each belongs to a company`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-2"
        >
          <Plus size={12} />
          Add Location
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading locations…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <SortableTableHeaderRow
                columns={LOCATION_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border bg-muted/30"
              />
            </thead>
            <tbody>
              {pagedLocations.map(loc => {
                const company = companies.find(c => c.id === loc.companyId);
                const profile = resolveLocationProfileForDisplay(loc, company);
                return (
                <tr key={loc.id} className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => { setIsNew(false); setEditLocation(loc); }}>
                  <td className="px-4 py-3 font-medium">{loc.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{loc.companyName ?? <span className="text-accent">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[loc.addressLine1, loc.city, loc.stateProvince].filter(Boolean).join(', ') || loc.name}
                  </td>
                  <td className="px-4 py-3">{loc.principalContactName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground" title={formatBusinessTypesCell(profile.businessTypesJson)}>
                    <span className="line-clamp-2">
                      {formatBusinessTypesCell(profile.businessTypesJson)}
                      {profile.inherits && <span className="block text-[10px] text-primary/80 mt-0.5">From company</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatVendorPolicyCell(profile.vendorPolicyTagsJson)}
                    {profile.inherits && <span className="block text-[10px] text-primary/80 mt-0.5">From company</span>}
                  </td>
                  <td className="px-4 py-3">{getCountry(loc.countryCode).name}</td>
                </tr>
              );})}
              <InfiniteScrollTableSentinel colSpan={7} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
          </TableScrollContainer>
        )}
      </div>

      {editLocation && (
        <LocationPanel
          location={editLocation}
          isNew={isNew}
          companies={companies}
          users={users}
          onClose={closePanel}
          onSave={afterSave}
        />
      )}
    </div>
  );
}
