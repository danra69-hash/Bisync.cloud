import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, type PosCouponYearSummary, type PosCustomer, type PosLoyaltyYearSummary } from '../../api';
import { inputCls } from '../../data/componentForm';
import {
  LOYALTY_UNIT_LABEL,
  parsePosActivityHistory,
  parsePosCouponSummary,
  parsePosLoyaltySummary,
  posCustomerToPayload,
} from '../../data/customerListData';
import { filterSelectCls } from '../layout/formControls';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  companyId: number;
  customer: PosCustomer | null;
  nextExternalId: string;
  onClose: () => void;
  onSaved: (customer: PosCustomer) => void;
};

type FormState = {
  externalId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  fax: string;
  email: string;
};

function toForm(customer: PosCustomer | null, nextExternalId: string): FormState {
  if (!customer) {
    return {
      externalId: nextExternalId,
      name: '',
      address: '',
      city: '',
      state: '',
      postcode: '',
      phone: '',
      fax: '',
      email: '',
    };
  }
  return {
    externalId: customer.externalId,
    name: customer.name,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    postcode: customer.postcode,
    phone: customer.phone,
    fax: customer.fax,
    email: customer.email,
  };
}

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2];
}

export function PosCustomerPanel({ companyId, customer, nextExternalId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(customer, nextExternalId));
  const [loyaltySummary, setLoyaltySummary] = useState<PosLoyaltyYearSummary[]>([]);
  const [couponSummary, setCouponSummary] = useState<PosCouponYearSummary[]>([]);
  const [loyaltyYear, setLoyaltyYear] = useState(new Date().getFullYear());
  const [couponYear, setCouponYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(customer);

  const years = useMemo(() => yearOptions(), []);

  useEffect(() => {
    setForm(toForm(customer, nextExternalId));
    setLoyaltySummary(customer ? parsePosLoyaltySummary(customer) : []);
    setCouponSummary(customer ? parsePosCouponSummary(customer) : []);
  }, [customer, nextExternalId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loyaltyForYear = loyaltySummary.find(s => s.year === loyaltyYear);
  const couponForYear = couponSummary.find(s => s.year === couponYear);

  function upsertLoyaltyYear(year: number, patch: Partial<PosLoyaltyYearSummary>) {
    setLoyaltySummary(prev => {
      const existing = prev.find(s => s.year === year);
      if (existing) {
        return prev.map(s => (s.year === year ? { ...s, ...patch } : s));
      }
      return [...prev, { year, earned: 0, used: 0, balance: 0, ...patch }];
    });
  }

  function upsertCouponYear(year: number, patch: Partial<PosCouponYearSummary>) {
    setCouponSummary(prev => {
      const existing = prev.find(s => s.year === year);
      if (existing) {
        return prev.map(s => (s.year === year ? { ...s, ...patch } : s));
      }
      return [...prev, { year, received: 0, used: 0, ...patch }];
    });
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const base: PosCustomer = customer ?? {
      id: 0,
      companyId,
      externalId: form.externalId,
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
      postcode: form.postcode,
      phone: form.phone,
      fax: form.fax,
      email: form.email,
      loyaltySummaryJson: '[]',
      couponSummaryJson: '[]',
      activityHistoryJson: '[]',
      active: true,
    };

    const payload = posCustomerToPayload(
      {
        ...base,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postcode: form.postcode.trim(),
        phone: form.phone.trim(),
        fax: form.fax.trim(),
        email: form.email.trim(),
      },
      loyaltySummary,
      couponSummary,
      customer ? parsePosActivityHistory(customer) : [],
    );

    setSaving(true);
    try {
      const saved = isEdit
        ? await api.updatePosCustomer(customer!.externalId, payload)
        : await api.createPosCustomer(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save POS customer.');
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
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">POS Customer</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">
              {isEdit ? form.name || 'Edit Customer' : 'Add POS Customer'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-5">
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Customer ID</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.externalId} disabled />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] text-muted-foreground">Name *</span>
                <input className={`${inputCls} mt-1 w-full`} value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
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

          <section className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {LOYALTY_UNIT_LABEL} Earned & Used
              </h4>
              <select className={filterSelectCls} value={loyaltyYear} onChange={e => setLoyaltyYear(Number(e.target.value))}>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Earned</span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} mt-1 w-full`}
                  value={loyaltyForYear?.earned ?? 0}
                  onChange={e => upsertLoyaltyYear(loyaltyYear, { earned: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Used</span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} mt-1 w-full`}
                  value={loyaltyForYear?.used ?? 0}
                  onChange={e => upsertLoyaltyYear(loyaltyYear, { used: parseFloat(e.target.value) || 0 })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Balance</span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} mt-1 w-full`}
                  value={loyaltyForYear?.balance ?? 0}
                  onChange={e => upsertLoyaltyYear(loyaltyYear, { balance: parseFloat(e.target.value) || 0 })}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coupons Received & Used</h4>
              <select className={filterSelectCls} value={couponYear} onChange={e => setCouponYear(Number(e.target.value))}>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Received</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputCls} mt-1 w-full`}
                  value={couponForYear?.received ?? 0}
                  onChange={e => upsertCouponYear(couponYear, { received: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Used</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputCls} mt-1 w-full`}
                  value={couponForYear?.used ?? 0}
                  onChange={e => upsertCouponYear(couponYear, { used: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
            </div>
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
