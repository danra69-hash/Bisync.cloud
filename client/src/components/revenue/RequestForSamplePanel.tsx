import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Mail, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import {
  api,
  type AppUser,
  type B2bCustomer,
  type Company,
  type Ingredient,
  type Product,
  type SampleRequestDetail,
} from '../../api';
import { inputCls, RECIPE_UNITS, selectCls } from '../../data/componentForm';
import {
  buildSampleRequestMailtoUrl,
  buildSampleRequestShareUrl,
  buildSampleRequestWhatsAppUrl,
  copySampleRequestShareLink,
  previewSampleRequestNumber,
  SAMPLE_REQUEST_COUNTRY_OPTIONS,
} from '../../data/requestForSample';
import { siCategories, siGroups } from '../../data/revenueManagement';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  company: Company;
  onClose: () => void;
  onCreated: (request: SampleRequestDetail) => void;
};

type ProductSampleDraft = {
  key: string;
  name: string;
  description: string;
};

const CATEGORY_OPTIONS = siCategories.filter(c => c !== 'All');
const GROUP_OPTIONS = siGroups.filter(g => g !== 'All');

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

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

function TickOption({
  label,
  checked,
  onChange,
  name,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-foreground mr-4">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border-border"
      />
      {label}
    </label>
  );
}

function RadioOption({
  label,
  checked,
  onChange,
  name,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  name: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-foreground mr-4">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function RequestForSamplePanel({ company, onClose, onCreated }: Props) {
  const [companyUsers, setCompanyUsers] = useState<AppUser[]>([]);
  const [customers, setCustomers] = useState<B2bCustomer[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [dateRequested, setDateRequested] = useState(todayIso);
  const [contactEmployeeId, setContactEmployeeId] = useState<number | ''>('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [customerPick, setCustomerPick] = useState('__new__');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [projectScope, setProjectScope] = useState<'new' | 'ongoing'>('new');
  const [requestType, setRequestType] = useState<'new_submission' | 'repeat' | 'modification'>('new_submission');
  const [modificationDetails, setModificationDetails] = useState('');
  const [projectName, setProjectName] = useState('');
  const [deliveryUnit, setDeliveryUnit] = useState('');
  const [expectedQtyPerYear, setExpectedQtyPerYear] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productGroup, setProductGroup] = useState('');
  const [productSamples, setProductSamples] = useState<ProductSampleDraft[]>([
    { key: newKey('ps'), name: '', description: '' },
  ]);

  const [waterSoluble, setWaterSoluble] = useState(false);
  const [oilSoluble, setOilSoluble] = useState(false);
  const [flavourNatural, setFlavourNatural] = useState(false);
  const [flavourNaturalIdentical, setFlavourNaturalIdentical] = useState(false);
  const [flavourArtificial, setFlavourArtificial] = useState(false);
  const [quantityRequested, setQuantityRequested] = useState('');
  const [quantityUom, setQuantityUom] = useState('');
  const [targetProducts, setTargetProducts] = useState('');
  const [gmoStatus, setGmoStatus] = useState<'na' | 'required' | 'not_required'>('na');
  const [allergenStatus, setAllergenStatus] = useState<'na' | 'not_concerned' | 'free_from'>('na');
  const [allergenFreeFromDetail, setAllergenFreeFromDetail] = useState('');
  const [mcpdHvpFreeDetail, setMcpdHvpFreeDetail] = useState('');
  const [halalCertified, setHalalCertified] = useState(false);
  const [halalCompliantAccepted, setHalalCompliantAccepted] = useState(false);
  const [countryRdSite, setCountryRdSite] = useState('');
  const [countryManufacturing, setCountryManufacturing] = useState('');
  const [countryInUse, setCountryInUse] = useState('');
  const [regulatoryRequirement, setRegulatoryRequirement] = useState<'na' | 'yes'>('na');
  const [regulatoryRequirementDetail, setRegulatoryRequirementDetail] = useState('');
  const [customerDeadline, setCustomerDeadline] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SampleRequestDetail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.users(),
      api.b2bCustomers(company.id),
      api.ingredients(),
      api.products(company.id),
    ])
      .then(([users, customerRows, ingredientRows, productRows]) => {
        const scoped = users.filter(u => u.companyId === company.id && u.active);
        setCompanyUsers(scoped);
        setCustomers(customerRows.filter(c => c.active));
        setIngredients(ingredientRows);
        setProducts(productRows);
      })
      .catch(() => {
        setCompanyUsers([]);
        setCustomers([]);
        setIngredients([]);
        setProducts([]);
      });
  }, [company.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const uomOptions = useMemo(() => {
    const fromIngredients = ingredients.map(i => i.recipeUom).filter(Boolean);
    return [...new Set([...RECIPE_UNITS, ...fromIngredients])].sort((a, b) => a.localeCompare(b));
  }, [ingredients]);

  const groupOptions = useMemo(() => {
    const fromData = [
      ...ingredients.map(i => i.group),
      ...products.map(p => p.group),
      ...GROUP_OPTIONS,
    ].filter(Boolean);
    return [...new Set(fromData)].sort((a, b) => a.localeCompare(b));
  }, [ingredients, products]);

  const expectedSalesAmount = useMemo(() => {
    const qty = parseFloat(expectedQtyPerYear);
    const price = parseFloat(expectedPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return qty * price;
  }, [expectedQtyPerYear, expectedPrice]);

  const selectedCustomer = customers.find(c => c.externalId === customerPick);

  const customerName = customerPick === '__new__'
    ? newCustomerName.trim()
    : (selectedCustomer?.companyName ?? '');

  async function handleSubmit() {
    setError(null);
    const resolvedContactName = contactPersonName.trim()
      || (contactEmployeeId === ''
        ? ''
        : (companyUsers.find(u => u.id === contactEmployeeId || u.employeeId === contactEmployeeId)?.fullName ?? ''));
    if (!resolvedContactName) {
      setError('Enter or select a contact person.');
      return;
    }
    if (!customerName) {
      setError('Select or enter a customer name.');
      return;
    }
    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    if (!productSamples.some(s => s.name.trim())) {
      setError('Add at least one product sample name.');
      return;
    }
    if (requestType === 'modification' && !modificationDetails.trim()) {
      setError('Describe the modification required.');
      return;
    }
    if (allergenStatus === 'free_from' && !allergenFreeFromDetail.trim()) {
      setError('Specify allergen-free details.');
      return;
    }
    if (regulatoryRequirement === 'yes' && !regulatoryRequirementDetail.trim()) {
      setError('Specify regulatory requirement details.');
      return;
    }

    const qty = parseFloat(expectedQtyPerYear);
    const price = parseFloat(expectedPrice);
    const sampleQty = parseFloat(quantityRequested);
    const selectedUser = companyUsers.find(u => u.id === contactEmployeeId || u.employeeId === contactEmployeeId);

    setSaving(true);
    try {
      const result = await api.createSampleRequest({
        companyId: company.id,
        dateRequested,
        contactEmployeeId: selectedUser?.employeeId ?? null,
        contactPersonName: resolvedContactName,
        companyRequested: company.name,
        customerExternalId: customerPick === '__new__' ? undefined : customerPick,
        customerName,
        isNewCustomer: customerPick === '__new__',
        projectScope,
        requestType,
        modificationDetails: requestType === 'modification' ? modificationDetails.trim() : undefined,
        projectName: projectName.trim(),
        deliveryUnit: deliveryUnit.trim(),
        expectedQtyPerYear: Number.isFinite(qty) ? qty : 0,
        expectedPrice: Number.isFinite(price) ? price : 0,
        productCategory: productCategory || undefined,
        productGroup: productGroup || undefined,
        productSamples: productSamples
          .filter(s => s.name.trim())
          .map(s => ({ name: s.name.trim(), description: s.description.trim() })),
        waterSoluble,
        oilSoluble,
        flavourNatural,
        flavourNaturalIdentical,
        flavourArtificial,
        quantityRequested: Number.isFinite(sampleQty) ? sampleQty : 0,
        quantityUom: quantityUom || undefined,
        targetProducts: targetProducts.trim() || undefined,
        gmoStatus,
        allergenStatus,
        allergenFreeFromDetail: allergenStatus === 'free_from' ? allergenFreeFromDetail.trim() : undefined,
        mcpdHvpFreeDetail: mcpdHvpFreeDetail.trim() || undefined,
        halalCertified,
        halalCompliantAccepted,
        countryRdSite: countryRdSite || undefined,
        countryManufacturing: countryManufacturing || undefined,
        countryInUse: countryInUse || undefined,
        regulatoryRequirement,
        regulatoryRequirementDetail: regulatoryRequirement === 'yes' ? regulatoryRequirementDetail.trim() : undefined,
        customerDeadline: customerDeadline || null,
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
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Sample & Quote</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Sample Request for Flavours</h3>
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
              <div className="rounded-lg border border-[#5A7A2A]/30 bg-[#5A7A2A]/10 px-3 py-3 space-y-1">
                <p className="text-xs font-semibold text-[#5A7A2A] flex items-center gap-1.5">
                  <Check size={14} />
                  Sample request {created.requestNumber} submitted.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Customer: {created.customerName} · Project: {created.projectName}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Share link</p>
                <p className="text-[11px] text-muted-foreground">
                  Copy or email this link so others can open the sample request.
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
                <SectionTitle>Request details</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Sample request number</FieldLabel>
                    <input
                      readOnly
                      value={previewSampleRequestNumber(dateRequested)}
                      className={`${inputCls} bg-muted/40 text-muted-foreground`}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Final sequence assigned on submit.</p>
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
                  <div>
                    <FieldLabel>Contact person</FieldLabel>
                    {companyUsers.length > 0 ? (
                      <select
                        value={contactEmployeeId}
                        onChange={e => {
                          const value = e.target.value ? Number(e.target.value) : '';
                          setContactEmployeeId(value);
                          if (value === '') {
                            return;
                          }
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
                    ) : null}
                    <input
                      value={contactPersonName}
                      onChange={e => {
                        setContactPersonName(e.target.value);
                        setContactEmployeeId('');
                      }}
                      placeholder={companyUsers.length > 0 ? 'Or type contact name…' : 'Contact person name'}
                      className={`${inputCls} ${companyUsers.length > 0 ? 'mt-2' : ''}`}
                    />
                  </div>
                  <div>
                    <FieldLabel>Company requested</FieldLabel>
                    <input readOnly value={company.name} className={`${inputCls} bg-muted/40`} />
                  </div>
                </div>

                <div>
                  <FieldLabel>Customer name</FieldLabel>
                  <select
                    value={customerPick}
                    onChange={e => setCustomerPick(e.target.value)}
                    className={selectCls}
                  >
                    <option value="__new__">+ Add new customer</option>
                    {customers.map(customer => (
                      <option key={customer.externalId} value={customer.externalId}>
                        {customer.companyName}
                      </option>
                    ))}
                  </select>
                  {customerPick === '__new__' ? (
                    <input
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      placeholder="New customer name"
                      className={`${inputCls} mt-2`}
                    />
                  ) : null}
                </div>

                <div>
                  <FieldLabel>Project</FieldLabel>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <RadioOption
                      name="projectScope"
                      label="New project"
                      checked={projectScope === 'new'}
                      onChange={() => setProjectScope('new')}
                    />
                    <RadioOption
                      name="projectScope"
                      label="Ongoing project"
                      checked={projectScope === 'ongoing'}
                      onChange={() => setProjectScope('ongoing')}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Request type</FieldLabel>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <RadioOption
                      name="requestType"
                      label="New submission"
                      checked={requestType === 'new_submission'}
                      onChange={() => setRequestType('new_submission')}
                    />
                    <RadioOption
                      name="requestType"
                      label="Repeat"
                      checked={requestType === 'repeat'}
                      onChange={() => setRequestType('repeat')}
                    />
                    <RadioOption
                      name="requestType"
                      label="Modification"
                      checked={requestType === 'modification'}
                      onChange={() => setRequestType('modification')}
                    />
                  </div>
                  {requestType === 'modification' ? (
                    <textarea
                      value={modificationDetails}
                      onChange={e => setModificationDetails(e.target.value)}
                      placeholder="Modification required…"
                      rows={3}
                      className={`${inputCls} mt-2`}
                    />
                  ) : null}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Project name</FieldLabel>
                    <input value={projectName} onChange={e => setProjectName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>Delivery unit</FieldLabel>
                    <input value={deliveryUnit} onChange={e => setDeliveryUnit(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>Expected QTY / year</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={expectedQtyPerYear}
                      onChange={e => setExpectedQtyPerYear(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel>Expected price</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={expectedPrice}
                      onChange={e => setExpectedPrice(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Expected sales amount / year</FieldLabel>
                    <input
                      readOnly
                      value={expectedSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      className={`${inputCls} bg-muted/40 font-semibold`}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Product samples</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Product category</FieldLabel>
                    <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className={selectCls}>
                      <option value="">Select category…</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Product group</FieldLabel>
                    <select value={productGroup} onChange={e => setProductGroup(e.target.value)} className={selectCls}>
                      <option value="">Select group…</option>
                      {groupOptions.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {productSamples.map((sample, index) => (
                    <div key={sample.key} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-foreground">Sample {index + 1}</p>
                        {productSamples.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setProductSamples(prev => prev.filter(s => s.key !== sample.key))}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            aria-label="Remove sample"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                      <div>
                        <FieldLabel>Product sample name</FieldLabel>
                        <input
                          value={sample.name}
                          onChange={e => setProductSamples(prev => prev.map(s => (
                            s.key === sample.key ? { ...s, name: e.target.value } : s
                          )))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <FieldLabel>Product description</FieldLabel>
                        <textarea
                          value={sample.description}
                          onChange={e => setProductSamples(prev => prev.map(s => (
                            s.key === sample.key ? { ...s, description: e.target.value } : s
                          )))}
                          rows={2}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setProductSamples(prev => [...prev, { key: newKey('ps'), name: '', description: '' }])}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold border border-primary text-primary hover:bg-primary/10"
                  >
                    <Plus size={11} />
                    Add product sample
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Specific conditions</SectionTitle>

                <div>
                  <FieldLabel>Solubility</FieldLabel>
                  <div className="mt-1">
                    <TickOption label="Water soluble" checked={waterSoluble} onChange={setWaterSoluble} />
                    <TickOption label="Oil soluble" checked={oilSoluble} onChange={setOilSoluble} />
                  </div>
                </div>

                <div>
                  <FieldLabel>Flavour status</FieldLabel>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <TickOption label="Natural" checked={flavourNatural} onChange={setFlavourNatural} />
                    <TickOption label="Natural identical" checked={flavourNaturalIdentical} onChange={setFlavourNaturalIdentical} />
                    <TickOption label="Artificial" checked={flavourArtificial} onChange={setFlavourArtificial} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Quantity requested</FieldLabel>
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
                    <FieldLabel>UOM (principal component)</FieldLabel>
                    <select value={quantityUom} onChange={e => setQuantityUom(e.target.value)} className={selectCls}>
                      <option value="">Select UOM…</option>
                      {uomOptions.map(uom => (
                        <option key={uom} value={uom}>{uom}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel>Target products (if any)</FieldLabel>
                  <input value={targetProducts} onChange={e => setTargetProducts(e.target.value)} className={inputCls} />
                </div>

                <div>
                  <FieldLabel>GMO free</FieldLabel>
                  <div className="mt-1">
                    <RadioOption name="gmo" label="NA" checked={gmoStatus === 'na'} onChange={() => setGmoStatus('na')} />
                    <RadioOption name="gmo" label="Required" checked={gmoStatus === 'required'} onChange={() => setGmoStatus('required')} />
                    <RadioOption name="gmo" label="Not required" checked={gmoStatus === 'not_required'} onChange={() => setGmoStatus('not_required')} />
                  </div>
                </div>

                <div>
                  <FieldLabel>Allergen</FieldLabel>
                  <div className="mt-1">
                    <RadioOption name="allergen" label="NA" checked={allergenStatus === 'na'} onChange={() => setAllergenStatus('na')} />
                    <RadioOption name="allergen" label="Not concerned" checked={allergenStatus === 'not_concerned'} onChange={() => setAllergenStatus('not_concerned')} />
                    <RadioOption name="allergen" label="Free from" checked={allergenStatus === 'free_from'} onChange={() => setAllergenStatus('free_from')} />
                  </div>
                  {allergenStatus === 'free_from' ? (
                    <input
                      value={allergenFreeFromDetail}
                      onChange={e => setAllergenFreeFromDetail(e.target.value)}
                      placeholder="Specify allergen-free requirements…"
                      className={`${inputCls} mt-2`}
                    />
                  ) : null}
                </div>

                <div>
                  <FieldLabel>3-MCPD / HVP free</FieldLabel>
                  <input
                    value={mcpdHvpFreeDetail}
                    onChange={e => setMcpdHvpFreeDetail(e.target.value)}
                    placeholder="Specify if applicable…"
                    className={inputCls}
                  />
                </div>

                <div>
                  <FieldLabel>Halal</FieldLabel>
                  <div className="mt-1">
                    <TickOption label="Halal certified" checked={halalCertified} onChange={setHalalCertified} />
                    <TickOption label="Halal compliant accepted" checked={halalCompliantAccepted} onChange={setHalalCompliantAccepted} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Country of R&amp;D site</FieldLabel>
                    <select value={countryRdSite} onChange={e => setCountryRdSite(e.target.value)} className={selectCls}>
                      <option value="">Select country…</option>
                      {SAMPLE_REQUEST_COUNTRY_OPTIONS.map(country => (
                        <option key={`rd-${country}`} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Country of manufacturing</FieldLabel>
                    <select value={countryManufacturing} onChange={e => setCountryManufacturing(e.target.value)} className={selectCls}>
                      <option value="">Select country…</option>
                      {SAMPLE_REQUEST_COUNTRY_OPTIONS.map(country => (
                        <option key={`mfg-${country}`} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Country in use</FieldLabel>
                    <select value={countryInUse} onChange={e => setCountryInUse(e.target.value)} className={selectCls}>
                      <option value="">Select country…</option>
                      {SAMPLE_REQUEST_COUNTRY_OPTIONS.map(country => (
                        <option key={`use-${country}`} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel>Regulatory requirement</FieldLabel>
                  <div className="mt-1">
                    <RadioOption name="regulatory" label="NA" checked={regulatoryRequirement === 'na'} onChange={() => setRegulatoryRequirement('na')} />
                    <RadioOption name="regulatory" label="Yes" checked={regulatoryRequirement === 'yes'} onChange={() => setRegulatoryRequirement('yes')} />
                  </div>
                  {regulatoryRequirement === 'yes' ? (
                    <textarea
                      value={regulatoryRequirementDetail}
                      onChange={e => setRegulatoryRequirementDetail(e.target.value)}
                      placeholder="Regulatory requirement details…"
                      rows={3}
                      className={`${inputCls} mt-2`}
                    />
                  ) : null}
                </div>

                <div>
                  <FieldLabel>Customer deadline</FieldLabel>
                  <input
                    type="date"
                    value={customerDeadline}
                    onChange={e => setCustomerDeadline(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="px-4 py-1.5 rounded-md text-xs font-bold border border-border hover:bg-muted"
          >
            {created ? 'Close' : 'Cancel'}
          </button>
          {!created ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="px-4 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit sample request'}
            </button>
          ) : null}
        </div>
      </div>
    </>,
    document.body,
  );
}
