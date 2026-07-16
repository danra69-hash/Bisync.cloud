import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Mail, MessageCircle, Plus, X } from 'lucide-react';
import {
  api,
  type AppUser,
  type Company,
  type Ingredient,
  type SampleRequestDetail,
  type Vendor,
  type VendorProductPolicyTag,
} from '../../api';
import { inputCls, RECIPE_UNITS, selectCls } from '../../data/componentForm';
import {
  buildSampleRequestMailtoUrl,
  buildSampleRequestShareUrl,
  buildSampleRequestWhatsAppUrl,
  copySampleRequestShareLink,
  previewSampleRequestNumber,
} from '../../data/requestForSample';
import { getSiCategoryFilterOptions, getSiGroupFilterOptions } from '../../data/revenueManagement';
import {
  formatVendorPolicyLabel,
  VENDOR_PRODUCT_POLICY_OPTIONS,
  type CompanyVendorPolicyTag,
} from '../../data/vendorPolicyRules';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  company: Company;
  vendors: Vendor[];
  orgPolicyTags: CompanyVendorPolicyTag[];
  countryCode: string;
  nextVendorExternalId: string;
  onClose: () => void;
  onCreated: (request: SampleRequestDetail) => void;
  onVendorCreated: (vendor: Vendor) => void;
};

const CATEGORY_OPTIONS = getSiCategoryFilterOptions().filter(c => c !== 'All');
const GROUP_OPTIONS = getSiGroupFilterOptions().filter(g => g !== 'All');

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-foreground border-b border-border pb-1">{children}</h4>;
}

function defaultPolicyFromOrg(orgTags: CompanyVendorPolicyTag[]): VendorProductPolicyTag {
  if (orgTags.includes('halal')) return 'halal';
  if (orgTags.includes('muslim-friendly')) return 'muslim-friendly';
  return 'non-halal';
}

export function SampleRequestPanel({
  company,
  vendors,
  orgPolicyTags,
  countryCode,
  nextVendorExternalId,
  onClose,
  onCreated,
  onVendorCreated,
}: Props) {
  const [companyUsers, setCompanyUsers] = useState<AppUser[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dateRequested, setDateRequested] = useState(todayIso);
  const [contactEmployeeId, setContactEmployeeId] = useState<number | ''>('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [vendorExternalId, setVendorExternalId] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorContactPerson, setVendorContactPerson] = useState('');
  const [vendorContactMobile, setVendorContactMobile] = useState('');
  const [vendorContactEmail, setVendorContactEmail] = useState('');
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorSaving, setNewVendorSaving] = useState(false);
  const [productCategory, setProductCategory] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [ingredientComponentId, setIngredientComponentId] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [quantityRequested, setQuantityRequested] = useState('');
  const [quantityUom, setQuantityUom] = useState('');
  const [productPolicyTag, setProductPolicyTag] = useState<VendorProductPolicyTag>(
    () => defaultPolicyFromOrg(orgPolicyTags),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SampleRequestDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setProductPolicyTag(defaultPolicyFromOrg(orgPolicyTags));
  }, [orgPolicyTags]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.users(), api.ingredients()])
      .then(([users, ingredientRows]) => {
        if (cancelled) return;
        setCompanyUsers(users.filter(u => u.companyId === company.id && u.active));
        setIngredients(ingredientRows.filter(i => i.active));
      })
      .catch(() => {
        if (cancelled) return;
        setCompanyUsers([]);
        setIngredients([]);
      });
    return () => { cancelled = true; };
  }, [company.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !newVendorSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving, newVendorSaving]);

  const categoryOptions = useMemo(() => {
    const fromData = ingredients.map(i => i.category).filter(Boolean);
    return [...new Set([...CATEGORY_OPTIONS, ...fromData])].sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  const groupOptions = useMemo(() => {
    const scoped = ingredients.filter(i => !productCategory || i.category === productCategory);
    const fromData = scoped.map(i => i.group).filter(Boolean);
    return [...new Set([...GROUP_OPTIONS, ...fromData])].sort((a, b) => a.localeCompare(b));
  }, [ingredients, productCategory]);

  const filteredIngredients = useMemo(() => {
    return ingredients
      .filter(i => !productCategory || i.category === productCategory)
      .filter(i => !productGroup || i.group === productGroup)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, productCategory, productGroup]);

  const selectedIngredient = filteredIngredients.find(i => i.componentId === ingredientComponentId)
    ?? ingredients.find(i => i.componentId === ingredientComponentId);

  const uomOptions = useMemo(() => {
    const fromIngredients = ingredients.map(i => i.recipeUom).filter(Boolean);
    return [...new Set([...RECIPE_UNITS, ...fromIngredients])].sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  function applyVendor(vendor: Vendor | undefined) {
    if (!vendor) {
      setVendorAddress('');
      setVendorContactPerson('');
      setVendorContactMobile('');
      setVendorContactEmail('');
      return;
    }
    setVendorAddress(vendor.address || [vendor.city, vendor.state].filter(Boolean).join(', '));
    setVendorContactPerson(vendor.contactPerson || '');
    setVendorContactMobile(vendor.mobile || '');
    setVendorContactEmail(vendor.email || '');
  }

  async function handleCreateVendor() {
    const name = newVendorName.trim();
    if (!name) {
      setError('Enter a vendor company name.');
      return;
    }
    setNewVendorSaving(true);
    setError(null);
    try {
      const vendor = await api.createVendor({
        externalId: nextVendorExternalId,
        name,
        type: 'offline',
        brn: '',
        products: '',
        city: '',
        state: '',
        address: vendorAddress,
        contactPerson: vendorContactPerson,
        contactPosition: '',
        mobile: vendorContactMobile,
        email: vendorContactEmail,
        productPolicyTag,
      });
      onVendorCreated(vendor);
      setVendorExternalId(vendor.externalId);
      applyVendor(vendor);
      setShowNewVendor(false);
      setNewVendorName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor.');
    } finally {
      setNewVendorSaving(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    const resolvedContactName = contactPersonName.trim()
      || (contactEmployeeId === ''
        ? ''
        : (companyUsers.find(u => u.id === contactEmployeeId)?.fullName ?? ''));
    if (!resolvedContactName) {
      setError('Select a contact person.');
      return;
    }
    const vendor = vendors.find(v => v.externalId === vendorExternalId);
    const vendorName = vendor?.name?.trim() || newVendorName.trim();
    if (!vendorExternalId && !vendorName) {
      setError('Select or add a vendor.');
      return;
    }
    if (!selectedIngredient && !ingredientComponentId) {
      setError('Select a product sample name.');
      return;
    }
    const qty = parseFloat(quantityRequested);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a requested amount quantity.');
      return;
    }
    if (!quantityUom.trim()) {
      setError('Select a principal UOM.');
      return;
    }

    const productName = selectedIngredient?.name ?? '';
    const selectedUser = companyUsers.find(u => u.id === contactEmployeeId);

    setSaving(true);
    try {
      const result = await api.createSampleRequest({
        templateType: 'sample-request',
        companyId: company.id,
        dateRequested,
        contactEmployeeId: selectedUser?.employeeId ?? null,
        contactPersonName: resolvedContactName,
        companyRequested: company.name,
        customerExternalId: vendorExternalId || undefined,
        customerName: vendor?.name ?? vendorName,
        isNewCustomer: false,
        vendorExternalId: vendorExternalId || undefined,
        vendorAddress: vendorAddress.trim(),
        vendorContactPerson: vendorContactPerson.trim(),
        vendorContactMobile: vendorContactMobile.trim(),
        vendorContactEmail: vendorContactEmail.trim(),
        ingredientComponentId: selectedIngredient?.componentId ?? ingredientComponentId,
        productPolicyTag,
        projectName: productName,
        productCategory: productCategory || selectedIngredient?.category || undefined,
        productGroup: productGroup || selectedIngredient?.group || undefined,
        productSamples: [{
          name: productName,
          description: productDescription.trim(),
        }],
        quantityRequested: qty,
        quantityUom: quantityUom.trim(),
      });
      setCreated(result);
      onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit sample request.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!created?.shareToken) return;
    try {
      await copySampleRequestShareLink(created.shareToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy link.');
    }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && !newVendorSaving && onClose()} />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Sample & Quote</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Sample Request</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{company.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || newVendorSaving}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}

          {created ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-3 space-y-1">
                <p className="text-xs font-semibold text-[#5A7A2A] flex items-center gap-1.5">
                  <Check size={14} />
                  Sample request {created.requestNumber} created.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vendor: {created.customerName} · Product: {created.projectName}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Product PDF / accept link</p>
                <p className="text-[11px] text-muted-foreground">
                  Share this link so the vendor can review the sample request and accept it.
                </p>
                <input
                  readOnly
                  value={buildSampleRequestShareUrl(created.shareToken)}
                  className={`${inputCls} font-mono text-[11px]`}
                  onFocus={e => e.currentTarget.select()}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a
                    href={buildSampleRequestMailtoUrl(
                      created.shareToken,
                      created.requestNumber,
                      created.customerName,
                      created.vendorContactEmail,
                      'sample-request',
                    )}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                  >
                    <Mail size={11} />
                    Email
                  </a>
                  <a
                    href={buildSampleRequestWhatsAppUrl(
                      created.shareToken,
                      created.requestNumber,
                      created.customerName,
                      'sample-request',
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                  >
                    <MessageCircle size={11} />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <SectionTitle>Request</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Sample request number</FieldLabel>
                    <input
                      readOnly
                      value={previewSampleRequestNumber(dateRequested)}
                      className={`${inputCls} bg-muted/40 text-muted-foreground`}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Date-prefixed number assigned on create.</p>
                  </div>
                  <div>
                    <FieldLabel>Date requested</FieldLabel>
                    <input
                      type="date"
                      value={dateRequested}
                      onChange={e => setDateRequested(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Contact person</FieldLabel>
                    <select
                      value={contactEmployeeId === '' ? '' : String(contactEmployeeId)}
                      onChange={e => {
                        const value = e.target.value ? Number(e.target.value) : '';
                        setContactEmployeeId(value);
                        const user = companyUsers.find(u => u.id === value);
                        if (user) setContactPersonName(user.fullName);
                      }}
                      className={selectCls}
                    >
                      <option value="">Select employee…</option>
                      {companyUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.fullName}
                          {user.employeeCode ? ` (${user.employeeCode})` : ''}
                        </option>
                      ))}
                    </select>
                    {companyUsers.length === 0 ? (
                      <input
                        value={contactPersonName}
                        onChange={e => setContactPersonName(e.target.value)}
                        placeholder="Contact person name"
                        className={`${inputCls} mt-2`}
                      />
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Vendor information</SectionTitle>
                <div>
                  <FieldLabel>Company</FieldLabel>
                  <div className="flex gap-2">
                    <select
                      value={vendorExternalId}
                      onChange={e => {
                        const id = e.target.value;
                        setVendorExternalId(id);
                        setShowNewVendor(false);
                        applyVendor(vendors.find(v => v.externalId === id));
                      }}
                      className={`${selectCls} flex-1`}
                    >
                      <option value="">Select vendor…</option>
                      {vendors.map(v => (
                        <option key={v.externalId} value={v.externalId}>{v.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewVendor(true);
                        setVendorExternalId('');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                      title="Add new vendor"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                </div>

                {showNewVendor ? (
                  <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                    <FieldLabel>New vendor company name</FieldLabel>
                    <input
                      value={newVendorName}
                      onChange={e => setNewVendorName(e.target.value)}
                      placeholder="Vendor company name"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      disabled={newVendorSaving}
                      onClick={() => void handleCreateVendor()}
                      className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {newVendorSaving ? 'Saving…' : 'Save vendor'}
                    </button>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FieldLabel>Address</FieldLabel>
                    <input value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>Contact person</FieldLabel>
                    <input value={vendorContactPerson} onChange={e => setVendorContactPerson(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>Contact mobile</FieldLabel>
                    <input value={vendorContactMobile} onChange={e => setVendorContactMobile(e.target.value)} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Contact email</FieldLabel>
                    <input
                      type="email"
                      value={vendorContactEmail}
                      onChange={e => setVendorContactEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Product sample</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Category</FieldLabel>
                    <select
                      value={productCategory}
                      onChange={e => {
                        setProductCategory(e.target.value);
                        setIngredientComponentId('');
                      }}
                      className={selectCls}
                    >
                      <option value="">All categories</option>
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Group</FieldLabel>
                    <select
                      value={productGroup}
                      onChange={e => {
                        setProductGroup(e.target.value);
                        setIngredientComponentId('');
                      }}
                      className={selectCls}
                    >
                      <option value="">All groups</option>
                      {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Product sample name</FieldLabel>
                    <select
                      value={ingredientComponentId}
                      onChange={e => {
                        const id = e.target.value;
                        setIngredientComponentId(id);
                        const ingredient = ingredients.find(i => i.componentId === id);
                        if (ingredient) {
                          if (!productCategory) setProductCategory(ingredient.category);
                          if (!productGroup) setProductGroup(ingredient.group);
                          if (ingredient.recipeUom) setQuantityUom(ingredient.recipeUom);
                        }
                      }}
                      className={selectCls}
                    >
                      <option value="">Select smart ingredient…</option>
                      {filteredIngredients.map(i => (
                        <option key={i.componentId} value={i.componentId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Product description</FieldLabel>
                    <textarea
                      value={productDescription}
                      onChange={e => setProductDescription(e.target.value)}
                      rows={3}
                      className={inputCls}
                      placeholder="Describe the sample requirement…"
                    />
                  </div>
                  <div>
                    <FieldLabel>Requested amount (QTY)</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={quantityRequested}
                      onChange={e => setQuantityRequested(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel>Principal UOM</FieldLabel>
                    <select value={quantityUom} onChange={e => setQuantityUom(e.target.value)} className={selectCls}>
                      <option value="">Select UOM…</option>
                      {uomOptions.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Product policy</FieldLabel>
                    <select
                      value={productPolicyTag}
                      onChange={e => setProductPolicyTag(e.target.value as VendorProductPolicyTag)}
                      className={selectCls}
                    >
                      {VENDOR_PRODUCT_POLICY_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Defaults from company setting
                      {orgPolicyTags.length > 0
                        ? `: ${orgPolicyTags.map(formatVendorPolicyLabel).join(', ')}`
                        : ''}.
                      Country: {countryCode || '—'}
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || newVendorSaving}
            className="px-3 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
          >
            {created ? 'Close' : 'Cancel'}
          </button>
          {!created ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || newVendorSaving}
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
