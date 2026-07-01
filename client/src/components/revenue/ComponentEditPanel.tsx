import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, type Vendor } from '../../api';
import { siCategories, siGroups } from '../../data/revenueManagement';
import {
  type AltUnitEntry,
  type ComponentForm,
  type ComponentRow,
  RECIPE_UNITS,
  STORAGE_OPTIONS,
  generateComponentId,
  getConversion,
  getComponentUomChoices,
  inputCls,
  isComponentNameTaken,
  MAX_ALTERNATE_UOMS,
  selectCls,
  swapPrincipalWithAlternateUnit,
  detailConfigFromForm,
  toApiUom,
  toForm,
} from '../../data/componentForm';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_DETAIL_CLS, DETAIL_PANEL_OVERLAY_ELEVATED_CLS, DETAIL_PANEL_SHELL_ELEVATED_CLS } from '../layout/sidePanelShared';
import { VendorProductTable, type CompanyLocationOption } from './VendorProductTable';
import { isVendorProductTagReady } from '../../data/vendorProductTagging';
import { VENDOR_PRODUCT_CATALOG, calcComponentPrincipalUomPrice, calcNettUomPrice, calcNettUomQty, resolveComponentUomQty, type VendorProductCatalogItem } from '../../data/vendorProductCatalog';

function computeTaggedVendorProductPricing(
  product: VendorProductCatalogItem,
  form: ComponentForm,
) {
  const productUom = form.vendorProductComponentUom[product.id] ?? form.recipeUnit;
  const resolved = resolveComponentUomQty(
    product.delivery,
    form.recipeUnit,
    form.altRecipeUnits,
    productUom,
  );
  const storedQty = form.vendorProductPrincipalQty[product.id];
  const principalQty = parseFloat(
    storedQty !== undefined && storedQty !== ''
      ? storedQty
      : resolved.qty !== null
        ? String(resolved.qty)
        : '',
  ) || 0;
  const lossYield = parseFloat(form.vendorProductLossYield[product.id] ?? '0') || 0;
  const principalPrice = calcComponentPrincipalUomPrice(product.deliveryPrice, principalQty);
  const nettQty = calcNettUomQty(principalQty, lossYield);
  const nettPrice = calcNettUomPrice(product.deliveryPrice, nettQty);

  return {
    productUom,
    principalQty,
    lossYield,
    principalPrice,
    nettQty,
    nettPrice,
    isComplete: principalQty > 0,
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-sans font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5 mb-3">
      {children}
    </p>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const COMPACT_INPUT_CLS =
  'bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shrink-0';
const COMPACT_FROM_QTY_CLS = `${COMPACT_INPUT_CLS} w-10`;
const COMPACT_TO_QTY_CLS = `${COMPACT_INPUT_CLS} w-14`;
const COMPACT_SELECT_CLS =
  'bg-background border border-border rounded px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-[3.25rem] shrink-0';

type UomConversionLineProps = {
  unit: string;
  unitOptions?: string[];
  onUnitChange?: (unit: string) => void;
  fromQty: string;
  onFromQtyChange: (fromQty: string) => void;
  qty: string;
  onQtyChange: (qty: string) => void;
  targetUom: string;
  autoFilled?: boolean;
  onRemove?: () => void;
};

function UomConversionLine({
  unit,
  unitOptions,
  onUnitChange,
  fromQty,
  onFromQtyChange,
  qty,
  onQtyChange,
  targetUom,
  autoFilled = false,
  onRemove,
}: UomConversionLineProps) {
  return (
    <div className="flex flex-nowrap items-center gap-1 min-w-0">
      {onUnitChange && unitOptions ? (
        <select className={COMPACT_SELECT_CLS} value={unit} onChange={e => onUnitChange(e.target.value)}>
          {unitOptions.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      ) : (
        <div className={`${COMPACT_SELECT_CLS} flex items-center bg-muted/20`}>{unit}</div>
      )}
      <input
        type="number"
        placeholder="1"
        value={fromQty}
        onChange={e => onFromQtyChange(e.target.value)}
        className={COMPACT_FROM_QTY_CLS}
        min="0"
      />
      <span className="text-xs text-muted-foreground font-sans shrink-0">=</span>
      <div className="relative shrink-0">
        <input
          type="number"
          placeholder="Qty"
          value={qty}
          onChange={e => onQtyChange(e.target.value)}
          className={`${COMPACT_TO_QTY_CLS}${autoFilled ? ' pr-6' : ''}`}
        />
        {autoFilled && (
          <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[6px] font-sans text-primary pointer-events-none">auto</span>
        )}
      </div>
      <span className="text-xs font-sans text-foreground shrink-0">{targetUom}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="p-0.5 text-muted-foreground hover:text-accent shrink-0">
          <X size={11} />
        </button>
      )}
    </div>
  );
}

type AltUnitRowProps = {
  entry: AltUnitEntry;
  principalUom: string;
  unitOptions: string[];
  onUnitChange: (unit: string) => void;
  onFromQtyChange: (fromQty: string) => void;
  onQtyChange: (qty: string) => void;
  onRemove: () => void;
  autoFilled: boolean;
};

function AltUnitRow({ entry, principalUom, unitOptions, onUnitChange, onFromQtyChange, onQtyChange, onRemove, autoFilled }: AltUnitRowProps) {
  return (
    <UomConversionLine
      unit={entry.unit}
      unitOptions={unitOptions}
      onUnitChange={onUnitChange}
      fromQty={entry.fromQty ?? ''}
      onFromQtyChange={onFromQtyChange}
      qty={entry.qty}
      onQtyChange={onQtyChange}
      targetUom={principalUom}
      autoFilled={autoFilled}
      onRemove={onRemove}
    />
  );
}

function refreshAltUnitQtys(altUnits: AltUnitEntry[], principalUom: string): AltUnitEntry[] {
  return altUnits.map(au => {
    const fromQty = au.fromQty || '1';
    const conv = getConversion(au.unit, principalUom);
    const from = parseFloat(fromQty) || 1;
    return conv !== null ? { ...au, fromQty, qty: String(conv * from) } : { ...au, fromQty };
  });
}

function isAltQtyAutoFilled(altUnit: string, principalUom: string, qty: string, fromQty: string) {
  const conv = getConversion(altUnit, principalUom);
  if (conv === null) return false;
  const from = parseFloat(fromQty || '1') || 1;
  const expected = conv * from;
  return qty === String(expected) || qty === String(Number(expected.toFixed(10)));
}

type PrincipalAlternateUomBlockProps = {
  principalLabel: string;
  alternateLabel: string;
  addAlternateLabel: string;
  principalUnit: string;
  referencePrincipalUom?: string;
  referenceFromQty?: string;
  referenceQty?: string;
  referenceQtyAutoFilled?: boolean;
  onReferenceFromQtyChange?: (fromQty: string) => void;
  onReferenceQtyChange?: (qty: string) => void;
  altUnits: AltUnitEntry[];
  onPrincipalChange: (unit: string) => void;
  onAltUnitsChange: (units: AltUnitEntry[]) => void;
  showComponentUomChoices?: boolean;
  className?: string;
};

function PrincipalAlternateUomBlock({
  principalLabel,
  alternateLabel,
  addAlternateLabel,
  principalUnit,
  referencePrincipalUom,
  referenceFromQty,
  referenceQty,
  referenceQtyAutoFilled = false,
  onReferenceFromQtyChange,
  onReferenceQtyChange,
  altUnits,
  onPrincipalChange,
  onAltUnitsChange,
  showComponentUomChoices = false,
  className = 'mb-6',
}: PrincipalAlternateUomBlockProps) {
  const unitOptions = RECIPE_UNITS.filter(u => u !== principalUnit);
  const componentUomChoices = showComponentUomChoices
    ? getComponentUomChoices(principalUnit, altUnits)
    : [];
  const otherPrincipalUnits = showComponentUomChoices
    ? RECIPE_UNITS.filter(u => !componentUomChoices.includes(u))
    : RECIPE_UNITS;

  function updateAltUnit(idx: number, part: Partial<AltUnitEntry>) {
    const arr = [...altUnits];
    const updated = { ...arr[idx], fromQty: arr[idx].fromQty || '1', ...part };
    if (part.unit) {
      const conv = getConversion(part.unit, principalUnit);
      if (conv !== null) {
        const from = parseFloat(updated.fromQty || '1') || 1;
        updated.qty = String(conv * from);
      }
    }
    if (part.fromQty !== undefined && !part.qty && !part.unit) {
      const conv = getConversion(updated.unit, principalUnit);
      if (conv !== null) {
        const from = parseFloat(part.fromQty || '1') || 1;
        updated.qty = String(conv * from);
      }
    }
    arr[idx] = updated;
    onAltUnitsChange(arr);
  }

  function addAltUnit() {
    if (altUnits.length >= MAX_ALTERNATE_UOMS) return;
    onAltUnitsChange([
      ...altUnits,
      { fromQty: '1', qty: '', unit: unitOptions[0] ?? RECIPE_UNITS[1] },
    ]);
  }

  function removeAltUnit(idx: number) {
    onAltUnitsChange(altUnits.filter((_, j) => j !== idx));
  }

  return (
    <div className={className}>
      <div className="mb-5">
        <FormField label={principalLabel}>
          <select className={`${selectCls} w-40`} value={principalUnit} onChange={e => onPrincipalChange(e.target.value)}>
            {showComponentUomChoices && componentUomChoices.length > 0 && (
              <optgroup label="Component UOM">
                {componentUomChoices.map(u => (
                  <option key={`choice-${u}`} value={u}>{u}</option>
                ))}
              </optgroup>
            )}
            {showComponentUomChoices && otherPrincipalUnits.length > 0 && (
              <optgroup label="All units">
                {otherPrincipalUnits.map(u => (
                  <option key={`all-${u}`} value={u}>{u}</option>
                ))}
              </optgroup>
            )}
            {!showComponentUomChoices && RECIPE_UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </FormField>
      </div>

      {referencePrincipalUom && onReferenceFromQtyChange && onReferenceQtyChange && (
        principalUnit === referencePrincipalUom ? (
          <div className="mb-4 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Inventory UOM matches principal component UOM — no conversion required.
            </p>
          </div>
        ) : (
        <div className="mb-4">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">
            Principal Conversion Reference
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Define how inventory UOM converts to principal component UOM (auto-filled when known).
          </p>
          <UomConversionLine
            unit={principalUnit}
            fromQty={referenceFromQty ?? ''}
            onFromQtyChange={onReferenceFromQtyChange}
            qty={referenceQty ?? ''}
            onQtyChange={onReferenceQtyChange}
            targetUom={referencePrincipalUom}
            autoFilled={referenceQtyAutoFilled}
          />
        </div>
        )
      )}

      <div>
        <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">
          {alternateLabel}{altUnits.length > 0 ? 's' : ''}
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Select another UOM and enter the conversion (auto-filled when known). Up to {MAX_ALTERNATE_UOMS} allowed.
          {showComponentUomChoices && ' Alternates appear in the Component UOM dropdown above and in vendor pricing.'}
        </p>
        <div className="space-y-2">
          {altUnits.map((au, i) => (
            <AltUnitRow
              key={i}
              entry={au}
              principalUom={principalUnit}
              unitOptions={unitOptions}
              onUnitChange={unit => updateAltUnit(i, { unit })}
              onFromQtyChange={fromQty => updateAltUnit(i, { fromQty })}
              onQtyChange={qty => updateAltUnit(i, { qty })}
              onRemove={() => removeAltUnit(i)}
              autoFilled={isAltQtyAutoFilled(au.unit, principalUnit, au.qty, au.fromQty || '1')}
            />
          ))}
          {altUnits.length < MAX_ALTERNATE_UOMS && (
            <button
              type="button"
              onClick={addAltUnit}
              className="text-xs font-sans text-primary hover:underline flex items-center gap-1"
            >
              {addAlternateLabel}
            </button>
          )}
          {altUnits.length >= MAX_ALTERNATE_UOMS && (
            <p className="text-xs text-muted-foreground font-sans">
              Maximum {MAX_ALTERNATE_UOMS} alternate UOMs reached.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type Props = {
  row: ComponentRow;
  isNew?: boolean;
  existingComponents: ComponentRow[];
  selectedCompanyId: number | null;
  saveError?: string | null;
  elevated?: boolean;
  onClose: () => void;
  onSave: (updated: Partial<ComponentRow>) => void;
};

export function ComponentEditPanel({ row, isNew = false, existingComponents, selectedCompanyId, saveError, elevated = false, onClose, onSave }: Props) {
  const existingComponentIds = existingComponents.map(c => c.componentId).filter(Boolean);
  const [form, setForm] = useState<ComponentForm>(() => toForm(row, existingComponentIds));
  const [nameError, setNameError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companyLocations, setCompanyLocations] = useState<CompanyLocationOption[]>([]);

  useEffect(() => {
    setForm(toForm(row, existingComponentIds));
    setNameError(null);
    setProductSearch('');
    setVendorSearch('');
  }, [row]);

  useEffect(() => {
    api.vendors(true).then(setVendors).catch(() => setVendors([]));
  }, []);

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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function set<K extends keyof ComponentForm>(key: K, val: ComponentForm[K]) {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'name' && typeof val === 'string') {
        if (isComponentNameTaken(val, existingComponents, row.id)) {
          setNameError('A component with this name already exists.');
        } else {
          setNameError(null);
        }
        if (isNew) {
          next.componentId = generateComponentId(val, existingComponentIds);
        }
      }
      return next;
    });
  }

  function resolveConvertToRecipeQty(
    inventoryUnit: string,
    recipeUnit: string,
    fromQty: string,
    currentQty: string,
  ) {
    if (inventoryUnit === recipeUnit) return { fromQty: '1', qty: '1' };
    const from = parseFloat(fromQty || '1') || 1;
    const conv = getConversion(inventoryUnit, recipeUnit);
    return {
      fromQty: fromQty || '1',
      qty: conv !== null ? String(conv * from) : currentQty,
    };
  }

  function handleComponentUnitChange(val: string) {
    const isAlternateChoice = form.altRecipeUnits.some(a => a.unit === val) && val !== form.recipeUnit;
    if (isAlternateChoice) {
      const swapped = swapPrincipalWithAlternateUnit(form.recipeUnit, form.altRecipeUnits, val);
      setForm(f => {
        const converted = resolveConvertToRecipeQty(
          f.inventoryUnit,
          swapped.principalUnit,
          f.convertFromInventoryQty,
          f.convertToRecipeQty,
        );
        const choices = getComponentUomChoices(swapped.principalUnit, swapped.altUnits);
        const vendorProductComponentUom = Object.fromEntries(
          Object.entries(f.vendorProductComponentUom).filter(([, uom]) => choices.includes(uom)),
        );
        return {
          ...f,
          recipeUnit: swapped.principalUnit,
          altRecipeUnits: refreshAltUnitQtys(swapped.altUnits, swapped.principalUnit),
          convertFromInventoryQty: converted.fromQty,
          convertToRecipeQty: converted.qty,
          vendorProductComponentUom,
        };
      });
      return;
    }

    setForm(f => {
      const converted = resolveConvertToRecipeQty(f.inventoryUnit, val, f.convertFromInventoryQty, f.convertToRecipeQty);
      const choices = getComponentUomChoices(val, f.altRecipeUnits);
      const vendorProductComponentUom = Object.fromEntries(
        Object.entries(f.vendorProductComponentUom).filter(([, uom]) => choices.includes(uom)),
      );
      return {
        ...f,
        recipeUnit: val,
        altRecipeUnits: refreshAltUnitQtys(f.altRecipeUnits, val),
        convertFromInventoryQty: converted.fromQty,
        convertToRecipeQty: converted.qty,
        vendorProductComponentUom,
      };
    });
  }

  function handleInventoryUnitChange(val: string) {
    setForm(f => {
      const converted = resolveConvertToRecipeQty(val, f.recipeUnit, f.convertFromInventoryQty, f.convertToRecipeQty);
      return {
        ...f,
        inventoryUnit: val,
        altInventoryUnits: refreshAltUnitQtys(f.altInventoryUnits, val),
        convertFromInventoryQty: converted.fromQty,
        convertToRecipeQty: converted.qty,
      };
    });
  }

  function handleReferenceFromQtyChange(fromQty: string) {
    setForm(f => {
      const from = parseFloat(fromQty || '1') || 1;
      const conv = getConversion(f.inventoryUnit, f.recipeUnit);
      return {
        ...f,
        convertFromInventoryQty: fromQty,
        convertToRecipeQty: conv !== null ? String(conv * from) : f.convertToRecipeQty,
      };
    });
  }

  function handlePrincipalQtyChange(productId: string, qty: string) {
    setForm(f => ({
      ...f,
      vendorProductPrincipalQty: { ...f.vendorProductPrincipalQty, [productId]: qty },
    }));
  }

  function handleLossYieldChange(productId: string, loss: string) {
    setForm(f => ({
      ...f,
      vendorProductLossYield: { ...f.vendorProductLossYield, [productId]: loss },
    }));
  }

  function handleVendorProductComponentUomChange(productId: string, uom: string) {
    setForm(f => ({
      ...f,
      vendorProductComponentUom: { ...f.vendorProductComponentUom, [productId]: uom },
      vendorProductPrincipalQty: { ...f.vendorProductPrincipalQty, [productId]: '' },
    }));
  }

  function handleAltRecipeUnitsChange(units: AltUnitEntry[]) {
    const next = units.slice(0, MAX_ALTERNATE_UOMS);
    setForm(f => {
      const choices = getComponentUomChoices(f.recipeUnit, next);
      return {
        ...f,
        altRecipeUnits: next,
        vendorProductPrincipalQty: {},
        vendorProductComponentUom: Object.fromEntries(
          Object.entries(f.vendorProductComponentUom).filter(([, uom]) => choices.includes(uom)),
        ),
      };
    });
  }

  function handleToggleVendorProductTag(product: VendorProductCatalogItem, tagged: boolean) {
    if (tagged) {
      const componentUom = form.vendorProductComponentUom[product.id] ?? form.recipeUnit;
      const tagReady = isVendorProductTagReady(product, {
        recipeUnit: form.recipeUnit,
        altRecipeUnits: form.altRecipeUnits,
        componentUom,
        principalQty: form.vendorProductPrincipalQty[product.id],
        productLocationIds: form.vendorProductLocations[product.id] ?? [],
        companyLocationCount: companyLocations.length,
      });
      if (!tagReady.ready) return;
    }

    setForm(f => {
      const taggedVendorProductIds = tagged
        ? [...f.taggedVendorProductIds, product.id].filter((id, i, arr) => arr.indexOf(id) === i)
        : f.taggedVendorProductIds.filter(id => id !== product.id);

      const vendorProductLocations = { ...f.vendorProductLocations };
      if (tagged && !vendorProductLocations[product.id]) {
        vendorProductLocations[product.id] = companyLocations.map(l => l.externalId);
      }
      if (!tagged) {
        delete vendorProductLocations[product.id];
      }

      const primary = tagged
        ? product
        : VENDOR_PRODUCT_CATALOG.find(p => taggedVendorProductIds.includes(p.id));

      return {
        ...f,
        taggedVendorProductIds,
        vendorProductLocations,
        vendor: primary?.vendorName ?? '',
        vendorProduct: primary?.productName ?? '',
        deliveryUnitPrice: primary ? String(primary.deliveryPrice) : f.deliveryUnitPrice,
      };
    });

    if (tagged) {
      setProductSearch('');
      setVendorSearch('');
    }
  }

  function handleProductLocationsChange(productId: string, locationIds: string[]) {
    setForm(f => ({
      ...f,
      vendorProductLocations: { ...f.vendorProductLocations, [productId]: locationIds },
    }));
  }

  const componentUomChoices = useMemo(
    () => getComponentUomChoices(form.recipeUnit, form.altRecipeUnits),
    [form.recipeUnit, form.altRecipeUnits],
  );

  const taggedPricing = useMemo(() => {
    const primaryId = form.taggedVendorProductIds[0];
    if (!primaryId) return null;
    const product = VENDOR_PRODUCT_CATALOG.find(p => p.id === primaryId);
    if (!product) return null;

    const pricing = computeTaggedVendorProductPricing(product, form);

    return { product, ...pricing };
  }, [
    form.taggedVendorProductIds,
    form.vendorProductPrincipalQty,
    form.vendorProductLossYield,
    form.vendorProductComponentUom,
    form.recipeUnit,
    form.altRecipeUnits,
  ]);

  const delivPrice = taggedPricing?.product.deliveryPrice ?? (parseFloat(form.deliveryUnitPrice) || 0);
  const componentPrice = taggedPricing?.nettPrice ?? 0;

  const vendorNames = useMemo(() => {
    const fromApi = vendors.map(v => v.name);
    const fromCatalog = VENDOR_PRODUCT_CATALOG.map(p => p.vendorName);
    return [...new Set([...fromApi, ...fromCatalog])].sort();
  }, [vendors]);

  function save() {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setNameError('Component name is required.');
      return;
    }
    if (isComponentNameTaken(trimmedName, existingComponents, row.id)) {
      setNameError('A component with this name already exists.');
      return;
    }
    onSave({
      name: trimmedName,
      componentId: form.componentId,
      category: form.category,
      group: form.group,
      storage: form.storages,
      storageNote: form.storageNote,
      active: form.active,
      recipeUOM: toApiUom(form.recipeUnit),
      inventoryUOM: toApiUom(form.inventoryUnit),
      lastPriceInventory: delivPrice,
      lastPriceRecipe: componentPrice,
      attachedVendors: form.taggedVendorProductIds.length,
      detailConfig: detailConfigFromForm(form),
    });
  }

  return (
    <>
      <div
        className={elevated ? DETAIL_PANEL_OVERLAY_ELEVATED_CLS : SIDE_PANEL_OVERLAY_CLS}
        onClick={onClose}
        role="presentation"
        aria-hidden
      />

      <div className={elevated ? DETAIL_PANEL_SHELL_ELEVATED_CLS : SIDE_PANEL_SHELL_DETAIL_CLS} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">Smart Component</p>
            <h3 className="text-sm font-semibold text-foreground">
              {isNew ? 'New Component' : row.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors mt-0.5">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          <div>
            <SectionTitle>Basic Info</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Component Name">
                <input
                  className={`${inputCls}${nameError ? ' border-red-500 focus:ring-red-500' : ''}`}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Wagyu Beef A5"
                />
                {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
              </FormField>
              <FormField label="Component ID">
                <input className={`${inputCls} bg-muted text-muted-foreground`} value={form.componentId} readOnly />
                {isNew && (
                  <p className="text-xs text-muted-foreground mt-0.5">Assigned automatically from component name</p>
                )}
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

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          type="button"
                          onClick={() => set('storages', form.storages.filter((_, j) => j !== i))}
                          className="p-1 text-muted-foreground hover:text-accent transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => set('storages', [...form.storages, STORAGE_OPTIONS.find(o => !form.storages.includes(o)) ?? STORAGE_OPTIONS[0]])}
                    className="text-xs font-sans text-primary hover:underline flex items-center gap-1"
                  >
                    + Add storage location
                  </button>
                </div>
              </FormField>

              <FormField label="Storage Note">
                <textarea
                  className={`${inputCls} min-h-[88px] resize-y`}
                  value={form.storageNote}
                  onChange={e => set('storageNote', e.target.value)}
                  placeholder="Optional storage instructions or notes…"
                />
              </FormField>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
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

            <PrincipalAlternateUomBlock
              principalLabel="Principal Component UOM"
              alternateLabel="Alternate Component UOM"
              addAlternateLabel="+ Add alternate component UOM"
              principalUnit={form.recipeUnit}
              altUnits={form.altRecipeUnits}
              showComponentUomChoices
              onPrincipalChange={handleComponentUnitChange}
              onAltUnitsChange={handleAltRecipeUnitsChange}
            />

            <PrincipalAlternateUomBlock
              principalLabel="Principal Inventory UOM"
              alternateLabel="Alternate Inventory UOM"
              addAlternateLabel="+ Add alternate inventory UOM"
              principalUnit={form.inventoryUnit}
              referencePrincipalUom={form.recipeUnit}
              referenceFromQty={form.convertFromInventoryQty}
              referenceQty={form.convertToRecipeQty}
              referenceQtyAutoFilled={
                form.inventoryUnit !== form.recipeUnit
                && isAltQtyAutoFilled(
                  form.inventoryUnit,
                  form.recipeUnit,
                  form.convertToRecipeQty,
                  form.convertFromInventoryQty,
                )
              }
              onReferenceFromQtyChange={handleReferenceFromQtyChange}
              onReferenceQtyChange={qty => set('convertToRecipeQty', qty)}
              altUnits={form.altInventoryUnits}
              onPrincipalChange={handleInventoryUnitChange}
              onAltUnitsChange={units => set('altInventoryUnits', units.slice(0, MAX_ALTERNATE_UOMS))}
              className=""
            />
          </div>

          <div>
            <SectionTitle>Vendor & Pricing</SectionTitle>

            <VendorProductTable
              vendorNames={vendorNames}
              vendor={vendorSearch}
              productSearch={productSearch}
              taggedProductIds={form.taggedVendorProductIds}
              defaultComponentUom={form.recipeUnit}
              principalComponentUom={form.recipeUnit}
              altRecipeUnits={form.altRecipeUnits}
              componentUomChoices={componentUomChoices}
              componentUomByProduct={form.vendorProductComponentUom}
              principalQtyByProduct={form.vendorProductPrincipalQty}
              lossYieldByProduct={form.vendorProductLossYield}
              locationsByProduct={form.vendorProductLocations}
              companyLocations={companyLocations}
              onVendorChange={setVendorSearch}
              onProductSearchChange={setProductSearch}
              onPrincipalQtyChange={handlePrincipalQtyChange}
              onLossYieldChange={handleLossYieldChange}
              onComponentUomChange={handleVendorProductComponentUomChange}
              onToggleTag={handleToggleVendorProductTag}
              onProductLocationsChange={handleProductLocationsChange}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-3">
          {(saveError || nameError) && (
            <p className="text-xs text-red-500 text-right">{saveError ?? nameError}</p>
          )}
          <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose}
            className="text-xs font-sans text-muted-foreground border border-border rounded-md px-4 py-2 hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!form.name.trim() || !!nameError}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isNew ? 'Add Component' : 'Save Changes'}
          </button>
          </div>
        </div>
      </div>
    </>
  );
}
