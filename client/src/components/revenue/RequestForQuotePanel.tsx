import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import {
  api,
  type Company,
  type CreateQuoteRequestPayload,
  type Ingredient,
  type LocationConfig,
  type QuoteRequestDetail,
  type Vendor,
} from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  buildVendorRfqMailtoUrl,
  buildVendorRfqShareUrl,
  buildVendorRfqWhatsAppUrl,
  copyVendorRfqShareLink,
} from '../../data/vendorRfqShare';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  company: Company;
  locations: LocationConfig[];
  selectedLocationIds: string[];
  vendors: Vendor[];
  onClose: () => void;
  onCreated: (rfq: QuoteRequestDetail, createdVendors: Vendor[]) => void;
};

type ExistingVendorPick = {
  key: string;
  vendorExternalId: string;
};

type NewVendorDraft = {
  key: string;
  vendorName: string;
  contactPerson: string;
  email: string;
  mobile: string;
};

type PrincipalLineDraft = {
  key: string;
  componentId: number | '';
  specification: string;
};

type OtherLineDraft = {
  key: string;
  componentName: string;
  specification: string;
};

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatAddressBlock(parts: {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postcode?: string;
  phone?: string;
  email?: string;
  brn?: string;
}): string[] {
  const lines = [parts.name];
  if (parts.brn) lines.push(`BRN: ${parts.brn}`);
  if (parts.addressLine1) lines.push(parts.addressLine1);
  if (parts.addressLine2) lines.push(parts.addressLine2);
  const cityLine = [parts.postcode, parts.city, parts.stateProvince].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (parts.phone) lines.push(`Tel: ${parts.phone}`);
  if (parts.email) lines.push(parts.email);
  return lines;
}

export function RequestForQuotePanel({
  company,
  locations,
  selectedLocationIds,
  vendors,
  onClose,
  onCreated,
}: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [existingPicks, setExistingPicks] = useState<ExistingVendorPick[]>([
    { key: newKey('ev'), vendorExternalId: '' },
  ]);
  const [newVendors, setNewVendors] = useState<NewVendorDraft[]>([]);
  const [principalLines, setPrincipalLines] = useState<PrincipalLineDraft[]>([
    { key: newKey('pl'), componentId: '', specification: '' },
  ]);
  const [otherLines, setOtherLines] = useState<OtherLineDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<QuoteRequestDetail | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    api.ingredients()
      .then(setIngredients)
      .catch(() => setIngredients([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const activeLocations = useMemo(() => {
    const scoped = locations.filter(l => l.companyId === company.id);
    if (selectedLocationIds.length === 0) return scoped;
    return scoped.filter(l => selectedLocationIds.includes(l.externalId));
  }, [locations, company.id, selectedLocationIds]);

  const ingredientById = useMemo(() => {
    const map = new Map<number, Ingredient>();
    for (const row of ingredients) map.set(row.id, row);
    return map;
  }, [ingredients]);

  const sortedVendors = useMemo(
    () => [...vendors].sort((a, b) => a.name.localeCompare(b.name)),
    [vendors],
  );

  async function handleCreate() {
    setError(null);

    const vendorPayload: CreateQuoteRequestPayload['vendors'] = [];
    for (const pick of existingPicks) {
      if (!pick.vendorExternalId) continue;
      const vendor = vendors.find(v => v.externalId === pick.vendorExternalId);
      if (!vendor) {
        setError('One of the selected vendors could not be found.');
        return;
      }
      vendorPayload.push({
        vendorId: vendor.id,
        vendorExternalId: vendor.externalId,
        vendorName: vendor.name,
        contactPerson: vendor.contactPerson || '',
        email: vendor.email || '',
        mobile: vendor.mobile || '',
        isNewVendor: false,
      });
    }

    for (const draft of newVendors) {
      const name = draft.vendorName.trim();
      if (!name && !draft.contactPerson.trim() && !draft.email.trim() && !draft.mobile.trim()) continue;
      if (!name) {
        setError('Other vendor requires a company name.');
        return;
      }
      if (!draft.contactPerson.trim()) {
        setError(`Contact person is required for ${name}.`);
        return;
      }
      if (!draft.email.trim() && !draft.mobile.trim()) {
        setError(`Email or mobile is required for ${name}.`);
        return;
      }
      vendorPayload.push({
        vendorName: name,
        contactPerson: draft.contactPerson.trim(),
        email: draft.email.trim(),
        mobile: draft.mobile.trim(),
        isNewVendor: true,
      });
    }

    if (vendorPayload.length === 0) {
      setError('Add at least one vendor.');
      return;
    }

    const lines: CreateQuoteRequestPayload['lines'] = [];
    for (const line of principalLines) {
      if (line.componentId === '' && !line.specification.trim()) continue;
      if (line.componentId === '') {
        setError('Select a principal component.');
        return;
      }
      const ingredient = ingredientById.get(line.componentId);
      if (!ingredient) {
        setError('Selected principal component was not found.');
        return;
      }
      lines.push({
        kind: 'principal',
        componentId: ingredient.id,
        componentExternalId: ingredient.componentId,
        componentName: ingredient.name,
        specification: line.specification.trim(),
      });
    }

    for (const line of otherLines) {
      const name = line.componentName.trim();
      if (!name && !line.specification.trim()) continue;
      if (!name) {
        setError('Other component needs a name.');
        return;
      }
      lines.push({
        kind: 'other',
        componentName: name,
        specification: line.specification.trim(),
      });
    }

    if (lines.length === 0) {
      setError('Add at least one component line.');
      return;
    }

    setSaving(true);
    try {
      const rfq = await api.createQuoteRequest({
        companyId: company.id,
        locationExternalIds: activeLocations.map(l => l.externalId),
        notes: notes.trim() || undefined,
        vendors: vendorPayload,
        lines,
      });
      const createdVendors = rfq.vendors
        .filter(v => v.isNewVendor)
        .map(v => ({
          id: v.vendorId ?? 0,
          externalId: v.vendorExternalId,
          name: v.vendorName,
          type: 'offline',
          brn: '',
          products: '',
          city: '',
          state: '',
          address: '',
          contactPerson: v.contactPerson,
          contactPosition: '',
          mobile: v.mobile,
          email: v.email,
          contactsJson: '[]',
          engaged: false,
          productPolicyTag: 'non-halal' as const,
        }));
      setCreated(rfq);
      onCreated(rfq, createdVendors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request for quote.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(token: string) {
    try {
      await copyVendorRfqShareLink(token);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(current => (current === token ? null : current)), 2000);
    } catch {
      setError('Could not copy link.');
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Vendors</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Request For Quote</h3>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 rounded-md px-3 py-2 bg-destructive/5">
              {error}
            </p>
          ) : null}

          {created ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-2">
                <p className="text-xs font-semibold text-[#5A7A2A]">
                  {created.rfqNumber} created — share a live link with each vendor.
                </p>
              </div>
              {created.vendors.map(vendor => {
                const url = buildVendorRfqShareUrl(vendor.shareToken);
                return (
                  <div key={vendor.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{vendor.vendorName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[vendor.contactPerson, vendor.email, vendor.mobile].filter(Boolean).join(' · ') || 'No contact'}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{vendor.status}</span>
                    </div>
                    <input
                      readOnly
                      value={url}
                      className={`${inputCls} font-mono text-[11px]`}
                      onFocus={e => e.currentTarget.select()}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(vendor.shareToken)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
                      >
                        {copiedToken === vendor.shareToken ? <Check size={11} /> : <Copy size={11} />}
                        {copiedToken === vendor.shareToken ? 'Copied' : 'Copy link'}
                      </button>
                      <a
                        href={buildVendorRfqMailtoUrl(vendor.email, vendor.shareToken, vendor.vendorName, created.rfqNumber)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                      >
                        <Mail size={11} />
                        Email
                      </a>
                      <a
                        href={buildVendorRfqWhatsAppUrl(vendor.shareToken, vendor.vendorName, created.rfqNumber)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                      >
                        <MessageCircle size={11} />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-foreground">Vendors</h4>
                </div>
                <div className="space-y-2">
                  {existingPicks.map((pick, index) => (
                    <div key={pick.key} className="flex items-center gap-2">
                      <select
                        value={pick.vendorExternalId}
                        onChange={e => {
                          const value = e.target.value;
                          setExistingPicks(prev => prev.map(row => (
                            row.key === pick.key ? { ...row, vendorExternalId: value } : row
                          )));
                        }}
                        className={selectCls}
                      >
                        <option value="">Select vendor…</option>
                        {sortedVendors.map(v => (
                          <option key={v.externalId} value={v.externalId}>
                            {v.name}{v.engaged ? '' : ' (available)'}
                          </option>
                        ))}
                      </select>
                      {existingPicks.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setExistingPicks(prev => prev.filter(row => row.key !== pick.key))}
                          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                          aria-label="Remove vendor"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                      {index === existingPicks.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setExistingPicks(prev => [...prev, { key: newKey('ev'), vendorExternalId: '' }])}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold border border-border text-foreground hover:bg-muted"
                        >
                          <Plus size={12} />
                          Add
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => setNewVendors(prev => [...prev, {
                      key: newKey('nv'),
                      vendorName: '',
                      contactPerson: '',
                      email: '',
                      mobile: '',
                    }])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                  >
                    <Plus size={12} />
                    Other vendors
                  </button>
                  {newVendors.map(draft => (
                    <div key={draft.key} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          New vendor (not engaged)
                        </p>
                        <button
                          type="button"
                          onClick={() => setNewVendors(prev => prev.filter(row => row.key !== draft.key))}
                          className="p-1 rounded text-muted-foreground hover:text-destructive"
                          aria-label="Remove other vendor"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <input
                        className={inputCls}
                        placeholder="Company name *"
                        value={draft.vendorName}
                        onChange={e => setNewVendors(prev => prev.map(row => (
                          row.key === draft.key ? { ...row, vendorName: e.target.value } : row
                        )))}
                      />
                      <input
                        className={inputCls}
                        placeholder="Contact person *"
                        value={draft.contactPerson}
                        onChange={e => setNewVendors(prev => prev.map(row => (
                          row.key === draft.key ? { ...row, contactPerson: e.target.value } : row
                        )))}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          className={inputCls}
                          placeholder="Email"
                          value={draft.email}
                          onChange={e => setNewVendors(prev => prev.map(row => (
                            row.key === draft.key ? { ...row, email: e.target.value } : row
                          )))}
                        />
                        <input
                          className={inputCls}
                          placeholder="Mobile number"
                          value={draft.mobile}
                          onChange={e => setNewVendors(prev => prev.map(row => (
                            row.key === draft.key ? { ...row, mobile: e.target.value } : row
                          )))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-foreground">Requested Principal Component</h4>
                  <button
                    type="button"
                    onClick={() => setPrincipalLines(prev => [...prev, { key: newKey('pl'), componentId: '', specification: '' }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold border border-border text-foreground hover:bg-muted"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                </div>
                {principalLines.map(line => (
                  <div key={line.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="grid grid-cols-[1fr_minmax(140px,1fr)_100px_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Component</label>
                        <select
                          className={selectCls}
                          value={line.componentId === '' ? '' : String(line.componentId)}
                          onChange={e => {
                            const value = e.target.value ? Number(e.target.value) : '';
                            setPrincipalLines(prev => prev.map(row => (
                              row.key === line.key ? { ...row, componentId: value } : row
                            )));
                          }}
                        >
                          <option value="">Select component…</option>
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Delivery unit</label>
                        <input
                          className={`${inputCls} bg-muted/40 text-muted-foreground`}
                          readOnly
                          tabIndex={-1}
                          placeholder="Vendor fills (e.g. 1box/24tin/200gr)"
                          value=""
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Price</label>
                        <input
                          className={`${inputCls} bg-muted/40 text-muted-foreground`}
                          readOnly
                          tabIndex={-1}
                          placeholder="Vendor"
                          value=""
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrincipalLines(prev => (
                          prev.length <= 1 ? prev : prev.filter(row => row.key !== line.key)
                        ))}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted mb-0.5"
                        aria-label="Remove principal line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Specification</label>
                      <textarea
                        className={`${inputCls} min-h-[56px]`}
                        placeholder="Grade, brand, packing notes, etc."
                        value={line.specification}
                        onChange={e => setPrincipalLines(prev => prev.map(row => (
                          row.key === line.key ? { ...row, specification: e.target.value } : row
                        )))}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Delivery unit and price stay blank here — each vendor fills them on their private link.
                </p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-foreground">Other Component</h4>
                  <button
                    type="button"
                    onClick={() => setOtherLines(prev => [...prev, {
                      key: newKey('ol'),
                      componentName: '',
                      specification: '',
                    }])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold border border-border text-foreground hover:bg-muted"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                </div>
                {otherLines.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Optional — add items not in your component list.</p>
                ) : null}
                {otherLines.map(line => (
                  <div key={line.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="grid grid-cols-[1fr_minmax(140px,1fr)_100px_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Name</label>
                        <input
                          className={inputCls}
                          placeholder="Component name"
                          value={line.componentName}
                          onChange={e => setOtherLines(prev => prev.map(row => (
                            row.key === line.key ? { ...row, componentName: e.target.value } : row
                          )))}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Delivery unit</label>
                        <input
                          className={`${inputCls} bg-muted/40 text-muted-foreground`}
                          readOnly
                          tabIndex={-1}
                          placeholder="Vendor fills (e.g. 1box/24tin/200gr)"
                          value=""
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Price</label>
                        <input
                          className={`${inputCls} bg-muted/40 text-muted-foreground`}
                          readOnly
                          tabIndex={-1}
                          placeholder="Vendor"
                          value=""
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setOtherLines(prev => prev.filter(row => row.key !== line.key))}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted mb-0.5"
                        aria-label="Remove other line"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Specification</label>
                      <textarea
                        className={`${inputCls} min-h-[56px]`}
                        placeholder="Grade, brand, packing notes, etc."
                        value={line.specification}
                        onChange={e => setOtherLines(prev => prev.map(row => (
                          row.key === line.key ? { ...row, specification: e.target.value } : row
                        )))}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Notes</h4>
                <textarea
                  className={`${inputCls} min-h-[72px]`}
                  placeholder="Optional instructions for vendors…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </section>

              <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Your Company & Location Detail</h4>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Company</p>
                  {formatAddressBlock({
                    name: company.name,
                    brn: company.brn,
                    addressLine1: company.addressLine1,
                    addressLine2: company.addressLine2,
                    city: company.city,
                    stateProvince: company.stateProvince,
                    postcode: company.postcode,
                    phone: company.phone,
                    email: company.email,
                  }).map(line => (
                    <p key={line} className="text-xs text-foreground">{line}</p>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Location{activeLocations.length === 1 ? '' : 's'}
                  </p>
                  {activeLocations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No locations selected for this company.</p>
                  ) : (
                    activeLocations.map(loc => (
                      <div key={loc.externalId} className="text-xs text-foreground">
                        {formatAddressBlock({
                          name: loc.name,
                          addressLine1: loc.addressLine1,
                          addressLine2: loc.addressLine2,
                          city: loc.city,
                          stateProvince: loc.stateProvince,
                          postcode: loc.postcode,
                        }).map(line => (
                          <p key={`${loc.externalId}-${line}`}>{line}</p>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-border text-foreground hover:bg-muted"
          >
            {created ? 'Close' : 'Cancel'}
          </button>
          {!created ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreate()}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create & Get Links'}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
