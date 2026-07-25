import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  api,
  type LocationConfig,
  type Vendor,
  type VendorProductPolicyTag,
  type VendorUpdatePayload,
} from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  formatVendorAddress,
  formatVendorContact,
} from '../../data/purchaseOrderFormat';
import {
  VENDOR_PRODUCT_POLICY_OPTIONS,
  resolveVendorProductPolicyTag,
} from '../../data/vendorPolicyRules';
import { CountryLocalityFields } from '../shared/CountryLocalityFields';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';

type Props = {
  countryCode: string;
  vendor: Vendor;
  selectedCompanyId: number | null;
  onVendorUpdated: (vendor: Vendor) => void;
};

function parseEngagedLocationIds(vendor: Vendor): string[] {
  const raw = vendor.engagedLocationIdsJson?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(id => String(id ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function vendorToForm(vendor: Vendor): VendorUpdatePayload {
  return {
    name: vendor.name,
    type: vendor.type || 'offline',
    brn: vendor.brn ?? '',
    products: vendor.products ?? '',
    address: vendor.address ?? '',
    city: vendor.city ?? '',
    state: vendor.state ?? '',
    contactPerson: vendor.contactPerson ?? '',
    contactPosition: vendor.contactPosition ?? '',
    mobile: vendor.mobile ?? '',
    email: vendor.email ?? '',
    productPolicyTag: resolveVendorProductPolicyTag(vendor),
    allowPartialDelivery: Boolean(vendor.allowPartialDelivery),
    engagedLocationIds: parseEngagedLocationIds(vendor),
  };
}

export function VendorProductPolicySingleSelect({
  selected,
  onChange,
}: {
  selected: VendorProductPolicyTag;
  onChange: (value: VendorProductPolicyTag) => void;
}) {
  return (
    <div className="space-y-2">
      {VENDOR_PRODUCT_POLICY_OPTIONS.map(option => {
        const checked = selected === option.id;
        return (
          <label
            key={option.id}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(option.id)}
              className="mt-0.5 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{option.label}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{option.description}</span>
            </span>
          </label>
        );
      })}
      <p className="text-[11px] text-muted-foreground">Select one product policy for this vendor.</p>
    </div>
  );
}

function VendorEngagedLocationsModal({
  locations,
  selectedIds,
  onChange,
  onClose,
}: {
  locations: LocationConfig[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function toggleLocation(externalId: string) {
    if (selectedIds.includes(externalId)) {
      onChange(selectedIds.filter(id => id !== externalId));
    } else {
      onChange([...selectedIds, externalId]);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[70]" onClick={onClose} role="presentation" aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-full max-w-sm bg-card border border-border rounded-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Engaged Locations</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Select company locations</p>
            <p className="text-xs text-muted-foreground mt-0.5">Locations where this vendor is engaged.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
          {locations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No locations found for this company.</p>
          ) : (
            locations.map(loc => {
              const checked = selectedIds.includes(loc.externalId);
              return (
                <label
                  key={loc.externalId}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLocation(loc.externalId)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs text-foreground">{loc.name}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground font-sans">
            {selectedIds.length} of {locations.length} selected
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

export function VendorDetailEditor({ countryCode, vendor, selectedCompanyId, onVendorUpdated }: Props) {
  const [form, setForm] = useState(() => vendorToForm(vendor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [companyLocations, setCompanyLocations] = useState<LocationConfig[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    setForm(vendorToForm(vendor));
    setError(null);
    setSuccess(null);
  }, [vendor]);

  useEffect(() => {
    let cancelled = false;
    if (selectedCompanyId == null) {
      setCompanyLocations([]);
      return;
    }
    api.locationsConfig()
      .then(rows => {
        if (cancelled) return;
        setCompanyLocations(rows.filter(loc => loc.companyId === selectedCompanyId));
      })
      .catch(() => {
        if (!cancelled) setCompanyLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId]);

  const engagedLocationIds = form.engagedLocationIds ?? [];

  const engagedLocationChips = useMemo(() => {
    const byId = new Map(companyLocations.map(loc => [loc.externalId, loc.name]));
    return engagedLocationIds.map(id => ({
      id,
      name: byId.get(id) ?? id,
    }));
  }, [companyLocations, engagedLocationIds]);

  const poPreview = useMemo(() => ({
    address: formatVendorAddress({
      ...vendor,
      address: form.address,
      city: form.city,
      state: form.state,
    }),
    contact: formatVendorContact({
      ...vendor,
      contactPerson: form.contactPerson,
      contactPosition: form.contactPosition,
      mobile: form.mobile,
      email: form.email,
    }),
  }), [vendor, form.address, form.city, form.state, form.contactPerson, form.contactPosition, form.mobile, form.email]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(vendorToForm(vendor)),
    [form, vendor],
  );

  function setField<K extends keyof VendorUpdatePayload>(key: K, value: VendorUpdatePayload[K]) {
    setSuccess(null);
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function removeEngagedLocation(externalId: string) {
    setField(
      'engagedLocationIds',
      engagedLocationIds.filter(id => id !== externalId),
    );
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    if (!form.productPolicyTag) {
      setError('Product policy is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api.updateVendor(vendor.externalId, {
        ...form,
        name: form.name.trim(),
        brn: form.brn.trim(),
        products: form.products.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        contactPerson: form.contactPerson.trim(),
        contactPosition: form.contactPosition.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        engagedLocationIds,
      });
      onVendorUpdated(updated);
      setSuccess('Vendor details saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/30 text-left"
      >
        <div>
          <p className="text-xs font-semibold text-foreground">Vendor company details</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Same fields printed on purchase orders (PO).</p>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="px-4 py-4 space-y-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Vendor ID</p>
              <input value={vendor.externalId} readOnly className={`${inputCls} bg-muted/30`} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Type</p>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={selectCls}>
                <option value="offline">Offline Vendor</option>
                <option value="online">Online Vendor</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                Offline = virtual (operator-controlled). Online = cloud vendor (vendor-controlled; relationship later).
              </p>
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">BRN</p>
              <input value={form.brn} onChange={e => setField('brn', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Vendor name (PO)</p>
              <input value={form.name} onChange={e => setField('name', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Type of product supplied</p>
              <input value={form.products} onChange={e => setField('products', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Address (PO)</p>
              <input value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <CountryLocalityFields
                countryCode={countryCode}
                value={{ city: form.city, state: form.state, postcode: '' }}
                onChange={next => {
                  setField('city', next.city);
                  setField('state', next.state);
                }}
                labelClassName="text-xs font-sans text-muted-foreground uppercase tracking-wider"
              />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Contact person</p>
              <input value={form.contactPerson} onChange={e => setField('contactPerson', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Contact position</p>
              <input value={form.contactPosition} onChange={e => setField('contactPosition', e.target.value)} className={inputCls} />
            </div>
            <div />
            <div>
              <CountryPhoneInput
                countryCode={countryCode}
                value={form.mobile}
                onChange={value => setField('mobile', value)}
                label="Mobile"
                variant="mobile"
                showError={false}
              />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <input value={form.email} onChange={e => setField('email', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-2">Product policy *</p>
              <VendorProductPolicySingleSelect
                selected={form.productPolicyTag}
                onChange={value => setField('productPolicyTag', value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Engaged Locations</p>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  disabled={selectedCompanyId == null}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50"
                  title={selectedCompanyId == null ? 'Select a company first' : 'Add location'}
                  aria-label="Add engaged location"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="rounded-lg border border-border px-3 py-2.5 min-h-[8.5rem]">
                {engagedLocationChips.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-2">
                    {selectedCompanyId == null
                      ? 'Select a company to assign engaged locations.'
                      : 'No engaged locations yet. Use + to add from the company location list.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {engagedLocationChips.map(loc => (
                      <span
                        key={loc.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground"
                      >
                        {loc.name}
                        <button
                          type="button"
                          onClick={() => removeEngagedLocation(loc.id)}
                          className="p-0.5 rounded hover:bg-muted transition-colors"
                          aria-label={`Remove ${loc.name}`}
                        >
                          <X size={11} className="text-muted-foreground" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <label
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              form.allowPartialDelivery
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(form.allowPartialDelivery)}
              onChange={e => setField('allowPartialDelivery', e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">Allow Partial Delivery</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                When enabled, POs for this vendor can be received and consolidated in shipments while staying
                active as Partially Delivered until Final delivery completed. Delivery rating is only scored
                against the issued PO after final close (qty/price mismatch).
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">PO preview</p>
            <p className="text-xs font-medium text-foreground">{form.name || '—'}</p>
            {form.brn && <p className="text-xs text-muted-foreground mt-1">BRN: {form.brn}</p>}
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 font-sans">{poPreview.address || '—'}</pre>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 font-sans">{poPreview.contact || '—'}</pre>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-xs text-[#5A7A2A]">{success}</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Check size={12} />
              {saving ? 'Saving…' : 'Save vendor details'}
            </button>
          </div>
        </div>
      )}

      {locationModalOpen && (
        <VendorEngagedLocationsModal
          locations={companyLocations}
          selectedIds={engagedLocationIds}
          onChange={ids => setField('engagedLocationIds', ids)}
          onClose={() => setLocationModalOpen(false)}
        />
      )}
    </div>
  );
}
