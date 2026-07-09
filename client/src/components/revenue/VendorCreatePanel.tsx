import { useMemo, useRef, useState } from 'react';
import { FilePlus2, Plus, Trash2, Upload, X } from 'lucide-react';
import { api, type Vendor, type VendorCreatePayload } from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import { VENDOR_PRODUCT_POLICY_OPTIONS } from '../../data/vendorPolicyRules';
import {
  applyVendorProductOverrides,
  downloadVendorProductTemplateCsv,
  parseVendorProductTemplateCsv,
  parseVendorProductsFromOcrText,
  saveImportedVendorProducts,
  type VendorProductImportDraft,
} from '../../data/vendorProductCatalog';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { CountryLocalityFields } from '../shared/CountryLocalityFields';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';
import type { LocalityParts } from '../../utils/countryFormat';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
  countryCode: string;
  nextExternalId: string;
  existingVendors: Vendor[];
  onClose: () => void;
  onCreated: (vendor: Vendor) => void;
  onProductsImported?: () => void;
};

const blank = (nextExternalId: string): VendorCreatePayload => ({
  externalId: nextExternalId,
  name: '',
  type: 'offline',
  brn: '',
  products: '',
  city: '',
  state: '',
  address: '',
  contactPerson: '',
  contactPosition: '',
  mobile: '',
  email: '',
  productPolicyTag: 'non-halal',
});

export function VendorCreatePanel({ countryCode, nextExternalId, existingVendors, onClose, onCreated, onProductsImported }: Props) {
  const [form, setForm] = useState<VendorCreatePayload>(() => blank(nextExternalId));
  const [locality, setLocality] = useState<LocalityParts>({ city: '', state: '', postcode: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedDocs, setScannedDocs] = useState<File[]>([]);
  const [templates, setTemplates] = useState<File[]>([]);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [parsedRows, setParsedRows] = useState<VendorProductImportDraft[]>([]);
  const [verifiedImport, setVerifiedImport] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const scannedRef = useRef<HTMLInputElement | null>(null);
  const templateRef = useRef<HTMLInputElement | null>(null);
  const existingGroupOptions = useMemo(
    () => [...new Set(applyVendorProductOverrides().map(p => p.group))]
      .sort((a, b) => a.localeCompare(b)),
    [],
  );
  const cityOptions = useMemo(
    () => [...new Set(existingVendors.map(v => v.city.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [existingVendors],
  );
  const stateOptions = useMemo(
    () => [...new Set(existingVendors.map(v => v.state.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [existingVendors],
  );

  const parsedRowsScrollRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedParsedRows,
    hasMore: parsedRowsHasMore,
    sentinelRef: parsedRowsSentinelRef,
    totalCount: parsedRowsTotalCount,
    visibleCount: parsedRowsVisibleCount,
  } = useInfiniteScrollSlice(parsedRows, { scrollRootRef: parsedRowsScrollRef });

  function setField<K extends keyof VendorCreatePayload>(key: K, value: VendorCreatePayload[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function appendFiles(target: 'scanned' | 'template', files: FileList | null) {
    if (!files || files.length === 0) return;
    const incoming = [...files];
    if (target === 'scanned') {
      setScannedDocs(prev => [...prev, ...incoming]);
      return;
    }

    setTemplates(prev => [...prev, ...incoming]);
    setError(null);
    setImportMessage(null);
    try {
      const first = incoming[0];
      const text = await first.text();
      const drafts = parseVendorProductTemplateCsv(text);
      if (drafts.length === 0) {
        setError('Template file parsed no valid rows. Use: Vendor Product ID, Product Name, Group, Specification, Delivery Unit, Price.');
        return;
      }
      setParsedRows(drafts);
      setVerifiedImport(false);
      setImportMessage(`Loaded ${drafts.length} rows from template. Please verify before adding.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read vendor product template.');
    }
  }

  async function runOcrOnFirstScanned() {
    if (scannedDocs.length === 0) {
      setError('Upload at least one scanned vendor product document first.');
      return;
    }
    setOcrRunning(true);
    setError(null);
    setImportMessage(null);
    try {
      const [{ createWorker }, file] = await Promise.all([
        import('tesseract.js'),
        Promise.resolve(scannedDocs[0]),
      ]);
      const worker = await createWorker('eng');
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text ?? '';
      setParsedRows(parseVendorProductsFromOcrText(text));
      setVerifiedImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed.');
    } finally {
      setOcrRunning(false);
    }
  }

  function updateParsedRow(index: number, patch: Partial<VendorProductImportDraft>) {
    setParsedRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function normalizeGroupName(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const match = existingGroupOptions.find(g => g.toLowerCase() === trimmed.toLowerCase());
    return match ?? trimmed;
  }

  function addParsedRow() {
    setParsedRows(prev => [
      ...prev,
      {
        vendorProductId: '',
        productName: '',
        group: 'Dry Goods',
        specification: '',
        deliveryUnitText: '',
        deliveryPrice: 0,
      },
    ]);
    setVerifiedImport(false);
  }

  function removeParsedRow(index: number) {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
    setVerifiedImport(false);
  }

  async function importParsedProducts(): Promise<number> {
    setImportMessage(null);
    const vendorExternalId = form.externalId.trim().toUpperCase();
    const vendorName = form.name.trim();
    if (!vendorExternalId || !vendorName) {
      setError('Enter Vendor ID and Vendor Name before importing products.');
      return 0;
    }
    if (!verifiedImport) {
      setError('Verify scanned document against extracted text before adding to DB.');
      return 0;
    }
    const added = await saveImportedVendorProducts(vendorExternalId, vendorName, parsedRows);
    if (added.length === 0) {
      setError('No valid vendor products found to import.');
      return 0;
    }
    setImportMessage(`Imported ${added.length} vendor products.`);
    onProductsImported?.();
    return added.length;
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      if (parsedRows.length > 0 && !verifiedImport) {
        setError('Please verify parsed vendor products before creating vendor.');
        return;
      }
      if (!form.name.trim()) {
        setError('Vendor name is required.');
        return;
      }
      if (!form.productPolicyTag) {
        setError('Product policy is required.');
        return;
      }
      const created = await api.createVendor({
        ...form,
        externalId: form.externalId.trim().toUpperCase(),
        name: form.name.trim(),
        brn: form.brn.trim(),
        products: form.products.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address: [form.address.trim(), locality.postcode.trim()].filter(Boolean).join(', '),
        contactPerson: form.contactPerson.trim(),
        contactPosition: form.contactPosition.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
      });
      if (parsedRows.length > 0) {
        await importParsedProducts();
      }
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={SIDE_PANEL_OVERLAY_CLS} onClick={() => !saving && onClose()} role="presentation" aria-hidden />
      <div className={SIDE_PANEL_SHELL_CREATE_VENDOR_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Vendors</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Create Vendor</h3>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Vendor ID</p>
              <input value={form.externalId} onChange={e => setField('externalId', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Type</p>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={selectCls}>
                <option value="offline">offline</option>
                <option value="online">online</option>
              </select>
            </div>
            <div className="col-span-1" />
            <div className="col-span-2">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Vendor Name</p>
              <input value={form.name} onChange={e => setField('name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">BRN</p>
              <input value={form.brn} onChange={e => setField('brn', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Type of Product Supplied</p>
              <input value={form.products} onChange={e => setField('products', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Product Policy *</p>
              <select
                value={form.productPolicyTag}
                onChange={e => setField('productPolicyTag', e.target.value as VendorCreatePayload['productPolicyTag'])}
                className={selectCls}
              >
                {VENDOR_PRODUCT_POLICY_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {VENDOR_PRODUCT_POLICY_OPTIONS.find(option => option.id === form.productPolicyTag)?.description}
              </p>
            </div>
            <div className="col-span-3">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Address</p>
              <input value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3 grid grid-cols-3 gap-3">
              <CountryLocalityFields
                countryCode={countryCode}
                value={{
                  city: form.city,
                  state: form.state,
                  postcode: locality.postcode,
                }}
                onChange={next => {
                  setField('city', next.city);
                  setField('state', next.state);
                  setLocality(prev => ({ ...prev, postcode: next.postcode }));
                }}
                extraCityOptions={cityOptions}
                extraStateOptions={stateOptions}
                labelClassName="text-xs font-sans text-muted-foreground uppercase tracking-wider"
              />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Contact Person</p>
              <input value={form.contactPerson} onChange={e => setField('contactPerson', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Contact Position</p>
              <input value={form.contactPosition} onChange={e => setField('contactPosition', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <input value={form.email} onChange={e => setField('email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <CountryPhoneInput
                countryCode={countryCode}
                value={form.mobile}
                onChange={value => setField('mobile', value)}
                label="Mobile Number of Contact Person"
                variant="mobile"
                showError={false}
              />
            </div>
            <div />
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Vendor Products</p>
              <span className="text-xs text-muted-foreground">Add Vendor Product</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => downloadVendorProductTemplateCsv()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8] hover:bg-[#2563eb]/15"
              >
                <FilePlus2 size={11} />
                Download Vendor Product Template CSV
              </button>
              <button
                type="button"
                onClick={() => scannedRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#15803d] hover:bg-[#16a34a]/15"
              >
                <Upload size={11} />
                Upload Scanned Vendor Product Document
              </button>
              <button
                type="button"
                onClick={() => templateRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#6d28d9] hover:bg-[#7c3aed]/15"
              >
                <FilePlus2 size={11} />
                Upload Vendor Product Template
              </button>
            </div>
            <input
              ref={scannedRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => appendFiles('scanned', e.target.files)}
            />
            <input
              ref={templateRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="hidden"
              onChange={e => appendFiles('template', e.target.files)}
            />
            {(scannedDocs.length > 0 || templates.length > 0) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {scannedDocs.map((f, i) => <p key={`s-${i}`}>Scanned: {f.name}</p>)}
                {templates.map((f, i) => <p key={`t-${i}`}>Template: {f.name}</p>)}
              </div>
            )}
            <div className="pt-2 border-t border-border/70 space-y-2">
              <button
                type="button"
                onClick={runOcrOnFirstScanned}
                disabled={ocrRunning || scannedDocs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#f59e0b] text-white hover:bg-[#d97706] disabled:opacity-50"
              >
                {ocrRunning ? 'Running OCR…' : 'Run OCR on Scanned Document'}
              </button>
              <p className="text-xs text-muted-foreground">
                Expected format: Vendor Product ID | Product Name | Group | Specification | Delivery Unit | Price
              </p>
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
                      Uploaded Vendor Product List (edit + confirm)
                    </p>
                    <button
                      type="button"
                      onClick={addParsedRow}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs font-bold hover:border-primary/60"
                    >
                      <Plus size={11} />
                      Add Row
                    </button>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <TableScrollContainer ref={parsedRowsScrollRef} className="overflow-auto max-h-72">
                      <table className="w-full table-fixed text-xs">
                        <thead className="sticky top-0 bg-muted/50">
                          <tr className="border-b border-border">
                            <TableHeaderCell compact>Vendor Product ID</TableHeaderCell>
                            <TableHeaderCell compact>Product Name</TableHeaderCell>
                            <TableHeaderCell compact>Group</TableHeaderCell>
                            <TableHeaderCell compact>Specification</TableHeaderCell>
                            <TableHeaderCell compact>Delivery Unit</TableHeaderCell>
                            <TableHeaderCell compact>Price</TableHeaderCell>
                            <TableHeaderCell compact>Action</TableHeaderCell>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedParsedRows.map((row, i) => (
                            <tr key={`row-${i}`} className="border-b border-border last:border-b-0">
                              <td className="p-1.5 ">
                                <input className={`${inputCls} text-xs`} value={row.vendorProductId ?? ''} onChange={e => updateParsedRow(i, { vendorProductId: e.target.value })} placeholder="VP-..." />
                              </td>
                              <td className="p-1.5 ">
                                <input className={`${inputCls} text-xs`} value={row.productName} onChange={e => updateParsedRow(i, { productName: e.target.value })} />
                              </td>
                              <td className="p-1.5 ">
                                <>
                                  <input
                                    list="vendor-group-options"
                                    className={`${inputCls} text-xs`}
                                    value={row.group}
                                    onChange={e => updateParsedRow(i, { group: e.target.value })}
                                    onBlur={e => updateParsedRow(i, { group: normalizeGroupName(e.target.value) })}
                                  />
                                  <datalist id="vendor-group-options">
                                    {existingGroupOptions.map(group => (
                                      <option key={group} value={group} />
                                    ))}
                                  </datalist>
                                </>
                              </td>
                              <td className="p-1.5 ">
                                <input className={`${inputCls} text-xs`} value={row.specification} onChange={e => updateParsedRow(i, { specification: e.target.value })} />
                              </td>
                              <td className="p-1.5 ">
                                <input className={`${inputCls} text-xs`} value={row.deliveryUnitText} onChange={e => updateParsedRow(i, { deliveryUnitText: e.target.value })} />
                              </td>
                              <td className="p-1.5 ">
                                <input className={`${inputCls} text-xs`} type="number" step={0.01} value={row.deliveryPrice} onChange={e => updateParsedRow(i, { deliveryPrice: parseFloat(e.target.value) || 0 })} />
                              </td>
                              <td className="p-1.5 ">
                                <button
                                  type="button"
                                  onClick={() => removeParsedRow(i)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs hover:border-red-400 hover:text-red-500"
                                >
                                  <Trash2 size={11} />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          <InfiniteScrollTableSentinel colSpan={7} hasMore={parsedRowsHasMore} sentinelRef={parsedRowsSentinelRef} totalCount={parsedRowsTotalCount} visibleCount={parsedRowsVisibleCount} />
                        </tbody>
                      </table>
                    </TableScrollContainer>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={verifiedImport}
                      onChange={e => setVerifiedImport(e.target.checked)}
                    />
                    I verified scanned document vs extracted text and parsed rows.
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Parsed products will be added automatically when you click Create Vendor.
                  </p>
                  {importMessage && <p className="text-xs text-[#5A7A2A]">{importMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-xs text-red-500 text-right">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !form.externalId.trim() || !form.name.trim()}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Vendor'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
