import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { api, type B2bCustomer, type B2bCustomerContact } from '../../api';
import { inputCls } from '../../data/componentForm';
import {
  b2bCustomerToPayload,
  blankB2bContact,
  createCustomerContactId,
  parseB2bCustomerContacts,
  parseB2bPurchaseHistory,
  parseTaggedProductIds,
} from '../../data/customerListData';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  companyId: number;
  customer: B2bCustomer | null;
  nextExternalId: string;
  onClose: () => void;
  onSaved: (customer: B2bCustomer) => void;
};

type FormState = {
  externalId: string;
  companyName: string;
  brn: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
  contacts: B2bCustomerContact[];
};

function toForm(customer: B2bCustomer | null, nextExternalId: string): FormState {
  if (!customer) {
    return {
      externalId: nextExternalId,
      companyName: '',
      brn: '',
      address: '',
      city: '',
      state: '',
      postcode: '',
      phone: '',
      fax: '',
      email: '',
      contacts: [blankB2bContact()],
    };
  }
  const contacts = parseB2bCustomerContacts(customer);
  return {
    externalId: customer.externalId,
    companyName: customer.companyName,
    brn: customer.brn,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    postcode: customer.postcode,
    phone: customer.phone,
    fax: customer.fax,
    email: customer.email,
    contacts: contacts.length > 0 ? contacts : [blankB2bContact()],
  };
}

export function B2bCustomerPanel({ companyId, customer, nextExternalId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(customer, nextExternalId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(customer);

  useEffect(() => {
    setForm(toForm(customer, nextExternalId));
  }, [customer, nextExternalId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function setContact(index: number, patch: Partial<B2bCustomerContact>) {
    setForm(prev => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addContact() {
    setForm(prev => ({
      ...prev,
      contacts: [
        ...prev.contacts.map(c => ({ ...c, isDefault: false })),
        { ...blankB2bContact(), isDefault: false, id: createCustomerContactId() },
      ],
    }));
  }

  function removeContact(index: number) {
    setForm(prev => {
      const next = prev.contacts.filter((_, i) => i !== index);
      if (next.length === 0) return { ...prev, contacts: [blankB2bContact()] };
      if (!next.some(c => c.isDefault)) next[0] = { ...next[0], isDefault: true };
      return { ...prev, contacts: next };
    });
  }

  function setDefaultContact(index: number) {
    setForm(prev => ({
      ...prev,
      contacts: prev.contacts.map((c, i) => ({ ...c, isDefault: i === index })),
    }));
  }

  async function handleSave() {
    setError(null);
    if (!form.companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!form.contacts.some(c => c.name.trim())) {
      setError('At least one contact person name is required.');
      return;
    }

    const taggedProductIds = customer ? parseTaggedProductIds(customer) : [];
    const purchaseHistory = customer ? parseB2bPurchaseHistory(customer) : [];

    const base: B2bCustomer = customer ?? {
      id: 0,
      companyId,
      externalId: form.externalId,
      companyName: form.companyName,
      brn: form.brn,
      address: form.address,
      city: form.city,
      state: form.state,
      postcode: form.postcode,
      phone: form.phone,
      fax: form.fax,
      email: form.email,
      contactsJson: '[]',
      taggedProductIdsJson: '[]',
      purchaseHistoryJson: '[]',
      active: true,
    };

    const payload = b2bCustomerToPayload(
      {
        ...base,
        companyName: form.companyName.trim(),
        brn: form.brn.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postcode: form.postcode.trim(),
        phone: form.phone.trim(),
        fax: form.fax.trim(),
        email: form.email.trim(),
      },
      form.contacts.map(c => ({
        ...c,
        name: c.name.trim(),
        position: c.position.trim(),
        mobile: c.mobile.trim(),
        fax: c.fax.trim(),
      })),
      taggedProductIds,
      purchaseHistory,
    );

    setSaving(true);
    try {
      const saved = isEdit
        ? await api.updateB2bCustomer(customer!.externalId, payload)
        : await api.createB2bCustomer(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={onClose} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">B2B Customer</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">
              {isEdit ? form.companyName || 'Edit Customer' : 'Add Customer'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Customer ID</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.externalId} disabled />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Company Name *</span>
                <input
                  className={`${inputCls} mt-1 w-full`}
                  value={form.companyName}
                  onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">BRN</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.brn} onChange={e => setForm(prev => ({ ...prev, brn: e.target.value }))} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Address</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">City</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.city} onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">State</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.state} onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Postcode</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.postcode} onChange={e => setForm(prev => ({ ...prev, postcode: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Phone</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Fax</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.fax} onChange={e => setForm(prev => ({ ...prev, fax: e.target.value }))} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Email</span>
                <input className={`${inputCls} mt-1 w-full`} type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact Persons</h4>
              <button
                type="button"
                onClick={addContact}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                <Plus size={12} />
                Add Contact
              </button>
            </div>
            {form.contacts.map((contact, index) => (
              <div key={contact.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input
                      type="radio"
                      name="default-contact"
                      checked={contact.isDefault}
                      onChange={() => setDefaultContact(index)}
                    />
                    Primary contact
                  </label>
                  {form.contacts.length > 1 ? (
                    <button type="button" onClick={() => removeContact(index)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Name *</span>
                    <input className={`${inputCls} mt-1 w-full`} value={contact.name} onChange={e => setContact(index, { name: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Position</span>
                    <input className={`${inputCls} mt-1 w-full`} value={contact.position} onChange={e => setContact(index, { position: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Mobile</span>
                    <input className={`${inputCls} mt-1 w-full`} value={contact.mobile} onChange={e => setContact(index, { mobile: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-muted-foreground">Fax</span>
                    <input className={`${inputCls} mt-1 w-full`} value={contact.fax} onChange={e => setContact(index, { fax: e.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </section>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    </>
  );
}
