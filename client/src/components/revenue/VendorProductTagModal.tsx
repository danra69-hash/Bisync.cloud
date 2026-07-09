import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, Tag, X } from 'lucide-react';

import { api } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

import {
  fromApiUom,
  getComponentUomChoices,
  inputCls,
  RECIPE_UNITS,
  resolveDetailConfigForRow,
  selectCls,
  STORAGE_OPTIONS,
  type ComponentRow,
} from '../../data/componentForm';

import {

  buildComponentRowWithVendorProductTag,

  componentRowTagsVendorProduct,

  componentRowToIngredientPayload,

  isVendorProductTagReady,

  type VendorProductTagApplyOptions,

} from '../../data/vendorProductTagging';

import { resolveComponentUomQty } from '../../data/vendorProductCatalog';

import { siCategories, siGroups } from '../../data/revenueManagement';

import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';

import { ingredientToRow, mergeSavedRow } from './smartIngredientShared';
import { VendorProductTableBody, type CompanyLocationOption } from './VendorProductTable';
import { ComponentUomSummary } from './ComponentUomSummary';

import type { VendorProductCatalogItem } from '../../data/vendorProductCatalog';



type Props = {

  product: VendorProductCatalogItem;

  selectedCompanyId: number | null;

  preselectedComponentId?: number | null;

  onClose: () => void;

  onTagged: () => void;

};



function Field({ label, children }: { label: string; children: React.ReactNode }) {

  return (

    <div className="flex flex-col gap-1">

      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>

      {children}

    </div>

  );

}



export function VendorProductTagModal({

  product,

  selectedCompanyId,

  preselectedComponentId,

  onClose,

  onTagged,

}: Props) {

  const { number } = useCountryFormatters();
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ComponentRow[]>([]);

  const [companyLocations, setCompanyLocations] = useState<CompanyLocationOption[]>([]);

  const [search, setSearch] = useState('');

  const [catFilter, setCatFilter] = useState('All');

  const [grpFilter, setGrpFilter] = useState('All');

  const [selectedRow, setSelectedRow] = useState<ComponentRow | null>(null);



  const [recipeUnit, setRecipeUnit] = useState('');

  const [inventoryUnit, setInventoryUnit] = useState('');

  const [componentUom, setComponentUom] = useState('');

  const [principalQty, setPrincipalQty] = useState('');

  const [yieldLossPct, setYieldLossPct] = useState('0');

  const [productLocationIds, setProductLocationIds] = useState<string[]>([]);

  const [storages, setStorages] = useState<string[]>([]);



  useEffect(() => {

    setLoading(true);

    api.ingredients()

      .then(data => setRows(data.map(ingredientToRow)))

      .catch(() => setRows([]))

      .finally(() => setLoading(false));

  }, [product.id]);



  useEffect(() => {

    if (!selectedCompanyId) {

      setCompanyLocations([]);

      return;

    }

    api.locationsConfig()

      .then(locations => {

        setCompanyLocations(

          locations

            .filter(l => l.companyId === selectedCompanyId)

            .map(l => ({ externalId: l.externalId, name: l.name }))

            .sort((a, b) => a.name.localeCompare(b.name)),

        );

      })

      .catch(() => setCompanyLocations([]));

  }, [selectedCompanyId]);



  useEffect(() => {

    const onKeyDown = (e: KeyboardEvent) => {

      if (e.key === 'Escape' && !saving) {

        if (selectedRow) setSelectedRow(null);

        else onClose();

      }

    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, [onClose, saving, selectedRow]);



  const available = useMemo(

    () => rows.filter(row => !componentRowTagsVendorProduct(row, product.id)),

    [rows, product.id],

  );



  const filtered = useMemo(() => {

    const q = search.trim().toLowerCase();

    return available.filter(row => {

      const matchCat = catFilter === 'All' || row.category === catFilter;

      const matchGrp = grpFilter === 'All' || row.group === grpFilter;

      const matchQ = !q

        || row.name.toLowerCase().includes(q)

        || row.componentId.toLowerCase().includes(q)

        || row.category.toLowerCase().includes(q)

        || row.group.toLowerCase().includes(q);

      return matchCat && matchGrp && matchQ;

    });

  }, [available, search, catFilter, grpFilter]);



  const componentDetail = selectedRow ? resolveDetailConfigForRow(selectedRow) : null;
  const altRecipeUnits = componentDetail?.altRecipeUnits ?? [];
  const altInventoryUnits = componentDetail?.altInventoryUnits ?? [];



  const componentUomChoices = useMemo(() => {

    if (!selectedRow) return [];

    const recipe = recipeUnit || fromApiUom(selectedRow.recipeUOM);

    return getComponentUomChoices(recipe, altRecipeUnits);

  }, [selectedRow, recipeUnit, altRecipeUnits]);



  const needsStorage = selectedRow

    ? selectedRow.storage.length === 0 || selectedRow.storage.every(s => !s.trim())

    : false;



  const tagReady = useMemo(() => isVendorProductTagReady(product, {

    recipeUnit: recipeUnit || (selectedRow ? fromApiUom(selectedRow.recipeUOM) : ''),

    altRecipeUnits,

    componentUom: componentUom || recipeUnit,

    principalQty,

    productLocationIds,

    companyLocationCount: companyLocations.length,

  }), [product, recipeUnit, altRecipeUnits, componentUom, principalQty, productLocationIds, companyLocations.length, selectedRow]);



  function openConfigure(row: ComponentRow) {

    const recipe = fromApiUom(row.recipeUOM);

    const inventory = fromApiUom(row.inventoryUOM);

    const detail = row.detailConfig;

    const choices = getComponentUomChoices(recipe, detail?.altRecipeUnits ?? []);

    const uom = choices[0] ?? recipe;

    const resolved = resolveComponentUomQty(product.delivery, recipe, detail?.altRecipeUnits ?? [], uom);

    setSelectedRow(row);

    setRecipeUnit(recipe);

    setInventoryUnit(inventory);

    setComponentUom(uom);

    setPrincipalQty(resolved.qty !== null ? String(resolved.qty) : '');

    setYieldLossPct('0');

    setProductLocationIds([]);

    setStorages(row.storage.length > 0 ? [...row.storage] : [STORAGE_OPTIONS[0]]);

    setError(null);

  }



  useEffect(() => {

    if (!preselectedComponentId || rows.length === 0 || selectedRow) return;

    const row = rows.find(r => r.id === preselectedComponentId);

    if (row && !componentRowTagsVendorProduct(row, product.id)) {

      openConfigure(row);

    }

  }, [preselectedComponentId, rows, product.id, selectedRow]);



  function handleComponentUomChange(uom: string) {

    if (!selectedRow) return;

    const recipe = recipeUnit || fromApiUom(selectedRow.recipeUOM);

    const resolved = resolveComponentUomQty(product.delivery, recipe, altRecipeUnits, uom);

    setComponentUom(uom);

    setPrincipalQty(resolved.qty !== null ? String(resolved.qty) : '');

  }



  async function handleConfirmTag() {

    if (!selectedRow?.id) return;



    if (!tagReady.ready) {

      setError(tagReady.reason ?? 'Complete all required fields before tagging.');

      return;

    }



    if (needsStorage && storages.every(s => !s.trim())) {

      setError('Assign at least one storage location before tagging.');

      return;

    }



    const options: VendorProductTagApplyOptions = {

      recipeUnit,

      inventoryUnit,

      componentUom: componentUom || recipeUnit,

      principalQty,

      yieldLossPct,

      productLocationIds,

      storages: needsStorage || storages.length > 0 ? storages : undefined,

    };



    setSaving(true);

    setError(null);

    try {

      const tagged = buildComponentRowWithVendorProductTag(selectedRow, product, options);

      const saved = await api.updateIngredient(selectedRow.id, componentRowToIngredientPayload(tagged));

      mergeSavedRow(saved, tagged);

      onTagged();

      onClose();

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to tag component.');

    } finally {

      setSaving(false);

    }

  }



  const principalQtyByProduct = { [product.id]: principalQty };

  const lossYieldByProduct = { [product.id]: yieldLossPct };

  const componentUomByProduct = { [product.id]: componentUom };

  const locationsByProduct = { [product.id]: productLocationIds };



  if (typeof document === 'undefined') return null;

  return createPortal(
    <>

      <div className={MODAL_OVERLAY_CLS} onClick={saving ? undefined : onClose} role="presentation" aria-hidden />

      <div

        className={`${MODAL_SHELL_CLS} w-full max-w-6xl bg-card border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col`}

        onClick={e => e.stopPropagation()}

      >

        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">

          <div className="min-w-0">

            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">

              {selectedRow ? 'Configure & Tag' : 'Select Smart Component'}

            </p>

            <h3 className="text-sm font-semibold text-foreground mt-0.5">{product.productName}</h3>

            <p className="text-xs text-muted-foreground mt-0.5 font-sans">{product.id} · ${number(product.deliveryPrice)}</p>

          </div>

          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">

            <X size={14} className="text-muted-foreground" />

          </button>

        </div>



        {!selectedRow ? (

          <>

            <div className="px-5 py-3 border-b border-border space-y-3 shrink-0">

              <p className="text-xs text-muted-foreground">

                Select a smart component, then fill in principal UOM qty, yield %, and location before confirming the tag.

              </p>

              <div className="flex flex-wrap items-end gap-3">

                <div className="flex flex-col gap-1 min-w-[100px]">

                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Category</label>

                  <select className={selectCls} value={catFilter} onChange={e => setCatFilter(e.target.value)}>

                    {siCategories.map(c => <option key={c}>{c}</option>)}

                  </select>

                </div>

                <div className="flex flex-col gap-1 min-w-[100px]">

                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Group</label>

                  <select className={selectCls} value={grpFilter} onChange={e => setGrpFilter(e.target.value)}>

                    {siGroups.map(g => <option key={g}>{g}</option>)}

                  </select>

                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-[140px]">

                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Search</label>

                  <div className="relative">

                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />

                    <input className={`${inputCls} pl-8`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Component name…" />

                  </div>

                </div>

              </div>

            </div>



            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">

              {loading ? (

                <p className="text-xs text-muted-foreground text-center py-10">Loading smart components…</p>

              ) : filtered.length === 0 ? (

                <p className="text-xs text-muted-foreground text-center py-10 border border-dashed border-border rounded-lg">

                  {available.length === 0

                    ? 'All components are already tagged with this product.'

                    : 'No smart components match your filters.'}

                </p>

              ) : (

                <ul className="space-y-1.5">

                  {filtered.map(row => (

                    <li key={row.id}>

                      <button

                        type="button"

                        onClick={() => openConfigure(row)}

                        className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/[0.04] transition-colors"

                      >

                        <p className="text-sm font-semibold text-foreground">{row.name}</p>

                        <p className="text-xs text-muted-foreground font-sans mt-0.5">

                          {row.componentId} · {row.category} · {row.group} · {fromApiUom(row.recipeUOM)} / {fromApiUom(row.inventoryUOM)}

                        </p>

                      </button>

                    </li>

                  ))}

                </ul>

              )}

            </div>

          </>

        ) : (

          <>

            <div className="px-5 py-3 border-b border-border shrink-0">

              <button

                type="button"

                onClick={() => setSelectedRow(null)}

                disabled={saving}

                className="inline-flex items-center gap-1 text-xs font-sans text-muted-foreground hover:text-foreground mb-2"

              >

                <ArrowLeft size={12} /> Back to component list

              </button>

              <p className="text-sm font-semibold text-foreground">{selectedRow.name}</p>

              <p className="text-xs text-muted-foreground font-sans">{selectedRow.componentId}</p>

            </div>



            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <Field label="Principal Component UOM">

                  <select className={selectCls} value={recipeUnit} onChange={e => {

                    const nextRecipe = e.target.value;

                    const choices = getComponentUomChoices(nextRecipe, altRecipeUnits);

                    const nextUom = choices.includes(componentUom) ? componentUom : (choices[0] ?? nextRecipe);

                    const resolved = resolveComponentUomQty(product.delivery, nextRecipe, altRecipeUnits, nextUom);

                    setRecipeUnit(nextRecipe);

                    setComponentUom(nextUom);

                    setPrincipalQty(resolved.qty !== null ? String(resolved.qty) : '');

                  }}>

                    {(() => {
                      const choices = getComponentUomChoices(recipeUnit, altRecipeUnits);
                      const otherUnits = RECIPE_UNITS.filter(u => !choices.includes(u));
                      if (choices.length > 0) {
                        return (
                          <>
                            <optgroup label="Component UOM">
                              {choices.map(u => <option key={`c-${u}`} value={u}>{u}</option>)}
                            </optgroup>
                            {otherUnits.length > 0 && (
                              <optgroup label="All units">
                                {otherUnits.map(u => <option key={`a-${u}`} value={u}>{u}</option>)}
                              </optgroup>
                            )}
                          </>
                        );
                      }
                      return RECIPE_UNITS.map(u => <option key={u} value={u}>{u}</option>);
                    })()}

                  </select>

                </Field>

                <Field label="Principal Inventory UOM">

                  <select className={selectCls} value={inventoryUnit} onChange={e => setInventoryUnit(e.target.value)}>

                    {RECIPE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}

                  </select>

                </Field>

              </div>

              <ComponentUomSummary
                recipeUnit={recipeUnit}
                inventoryUnit={inventoryUnit}
                altRecipeUnits={altRecipeUnits}
                altInventoryUnits={altInventoryUnits}
                convertFromInventoryQty={componentDetail?.convertFromInventoryQty}
                convertToRecipeQty={componentDetail?.convertToRecipeQty}
              />



              <div className="border border-border rounded-lg ">

                <VendorProductTableBody

                  products={[product]}

                  showTagColumn={false}

                  showLocationColumn

                  companyLocations={companyLocations}

                  handlers={{

                    defaultComponentUom: recipeUnit,

                    principalComponentUom: recipeUnit,

                    altRecipeUnits,

                    componentUomChoices,

                    componentUomByProduct,

                    principalQtyByProduct,

                    lossYieldByProduct,

                    locationsByProduct,

                    taggedProductIds: [],

                    onPrincipalQtyChange: (_id, qty) => setPrincipalQty(qty),

                    onLossYieldChange: (_id, loss) => setYieldLossPct(loss),

                    onComponentUomChange: (_id, uom) => handleComponentUomChange(uom),

                    onToggleTag: () => {},

                    onProductLocationsChange: (_id, ids) => setProductLocationIds(ids),

                  }}

                />

              </div>



              {needsStorage && (

                <div>

                  <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">

                    Storage Location (required)

                  </p>

                  <div className="space-y-1.5">

                    {storages.map((s, i) => (

                      <div key={i} className="flex items-center gap-2">

                        <select

                          className={`${selectCls} flex-1`}

                          value={s}

                          onChange={e => {

                            const next = [...storages];

                            next[i] = e.target.value;

                            setStorages(next);

                          }}

                        >

                          {STORAGE_OPTIONS.map(o => <option key={o}>{o}</option>)}

                        </select>

                        {storages.length > 1 && (

                          <button type="button" onClick={() => setStorages(storages.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-accent">

                            <X size={12} />

                          </button>

                        )}

                      </div>

                    ))}

                    <button

                      type="button"

                      onClick={() => setStorages([...storages, STORAGE_OPTIONS.find(o => !storages.includes(o)) ?? STORAGE_OPTIONS[0]])}

                      className="text-xs font-sans text-primary hover:underline"

                    >

                      + Add storage location

                    </button>

                  </div>

                </div>

              )}



              {error && <p className="text-xs text-red-500">{error}</p>}

              {!tagReady.ready && !error && (

                <p className="text-xs text-muted-foreground">{tagReady.reason}</p>

              )}

            </div>



            <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-end gap-3">

              <button

                type="button"

                onClick={() => setSelectedRow(null)}

                disabled={saving}

                className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors disabled:opacity-50"

              >

                Back

              </button>

              <button

                type="button"

                onClick={handleConfirmTag}

                disabled={saving || !tagReady.ready || (needsStorage && storages.every(s => !s.trim()))}

                className="inline-flex items-center gap-1.5 text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"

              >

                <Tag size={12} />

                {saving ? 'Tagging…' : 'Confirm Tag'}

              </button>

            </div>

          </>

        )}



        {!selectedRow && (

          <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">

            <button

              type="button"

              onClick={onClose}

              className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors"

            >

              Cancel

            </button>

          </div>

        )}

      </div>

    </>,
    document.body,
  );
}


