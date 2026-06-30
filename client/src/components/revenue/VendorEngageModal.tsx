import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import type { Vendor, EngageVendorContact } from '../../api';
import { contactsForEngageModal, createContactId, toEngageContactPayload } from '../../data/vendorContacts';
import { inputCls } from '../../data/componentForm';

type Props = {
  vendor: Vendor;
  saving: boolean;
  serverError?: string | null;
  onClose: () => void;
  onConfirm: (vendor: Vendor, contacts: EngageVendorContact[]) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function VendorEngageModal({ vendor, saving, serverError, onClose, onConfirm }: Props) {
  const [contacts, setContacts] = useState(() => contactsForEngageModal(vendor));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContacts(contactsForEngageModal(vendor));
    setError(null);
  }, [vendor.externalId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  function updateContact(id: string, patch: Partial<(typeof contacts)[number]>) {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
    setError(null);
  }

  function setDefaultContact(id: string) {
    setContacts(prev => prev.map(c => ({ ...c, isDefault: c.id === id })));
    setError(null);
  }

  function addContact() {
    setContacts(prev => [
      ...prev,
      {
        id: createContactId(),
        name: '',
        position: '',
        mobile: '',
        email: '',
        isDefault: prev.length === 0,
      },
    ]);
  }

  function removeContact(id: string) {
    setContacts(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(c => c.id !== id);
      if (!next.some(c => c.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
  }

  function submitEngage() {
    const valid = contacts.filter(c => c.name.trim() || c.mobile.trim() || c.email.trim());
    if (valid.length === 0) {
      setError('Enter at least one contact with a name, mobile, or email.');
      return;
    }

    const payload = toEngageContactPayload(valid);
    if (!payload.some(c => c.isDefault)) {
      payload[0].isDefault = true;
    } else {
      const firstDefault = payload.findIndex(c => c.isDefault);
      payload.forEach((c, i) => { c.isDefault = i === firstDefault; });
    }
    onConfirm(vendor, payload);
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Engage ${vendor.name}`}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Engage Vendor</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{vendor.name}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{vendor.externalId}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <form
          className="flex flex-col flex-1 min-h-0"
          noValidate
          onSubmit={e => {
            e.preventDefault();
            if (!saving) submitEngage();
          }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <p className="text-[10px] text-muted-foreground">
              Review known sales contact details below. Edit as needed or add another account manager before engaging.
            </p>

            {contacts.map((contact, index) => (
              <div key={contact.id} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                    {index === 0 ? 'Known Sales Contact' : `Account Manager ${index + 1}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground cursor-pointer">
                      <input
                        type="radio"
                        name={`default-contact-${vendor.externalId}`}
                        checked={contact.isDefault}
                        onChange={() => setDefaultContact(contact.id)}
                        className="h-3.5 w-3.5 border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      Default contact
                    </label>
                    {contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(contact.id)}
                        className="p-1 text-muted-foreground hover:text-accent"
                        title="Remove contact"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Name">
                    <input
                      className={inputCls}
                      value={contact.name}
                      onChange={e => updateContact(contact.id, { name: e.target.value })}
                      placeholder="Contact name"
                    />
                  </Field>
                  <Field label="Position">
                    <input
                      className={inputCls}
                      value={contact.position}
                      onChange={e => updateContact(contact.id, { position: e.target.value })}
                      placeholder="e.g. Sales Manager"
                    />
                  </Field>
                  <Field label="Mobile Number">
                    <input
                      className={inputCls}
                      value={contact.mobile}
                      onChange={e => updateContact(contact.id, { mobile: e.target.value })}
                      placeholder="+60 …"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      className={inputCls}
                      value={contact.email}
                      onChange={e => updateContact(contact.id, { email: e.target.value })}
                      placeholder="sales@vendor.com"
                    />
                  </Field>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addContact}
              className="flex items-center gap-1.5 text-[10px] font-mono text-primary hover:underline"
            >
              <Plus size={12} />
              Add account manager
            </button>
          </div>

          <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
            {error && <p className="text-[10px] text-red-500">{error}</p>}
            {serverError && <p className="text-[10px] text-red-500">{serverError}</p>}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-xs font-mono text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Engaging…' : 'Confirm Engage'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
