import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, type Vendor } from '../../api';
import { siCategories, siGroups } from '../../data/revenueManagement';
import {
  type AltUnitEntry,
  type ComponentForm,
  type ComponentRow,
  RECIPE_UNITS,
  STORAGE_OPTIONS,
  getConversion,
  inputCls,
  selectCls,
  toApiUom,
  toForm,
} from '../../data/componentForm';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5 mb-3">
      {children}
    </p>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

type Props = {
  row: ComponentRow;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: Partial<ComponentRow>) => void;
};

export function ComponentEditPanel({ row, isNew = false, onClose, onSave }: Props) {
  const [form, setForm] = useState<ComponentForm>(() => toForm(row));
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    api.vendors(true).then(setVendors).catch(() => setVendors([]));
  }, []);

  function set<K extends keyof ComponentForm>(key: K, val: ComponentForm[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function updateAltUnit(
    field: 'altRecipeUnits' | 'altInventoryUnits',
    idx: number,
    part: Partial<AltUnitEntry>,
  ) {
    setForm(f => {
      const arr = [...f[field]];
      const updated = { ...arr[idx], ...part };
      if (part.unit) {
        const baseUnit = field === 'altRecipeUnits' ? f.recipeUnit : f.deliveryUnit;
        const conv = getConversion(baseUnit, part.unit);
        if (conv !== null) updated.qty = String(conv);
      }
      arr[idx] = updated;
      return { ...f, [field]: arr };
    });
  }

  function handleDeliveryUnitChange(val: string) {
    set('deliveryUnit', val);
    const conv = getConversion(val, form.recipeUnit);
    if (conv !== null) set('convertToRecipeQty', String(conv));
  }

  function handleRecipeUnitChange(val: string) {
    set('recipeUnit', val);
    const conv = getConversion(form.deliveryUnit, val);
    if (conv !== null) set('convertToRecipeQty', String(conv));
  }

  const delivPrice = parseFloat(form.deliveryUnitPrice) || 0;
  const convQty = parseFloat(form.convertToRecipeQty) || 0;
  const lossYield = parseFloat(form.lossYield) || 0;
  const recipePrice = convQty > 0 ? (delivPrice / convQty) * (1 + lossYield / 100) : 0;

  function save() {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      category: form.category,
      group: form.group,
      storage: form.storages,
      active: form.active,
      recipeUOM: toApiUom(form.recipeUnit),
      inventoryUOM: toApiUom(form.deliveryUnit),
      lastPriceInventory: delivPrice,
      lastPriceRecipe: recipePrice,
    });
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/10" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">Smart Ingredient</p>
            <h3 className="text-sm font-semibold text-foreground">
              {isNew ? 'New Ingredient' : row.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors mt-0.5">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <SectionTitle>Basic Info</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Component Name">
                <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wagyu Beef A5" />
              </FormField>
              <FormField label="Component ID">
                <input className={`${inputCls} bg-muted text-muted-foreground`} value={form.componentId} readOnly />
              </FormField>
              <FormField label="Category">
                <select className={selectCls} value={form.category} onChange={e => set('category', e.target.value)}>
                  {siCategories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                </select>
              </FormField>
              <FormField label="Group">
                <select className={selectCls} value={form.group} onChange={e => set('group', e.target.value)}>
                  {siGroups.filter(g => g !== 'All').map(g => <option key={g}>{g}</option>)}
                </select>
              </FormField>
            </div>

            <div className="mt-3">
              <FormField label="Storage Location">
                <div className="space-y-1.5">
                  {form.storages.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={s}
                        onChange={e => {
                          const updated = [...form.storages];
                          updated[i] = e.target.value;
                          set('storages', updated);
                        }}
                        className={`${selectCls} flex-1`}
                      >
                        {STORAGE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                      {form.storages.length > 1 && (
                        <button
                          onClick={() => set('storages', form.storages.filter((_, j) => j !== i))}
                          className="p-1 text-muted-foreground hover:text-accent transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => set('storages', [...form.storages, STORAGE_OPTIONS.find(o => !form.storages.includes(o)) ?? STORAGE_OPTIONS[0]])}
                    className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                  >
                    + Add storage location
                  </button>
                </div>
              </FormField>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => set('active', !form.active)}
                className={`w-9 h-5 rounded-full relative transition-colors ${form.active ? 'bg-primary' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.active ? 'left-4' : 'left-0.5'}`} />
              </button>
              <span className="text-xs text-foreground">{form.active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <div>
            <SectionTitle>Unit Measure</SectionTitle>

            <div className="mb-4">
              <FormField label="Recipe Unit">
                <select className={`${selectCls} w-40`} value={form.recipeUnit} onChange={e => handleRecipeUnitChange(e.target.value)}>
                  {RECIPE_UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </FormField>
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                Alternate Recipe Unit{form.altRecipeUnits.length > 0 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {form.altRecipeUnits.map((au, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-16 text-right shrink-0">1 {form.recipeUnit} =</span>
                    <input type="number" placeholder="Qty" value={au.qty}
                      onChange={e => updateAltUnit('altRecipeUnits', i, { qty: e.target.value })}
                      className={`${inputCls} w-20`} />
                    <select className={`${selectCls} flex-1`} value={au.unit}
                      onChange={e => updateAltUnit('altRecipeUnits', i, { unit: e.target.value })}>
                      {RECIPE_UNITS.filter(u => u !== form.recipeUnit).map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button onClick={() => set('altRecipeUnits', form.altRecipeUnits.filter((_, j) => j !== i))}
                      className="p-1 text-muted-foreground hover:text-accent"><X size={12} /></button>
                  </div>
                ))}
                {form.altRecipeUnits.length < 2 && (
                  <button onClick={() => set('altRecipeUnits', [...form.altRecipeUnits, { qty: '', unit: RECIPE_UNITS[1] }])}
                    className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1">
                    + Add alternate recipe unit
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
                Alternate Inventory Unit{form.altInventoryUnits.length > 0 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {form.altInventoryUnits.map((au, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-16 text-right shrink-0">1 {form.recipeUnit} =</span>
                    <input type="number" placeholder="Qty" value={au.qty}
                      onChange={e => updateAltUnit('altInventoryUnits', i, { qty: e.target.value })}
                      className={`${inputCls} w-20`} />
                    <select className={`${selectCls} flex-1`} value={au.unit}
                      onChange={e => updateAltUnit('altInventoryUnits', i, { unit: e.target.value })}>
                      {RECIPE_UNITS.filter(u => u !== form.recipeUnit).map(u => <option key={u}>{u}</option>)}
                    </select>
                    <button onClick={() => set('altInventoryUnits', form.altInventoryUnits.filter((_, j) => j !== i))}
                      className="p-1 text-muted-foreground hover:text-accent"><X size={12} /></button>
                  </div>
                ))}
                {form.altInventoryUnits.length < 2 && (
                  <button onClick={() => set('altInventoryUnits', [...form.altInventoryUnits, { qty: '', unit: RECIPE_UNITS[1] }])}
                    className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1">
                    + Add alternate inventory unit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <SectionTitle>Vendor & Pricing</SectionTitle>

            <div className="space-y-3">
              <FormField label="Vendor">
                <select className={selectCls} value={form.vendor} onChange={e => set('vendor', e.target.value)}>
                  <option value="">— Select vendor —</option>
                  {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </FormField>

              <FormField label="Vendor Product">
                <select className={selectCls} value={form.vendorProduct} onChange={e => set('vendorProduct', e.target.value)} disabled={!form.vendor}>
                  <option value="">— Select product —</option>
                  {form.vendor && <option>{form.name || row.name || 'Product'}</option>}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Delivery Unit">
                  <select className={selectCls} value={form.deliveryUnit} onChange={e => handleDeliveryUnitChange(e.target.value)}>
                    {RECIPE_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </FormField>
                <FormField label="Delivery Unit Price ($)">
                  <input type="number" className={inputCls} value={form.deliveryUnitPrice}
                    onChange={e => set('deliveryUnitPrice', e.target.value)} placeholder="0.00" />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label={`Convert to Recipe Qty (${form.recipeUnit})`}>
                  <div className="relative">
                    <input type="number" className={inputCls} value={form.convertToRecipeQty}
                      onChange={e => set('convertToRecipeQty', e.target.value)} placeholder="e.g. 1000" />
                    {getConversion(form.deliveryUnit, form.recipeUnit) !== null && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-mono text-primary">auto</span>
                    )}
                  </div>
                </FormField>
                <FormField label="Loss / Yield %">
                  <input type="number" className={inputCls} value={form.lossYield}
                    onChange={e => set('lossYield', e.target.value)} placeholder="0" min="0" max="100" />
                </FormField>
              </div>

              <div className="bg-primary/8 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Recipe Price (per {form.recipeUnit})</p>
                  <p className="text-lg font-semibold text-foreground font-mono mt-0.5">
                    {recipePrice > 0 ? `$${recipePrice.toFixed(recipePrice < 0.1 ? 5 : 4)}` : '—'}
                  </p>
                </div>
                {recipePrice > 0 && (
                  <div className="text-[9px] font-mono text-muted-foreground text-right space-y-0.5">
                    <p>${delivPrice.toFixed(2)} ÷ {convQty} {form.recipeUnit}</p>
                    {lossYield > 0 && <p>+ {lossYield}% loss yield</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose}
            className="text-xs font-mono text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={!form.name.trim()}
            className="text-xs font-mono bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isNew ? 'Add Ingredient' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
