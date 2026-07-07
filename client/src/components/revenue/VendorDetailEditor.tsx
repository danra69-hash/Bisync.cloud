import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { api, type Vendor, type VendorProductPolicyTag, type VendorUpdatePayload } from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  formatVendorAddress,
  formatVendorContact,
} from '../../data/purchaseOrderFormat';
import {
  VENDOR_PRODUCT_POLICY_OPTIONS,
  resolveVendorProductPolicyTag,
} from '../../data/vendorPolicyRules';

type Props = {
  vendor: Vendor;
  onVendorUpdated: (vendor: Vendor) => void;
};

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

export function VendorDetailEditor({ vendor, onVendorUpdated }: Props) {
  const [form, setForm] = useState(() => vendorToForm(vendor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setForm(vendorToForm(vendor));
    setError(null);
    setSuccess(null);
  }, [vendor]);

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
                <option value="offline">offline</option>
                <option value="online">online</option>
              </select>
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
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">City</p>
              <input value={form.city} onChange={e => setField('city', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">State</p>
              <input value={form.state} onChange={e => setField('state', e.target.value)} className={inputCls} />
            </div>
            <div />
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
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Mobile</p>
              <input value={form.mobile} onChange={e => setField('mobile', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <input value={form.email} onChange={e => setField('email', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-2">Product policy *</p>
            <VendorProductPolicySingleSelect
              selected={form.productPolicyTag}
              onChange={value => setField('productPolicyTag', value)}
            />
          </div>

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
    </div>
  );
}
