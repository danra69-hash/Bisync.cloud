import { useMemo, useRef, useState } from 'react';
import { FilePlus2, Plus, Trash2, Upload, X } from 'lucide-react';
import { api, type Vendor, type VendorCreatePayload } from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  applyVendorProductOverrides,
  parseVendorProductsFromOcrText,
  saveImportedVendorProducts,
  type VendorProductImportDraft,
} from '../../data/vendorProductCatalog';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_CREATE_VENDOR_CLS } from '../layout/sidePanelShared';

type Props = {
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
});

export function VendorCreatePanel({ nextExternalId, existingVendors, onClose, onCreated, onProductsImported }: Props) {
  const [form, setForm] = useState<VendorCreatePayload>(() => blank(nextExternalId));
  const [postcode, setPostcode] = useState('');
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

  function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());
    return values.map(v => v.replace(/^"|"$/g, '').trim());
  }

  function parseVendorTemplateCsv(text: string): VendorProductImportDraft[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];
    const rows = lines.slice(1).map(parseCsvLine);
    return rows
      .filter(r => r.length >= 5)
      .map(r => ({
        productName: r[0],
        group: r[1],
        specification: r[2],
        deliveryUnitText: r[3],
        deliveryPrice: parseFloat(String(r[4]).replace(/[^0-9.]/g, '')) || 0,
      }))
      .filter(r => r.productName && r.group && r.deliveryUnitText && r.deliveryPrice > 0);
  }

  function downloadTemplateCsv() {
    const header = ['Product Name', 'Group', 'Specification', 'Delivery Unit', 'Price'];
    const sample = [
      ['Baked Beans', 'Dry Goods', 'Baked beans in tomato sauce, 400g tins', 'Box/12tin/400gr', '42.00'],
      ['Olive Oil Extra Virgin', 'Dry Goods', 'Cold pressed olive oil, 5L tin', 'Tin/5ltr', '165.00'],
      ['Fresh Orange Juice', 'Beverages', 'Cold-pressed orange juice, 2L bottle', 'Bottle/2ltr', '18.00'],
    ];
    const csv = [header, ...sample]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vendor-product-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

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
      const drafts = parseVendorTemplateCsv(text);
      if (drafts.length === 0) {
        setError('Template file parsed no valid rows. Use: Product Name, Group, Specification, Delivery Unit, Price.');
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

  function importParsedProducts(): number {
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
    const added = saveImportedVendorProducts(vendorExternalId, vendorName, parsedRows);
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
      const created = await api.createVendor({
        ...form,
        externalId: form.externalId.trim().toUpperCase(),
        name: form.name.trim(),
        brn: form.brn.trim(),
        products: form.products.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address: [form.address.trim(), postcode.trim()].filter(Boolean).join(', '),
        contactPerson: form.contactPerson.trim(),
        contactPosition: form.contactPosition.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
      });
      if (parsedRows.length > 0) {
        importParsedProducts();
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
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Vendors</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">Create Vendor</h3>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Vendor ID</p>
              <input value={form.externalId} onChange={e => setField('externalId', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Type</p>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={selectCls}>
                <option value="offline">offline</option>
                <option value="online">online</option>
              </select>
            </div>
            <div className="col-span-1" />
            <div className="col-span-2">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Vendor Name</p>
              <input value={form.name} onChange={e => setField('name', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">BRN</p>
              <input value={form.brn} onChange={e => setField('brn', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Type of Product Supplied</p>
              <input value={form.products} onChange={e => setField('products', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Address</p>
              <input value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">City</p>
              <input
                list="vendor-city-options"
                value={form.city}
                onChange={e => setField('city', e.target.value)}
                className={inputCls}
              />
              <datalist id="vendor-city-options">
                {cityOptions.map(city => <option key={city} value={city} />)}
              </datalist>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Zip Code</p>
              <input value={postcode} onChange={e => setPostcode(e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">State</p>
              <input
                list="vendor-state-options"
                value={form.state}
                onChange={e => setField('state', e.target.value)}
                className={inputCls}
              />
              <datalist id="vendor-state-options">
                {stateOptions.map(state => <option key={state} value={state} />)}
              </datalist>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Contact Person</p>
              <input value={form.contactPerson} onChange={e => setField('contactPerson', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Contact Position</p>
              <input value={form.contactPosition} onChange={e => setField('contactPosition', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Email</p>
              <input value={form.email} onChange={e => setField('email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Mobile Number of Contact Person</p>
              <input value={form.mobile} onChange={e => setField('mobile', e.target.value)} className={inputCls} />
            </div>
            <div />
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Vendor Products</p>
              <span className="text-[9px] text-muted-foreground">Add Vendor Product</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={downloadTemplateCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8] hover:bg-[#2563eb]/15"
              >
                <FilePlus2 size={11} />
                Download Vendor Product Template CSV
              </button>
              <button
                type="button"
                onClick={() => scannedRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border border-[#16a34a]/40 bg-[#16a34a]/10 text-[#15803d] hover:bg-[#16a34a]/15"
              >
                <Upload size={11} />
                Upload Scanned Vendor Product Document
              </button>
              <button
                type="button"
                onClick={() => templateRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold border border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#6d28d9] hover:bg-[#7c3aed]/15"
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
              <div className="text-[10px] text-muted-foreground space-y-1">
                {scannedDocs.map((f, i) => <p key={`s-${i}`}>Scanned: {f.name}</p>)}
                {templates.map((f, i) => <p key={`t-${i}`}>Template: {f.name}</p>)}
              </div>
            )}
            <div className="pt-2 border-t border-border/70 space-y-2">
              <button
                type="button"
                onClick={runOcrOnFirstScanned}
                disabled={ocrRunning || scannedDocs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold bg-[#f59e0b] text-white hover:bg-[#d97706] disabled:opacity-50"
              >
                {ocrRunning ? 'Running OCR…' : 'Run OCR on Scanned Document'}
              </button>
              <p className="text-[9px] text-muted-foreground">
                Expected format: Product Name | Group | Specification | Delivery Unit | Price
              </p>
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      Uploaded Vendor Product List (edit + confirm)
                    </p>
                    <button
                      type="button"
                      onClick={addParsedRow}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-bold hover:border-primary/60"
                    >
                      <Plus size={11} />
                      Add Row
                    </button>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-auto max-h-72">
                      <table className="w-full text-[10px]">
                        <thead className="sticky top-0 bg-muted/50">
                          <tr className="border-b border-border">
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Product Name</th>
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Group</th>
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Specification</th>
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Delivery Unit</th>
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Price</th>
                            <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, i) => (
                            <tr key={`row-${i}`} className="border-b border-border last:border-b-0">
                              <td className="p-1.5 min-w-[180px]">
                                <input className={`${inputCls} text-[10px]`} value={row.productName} onChange={e => updateParsedRow(i, { productName: e.target.value })} />
                              </td>
                              <td className="p-1.5 min-w-[110px]">
                                <>
                                  <input
                                    list="vendor-group-options"
                                    className={`${inputCls} text-[10px]`}
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
                              <td className="p-1.5 min-w-[260px]">
                                <input className={`${inputCls} text-[10px]`} value={row.specification} onChange={e => updateParsedRow(i, { specification: e.target.value })} />
                              </td>
                              <td className="p-1.5 min-w-[150px]">
                                <input className={`${inputCls} text-[10px]`} value={row.deliveryUnitText} onChange={e => updateParsedRow(i, { deliveryUnitText: e.target.value })} />
                              </td>
                              <td className="p-1.5 min-w-[90px]">
                                <input className={`${inputCls} text-[10px]`} type="number" step={0.01} value={row.deliveryPrice} onChange={e => updateParsedRow(i, { deliveryPrice: parseFloat(e.target.value) || 0 })} />
                              </td>
                              <td className="p-1.5 min-w-[72px]">
                                <button
                                  type="button"
                                  onClick={() => removeParsedRow(i)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] hover:border-red-400 hover:text-red-500"
                                >
                                  <Trash2 size={11} />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={verifiedImport}
                      onChange={e => setVerifiedImport(e.target.checked)}
                    />
                    I verified scanned document vs extracted text and parsed rows.
                  </label>
                  <p className="text-[10px] text-muted-foreground">
                    Parsed products will be added automatically when you click Create Vendor.
                  </p>
                  {importMessage && <p className="text-[10px] text-[#5A7A2A]">{importMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-[10px] text-red-500 text-right">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="text-xs font-mono text-muted-foreground border border-border rounded-md px-4 py-2">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !form.externalId.trim() || !form.name.trim()}
              className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create Vendor'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
