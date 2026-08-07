import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api, type Vendor } from '../../api';
import {
  getKnownRecipeUnits,
  getKnownStorageOptions,
} from '../../data/componentCatalogConfig';
import {
  getHierarchyCategoryOptions,
  getHierarchyGroupOptions,
  loadComponentHierarchy,
  loadComponentHierarchyForCompany,
  type ComponentHierarchyState,
} from '../../data/componentHierarchy';
import {
  type AltUnitEntry,
  type ComponentForm,
  type ComponentRow,
  generateComponentId,
  getConversion,
  getComponentUomChoices,
  isConversionQtyAutoFilled,
  inputCls,
  isComponentNameTaken,
  findSimilarComponentNames,
  componentNameValidationMessage,
  normalizeComponentName,
  MAX_ALTERNATE_UOMS,
  selectCls,
  swapPrincipalWithAlternateUnit,
  detailConfigFromForm,
  toApiUom,
  toForm,
} from '../../data/componentForm';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_DETAIL_CLS, DETAIL_PANEL_OVERLAY_ELEVATED_CLS, DETAIL_PANEL_SHELL_ELEVATED_CLS } from '../layout/sidePanelShared';
import { labelsEqual } from '../../utils/labelMatch';
import {
  resolveScopedTaggedVendorProducts,
  VendorProductTable,
  VendorProductTaggedSection,
  type CompanyLocationOption,
} from './VendorProductTable';
import { isVendorProductTagReady, countComponentTaggedVendors } from '../../data/vendorProductTagging';
import {
  formatParStock,
  resolveParStockDisplay,
} from '../../data/componentParStock';
import { VENDOR_PRODUCT_CATALOG, calcComponentPrincipalUomPrice, calcNettUomPrice, calcNettUomQty, resolveComponentUomQty, type VendorProductCatalogItem } from '../../data/vendorProductCatalog';
import { ComponentSplitUseSection } from './ComponentSplitUseSection';
import { SearchableSelect } from './SearchableSelect';
import {
  calcSplitUseNettUnitCost,
  createSplitUseLine,
  toSplitUseBasisQty,
  validateSplitUseConfig,
} from '../../data/componentSplitUse';
import { hasExactCatalogNameMatch } from '../../utils/catalogNameMatch';
import { SimilarNameMatchesNotice } from '../shared/SimilarNameMatchesNotice';

function computeTaggedVendorProductPricing(
  product: VendorProductCatalogItem,
  form: ComponentForm,
  skipYieldLoss = false,
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
  const lossYield = skipYieldLoss ? 0 : (parseFloat(form.vendorProductLossYield[product.id] ?? '0') || 0);
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
// Qty inputs are intentionally large enough for multi-digit conversions (2× prior widths).
const COMPACT_FROM_QTY_CLS = `${COMPACT_INPUT_CLS} min-w-[8.5rem] w-[8.5rem] tabular-nums text-right`;
const COMPACT_TO_QTY_CLS = `${COMPACT_INPUT_CLS} min-w-[8.5rem] w-[8.5rem] tabular-nums text-right`;
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
          className={`${COMPACT_TO_QTY_CLS}${autoFilled ? ' pr-8' : ''}`}
        />
        {autoFilled && (
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] font-sans text-primary pointer-events-none">auto</span>
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
  return isConversionQtyAutoFilled(altUnit, principalUom, qty, fromQty);
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
  principalAside?: React.ReactNode;
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
  principalAside,
}: PrincipalAlternateUomBlockProps) {
  const recipeUnits = getKnownRecipeUnits();
  const unitOptions = recipeUnits.filter(u => u !== principalUnit);
  const componentUomChoices = showComponentUomChoices
    ? getComponentUomChoices(principalUnit, altUnits)
    : [];
  const otherPrincipalUnits = showComponentUomChoices
    ? recipeUnits.filter(u => !componentUomChoices.includes(u))
    : recipeUnits;

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
      { fromQty: '1', qty: '', unit: unitOptions[0] ?? recipeUnits[1] },
    ]);
  }

  function removeAltUnit(idx: number) {
    onAltUnitsChange(altUnits.filter((_, j) => j !== idx));
  }

  return (
    <div className={className}>
      <div className={`mb-5 ${principalAside ? 'flex flex-wrap items-start gap-4' : ''}`}>
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
            {!showComponentUomChoices && recipeUnits.map(u => <option key={u}>{u}</option>)}
          </select>
        </FormField>
        {principalAside}
      </div>

      {referencePrincipalUom && onReferenceFromQtyChange && onReferenceQtyChange && (
        principalUnit === referencePrincipalUom ? (
          <div className="mb-4 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Selected unit matches the principal component UOM — no conversion required.
            </p>
          </div>
        ) : (
        <div className="mb-4">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider mb-1">
            Principal Conversion Reference
          </p>
          <p className="text-xs text-muted-foreground mb-2">
            Define how this unit converts to the principal component UOM (auto-filled when known).
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
  selectedLocationIds?: string[];
  saveError?: string | null;
  elevated?: boolean;
  onClose: () => void;
  onSave: (updated: Partial<ComponentRow>) => void;
};

export function ComponentEditPanel({ row, isNew = false, existingComponents, selectedCompanyId, selectedLocationIds = [], saveError, elevated = false, onClose, onSave }: Props) {
  const existingComponentIds = existingComponents.map(c => c.componentId).filter(Boolean);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [form, setForm] = useState<ComponentForm>(() => toForm(row, existingComponentIds));
  const [nameError, setNameError] = useState<string | null>(null);
  const similarComponentNameMatches = useMemo(
    () => findSimilarComponentNames(form.name, existingComponents, row.id),
    [form.name, existingComponents, row.id],
  );
  const [productSearch, setProductSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companyLocations, setCompanyLocations] = useState<CompanyLocationOption[]>([]);
  const [splitUseError, setSplitUseError] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<ComponentHierarchyState>(() => loadComponentHierarchy());
  const [catalogVersion, setCatalogVersion] = useState(0);

  const categoryExtras = useMemo(
    () => existingComponents.map(component => component.category).filter(Boolean),
    [existingComponents],
  );
  const groupExtras = useMemo(
    () => existingComponents
      .filter(component => !form.category || labelsEqual(component.category, form.category))
      .map(component => component.group)
      .filter(Boolean),
    [existingComponents, form.category],
  );

  const categoryOptions = useMemo(
    () => getHierarchyCategoryOptions(hierarchy, form.category, categoryExtras),
    [hierarchy, form.category, categoryExtras],
  );

  const groupOptions = useMemo(
    () => getHierarchyGroupOptions(hierarchy, form.category, form.group, groupExtras),
    [hierarchy, form.category, form.group, groupExtras],
  );

  const storageOptions = useMemo(() => {
    const options = getKnownStorageOptions();
    const extras = form.storages.filter(
      storage => storage && !options.some(option => option.toLowerCase() === storage.toLowerCase()),
    );
    return extras.length > 0 ? [...options, ...extras].sort((a, b) => a.localeCompare(b)) : options;
  }, [form.storages, catalogVersion]);

  useEffect(() => {
    setForm(toForm(row, existingComponentIds, companyCode));
    setNameError(null);
    setProductSearch('');
    setVendorSearch('');
  }, [row, companyCode]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyCode(null);
      return;
    }
    api.companies()
      .then(companies => {
        const match = companies.find(c => c.id === selectedCompanyId);
        setCompanyCode(match?.code?.trim() || null);
      })
      .catch(() => setCompanyCode(null));
  }, [selectedCompanyId]);

  useEffect(() => {
    let cancelled = false;
    const reloadHierarchy = () => setHierarchy(loadComponentHierarchy());
    const reloadCatalog = () => setCatalogVersion(version => version + 1);
    reloadHierarchy();
    if (selectedCompanyId) {
      void loadComponentHierarchyForCompany(selectedCompanyId).then(next => {
        if (!cancelled) setHierarchy(next);
      });
    }
    window.addEventListener('bisync:componentHierarchyChanged', reloadHierarchy);
    window.addEventListener('bisync:componentCatalogChanged', reloadCatalog);
    window.addEventListener('storage', reloadHierarchy);
    return () => {
      cancelled = true;
      window.removeEventListener('bisync:componentHierarchyChanged', reloadHierarchy);
      window.removeEventListener('bisync:componentCatalogChanged', reloadCatalog);
      window.removeEventListener('storage', reloadHierarchy);
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    setForm(f => {
      const categories = getHierarchyCategoryOptions(hierarchy, f.category, categoryExtras);
      const categoryValid = categories.some(
        category => category.toLowerCase() === f.category.toLowerCase(),
      );
      const category = categoryValid ? f.category : (categories[0] ?? f.category);
      const groupsForCategory = existingComponents
        .filter(component => !category || labelsEqual(component.category, category))
        .map(component => component.group)
        .filter(Boolean);
      const groups = getHierarchyGroupOptions(hierarchy, category, f.group, groupsForCategory);
      const groupValid = groups.some(group => group.toLowerCase() === f.group.toLowerCase());
      const group = groupValid ? f.group : (groups[0] ?? f.group);
      if (category === f.category && group === f.group) return f;
      return { ...f, category, group };
    });
  }, [hierarchy, categoryExtras, existingComponents]);

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
            .filter(l => l.companyId === selectedCompanyId && l.active !== false)
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

  function handleCategoryChange(category: string) {
    setForm(f => {
      const groups = getHierarchyGroupOptions(hierarchy, category, f.group, []);
      const groupStillValid = groups.some(group => group.toLowerCase() === f.group.toLowerCase());
      return {
        ...f,
        category,
        group: groupStillValid ? f.group : (groups[0] ?? ''),
      };
    });
  }

  function set<K extends keyof ComponentForm>(key: K, val: ComponentForm[K]) {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'name' && typeof val === 'string') {
        const validation = componentNameValidationMessage(val);
        if (validation) {
          setNameError(validation);
        } else if (isComponentNameTaken(val, existingComponents, row.id)) {
          setNameError('A component with this name already exists (active or inactive).');
        } else {
          setNameError(null);
        }
        if (isNew) {
          next.componentId = generateComponentId(companyCode, existingComponentIds);
        }
      }
      return next;
    });
  }

  function handleComponentUnitChange(val: string) {
    const isAlternateChoice = form.altRecipeUnits.some(a => a.unit === val) && val !== form.recipeUnit;
    if (isAlternateChoice) {
      const swapped = swapPrincipalWithAlternateUnit(form.recipeUnit, form.altRecipeUnits, val);
      setForm(f => {
        const choices = getComponentUomChoices(swapped.principalUnit, swapped.altUnits);
        const vendorProductComponentUom = Object.fromEntries(
          Object.entries(f.vendorProductComponentUom).filter(([, uom]) => choices.includes(uom)),
        );
        return {
          ...f,
          recipeUnit: swapped.principalUnit,
          inventoryUnit: swapped.principalUnit,
          altRecipeUnits: refreshAltUnitQtys(swapped.altUnits, swapped.principalUnit),
          altInventoryUnits: [],
          convertFromInventoryQty: '1',
          convertToRecipeQty: '1',
          vendorProductComponentUom,
        };
      });
      return;
    }

    setForm(f => {
      const choices = getComponentUomChoices(val, f.altRecipeUnits);
      const vendorProductComponentUom = Object.fromEntries(
        Object.entries(f.vendorProductComponentUom).filter(([, uom]) => choices.includes(uom)),
      );
      return {
        ...f,
        recipeUnit: val,
        inventoryUnit: val,
        altRecipeUnits: refreshAltUnitQtys(f.altRecipeUnits, val),
        altInventoryUnits: [],
        convertFromInventoryQty: '1',
        convertToRecipeQty: '1',
        vendorProductComponentUom,
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
    const activeLocationIds = selectedLocationIds;

    if (tagged) {
      const componentUom = form.vendorProductComponentUom[product.id] ?? form.recipeUnit;
      const assignedLocations = form.vendorProductLocations[product.id] ?? [];
      const tagReadyLocations = activeLocationIds.length > 0
        ? [...new Set([...assignedLocations, ...activeLocationIds])]
        : assignedLocations;
      const tagReady = isVendorProductTagReady(product, {
        recipeUnit: form.recipeUnit,
        altRecipeUnits: form.altRecipeUnits,
        componentUom,
        principalQty: form.vendorProductPrincipalQty[product.id],
        productLocationIds: tagReadyLocations.length > 0
          ? tagReadyLocations
          : companyLocations.map(location => location.externalId),
        companyLocationCount: companyLocations.length,
      });
      if (!tagReady.ready) return;
    }

    setForm(f => {
      let taggedVendorProductIds = [...f.taggedVendorProductIds];
      const vendorProductLocations = { ...f.vendorProductLocations };
      let productLocations = [...(vendorProductLocations[product.id] ?? [])];

      if (tagged) {
        if (!taggedVendorProductIds.includes(product.id)) {
          taggedVendorProductIds.push(product.id);
        }
        if (activeLocationIds.length > 0) {
          productLocations = [...new Set([...productLocations, ...activeLocationIds])];
        } else if (productLocations.length === 0) {
          productLocations = companyLocations.map(location => location.externalId);
        }
        vendorProductLocations[product.id] = productLocations;
      } else if (activeLocationIds.length > 0) {
        productLocations = productLocations.filter(id => !activeLocationIds.includes(id));
        if (productLocations.length === 0) {
          delete vendorProductLocations[product.id];
          taggedVendorProductIds = taggedVendorProductIds.filter(id => id !== product.id);
        } else {
          vendorProductLocations[product.id] = productLocations;
        }
      } else {
        delete vendorProductLocations[product.id];
        taggedVendorProductIds = taggedVendorProductIds.filter(id => id !== product.id);
      }

      const primary = taggedVendorProductIds.length > 0
        ? VENDOR_PRODUCT_CATALOG.find(p => taggedVendorProductIds.includes(p.id))
        : undefined;

      return {
        ...f,
        taggedVendorProductIds,
        vendorProductLocations,
        vendor: primary?.vendorName ?? '',
        vendorProduct: primary?.productName ?? '',
        deliveryUnitPrice: primary ? String(primary.deliveryPrice) : f.deliveryUnitPrice,
      };
    });

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

    const pricing = computeTaggedVendorProductPricing(product, form, form.splitUse.enabled);

    return { product, ...pricing };
  }, [
    form.taggedVendorProductIds,
    form.vendorProductPrincipalQty,
    form.vendorProductLossYield,
    form.vendorProductComponentUom,
    form.recipeUnit,
    form.altRecipeUnits,
    form.splitUse.enabled,
  ]);

  const delivPrice = taggedPricing?.product.deliveryPrice ?? (parseFloat(form.deliveryUnitPrice) || 0);
  const yieldNettPrice = taggedPricing?.nettPrice ?? 0;
  const taggedReceiptBasisQty = taggedPricing
    ? toSplitUseBasisQty(
      taggedPricing.principalQty,
      taggedPricing.productUom,
      form.splitUse,
      form.inventoryUnit,
      form.recipeUnit,
      form.convertFromInventoryQty,
      form.convertToRecipeQty,
    ) ?? undefined
    : undefined;
  const splitNettPrice = form.splitUse.enabled
    ? calcSplitUseNettUnitCost(
      delivPrice,
      form.splitUse,
      form.inventoryUnit,
      form.recipeUnit,
      form.convertFromInventoryQty,
      form.convertToRecipeQty,
      taggedReceiptBasisQty,
    )
    : 0;
  // Product BOM always uses nett recipe cost (Yield Loss or Split Use).
  const componentPrice = form.splitUse.enabled ? splitNettPrice : yieldNettPrice;

  const dailyUsageRecipe = parseFloat(form.dailyUsage) > 0
    ? parseFloat(form.dailyUsage) || 0
    : 0;
  const dailyUsageDisplay = dailyUsageRecipe;

  const parStockDisplay = resolveParStockDisplay({
    dailyUsage: dailyUsageRecipe,
    orderFreqDays: parseInt(form.orderFreqDays, 10) || 0,
    basis: 'recipe',
    recipeUnit: form.recipeUnit,
    inventoryUnit: form.recipeUnit,
    convertFromInventoryQty: '1',
    convertToRecipeQty: '1',
  });

  function handleDailyUsageChange(rawValue: string) {
    if (!rawValue.trim()) {
      set('dailyUsage', '');
      return;
    }
    const parsed = parseFloat(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    set('dailyUsage', String(parsed));
  }

  const vendorNames = useMemo(() => {
    const fromApi = vendors.map(v => v.name);
    const fromCatalog = VENDOR_PRODUCT_CATALOG.map(p => p.vendorName);
    return [...new Set([...fromApi, ...fromCatalog])].sort();
  }, [vendors]);

  function handleSplitUseEnabledChange(enabled: boolean) {
    setSplitUseError(null);
    setForm(f => {
      const nextSplitUse = { ...f.splitUse, enabled };
      if (enabled && nextSplitUse.lines.length === 0) {
        nextSplitUse.lines = [createSplitUseLine()];
      }
      if (enabled && (!nextSplitUse.componentQty.trim() || nextSplitUse.componentQty === '1')) {
        nextSplitUse.componentQty = '1';
        nextSplitUse.qtyBasis = 'recipe';
      }
      return {
        ...f,
        splitUse: nextSplitUse,
        vendorProductLossYield: enabled ? {} : f.vendorProductLossYield,
      };
    });
  }

  function save() {
    const validation = componentNameValidationMessage(form.name);
    if (validation) {
      setNameError(validation);
      return;
    }
    const trimmedName = normalizeComponentName(form.name);
    if (isComponentNameTaken(trimmedName, existingComponents, row.id)
      || hasExactCatalogNameMatch(similarComponentNameMatches)) {
      setNameError('A component with this name already exists (active or inactive).');
      return;
    }
    const splitError = validateSplitUseConfig(
      form.splitUse,
      form.inventoryUnit,
      form.recipeUnit,
      form.convertFromInventoryQty,
      form.convertToRecipeQty,
    );
    if (splitError) {
      setSplitUseError(splitError);
      return;
    }
    setSplitUseError(null);
    onSave({
      name: trimmedName,
      componentId: form.componentId,
      category: form.category,
      group: form.group,
      storage: form.storages,
      storageNote: form.storageNote,
      active: form.active,
      recipeUOM: toApiUom(form.recipeUnit),
      inventoryUOM: toApiUom(form.recipeUnit),
      lastPriceInventory: delivPrice,
      lastPriceRecipe: componentPrice,
      dailyUsage: dailyUsageRecipe,
      orderFreqDays: parseInt(form.orderFreqDays, 10) || 7,
      attachedVendors: countComponentTaggedVendors({ detailConfig: detailConfigFromForm(form) }),
      detailConfig: detailConfigFromForm(form),
    });
    setProductSearch('');
    setVendorSearch('');
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
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">My Component (ingredient)</p>
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
                  className={`${inputCls}${nameError || hasExactCatalogNameMatch(similarComponentNameMatches) ? ' border-red-500 focus:ring-red-500' : ''}`}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Wagyu Beef A5"
                />
                {nameError && <p className="text-xs text-red-500 mt-0.5">{nameError}</p>}
                <SimilarNameMatchesNotice matches={similarComponentNameMatches} entityLabel="component" />
              </FormField>
              <FormField label="Component ID">
                <input className={`${inputCls} bg-muted text-muted-foreground`} value={form.componentId} readOnly />
                {isNew && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assigned automatically from company code{companyCode ? ` (${companyCode})` : ''}
                  </p>
                )}
              </FormField>
              <FormField label="Category">
                <select className={selectCls} value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                  {categoryOptions.map(category => <option key={category}>{category}</option>)}
                </select>
              </FormField>
              <FormField label="Group">
                <SearchableSelect
                  value={form.group}
                  options={groupOptions}
                  placeholder="Select group…"
                  emptyLabel="No matching groups"
                  onChange={group => set('group', group)}
                />
              </FormField>
            </div>

            <div className="mt-3 space-y-3">
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
                        className={`${selectCls} flex-1 max-w-md`}
                      >
                        {storageOptions.map(option => <option key={option}>{option}</option>)}
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
                    onClick={() => set('storages', [...form.storages, storageOptions.find(option => !form.storages.includes(option)) ?? storageOptions[0]])}
                    className="text-xs font-sans text-primary hover:underline flex items-center gap-1"
                  >
                    + Add storage location
                  </button>
                </div>
              </FormField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Expiry (days)">
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="1"
                    value={form.expiryPeriodDays}
                    onChange={e => set('expiryPeriodDays', e.target.value)}
                    placeholder="e.g. 7"
                  />
                </FormField>
                <FormField label="Storage Suggestion">
                  <input
                    className={inputCls}
                    type="text"
                    value={form.storageNote}
                    onChange={e => set('storageNote', e.target.value)}
                    placeholder="e.g. Keep chilled below 4°C"
                  />
                </FormField>
              </div>
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
              principalAside={(
                <div className="flex-1 min-w-[280px] rounded-md border border-border bg-muted/10 p-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.splitUse.enabled}
                      onChange={e => handleSplitUseEnabledChange(e.target.checked)}
                      className="rounded border-border"
                    />
                    Split Use
                  </label>
                  {form.splitUse.enabled ? (
                    <ComponentSplitUseSection
                      form={form}
                      componentPrice={componentPrice}
                      principalQty={taggedPricing?.principalQty ?? 1}
                      onChange={splitUse => setForm(f => ({ ...f, splitUse }))}
                    />
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Break this component into sub-components for stock and costing (e.g. whole chicken into parts).
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          <div>
            <SectionTitle>Usage &amp; Par Stock</SectionTitle>
            <p className="text-xs text-muted-foreground font-sans mb-3">
              Base par stock = daily usage × order frequency. Quantities use Principal Component UOM
              ({form.recipeUnit}).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label={`Daily Usage (${form.recipeUnit}/day)`}>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="any"
                  value={dailyUsageDisplay > 0 ? String(dailyUsageDisplay) : ''}
                  onChange={e => handleDailyUsageChange(e.target.value)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Order Freq (days)">
                <input
                  className={inputCls}
                  type="number"
                  min="1"
                  step="1"
                  value={form.orderFreqDays}
                  onChange={e => set('orderFreqDays', e.target.value)}
                />
              </FormField>
              <FormField label="Base Par Stock">
                <div className={inputCls}>
                  {formatParStock(parStockDisplay.value, parStockDisplay.uom)}
                </div>
              </FormField>
            </div>
          </div>

          <div>
            <VendorProductTaggedSection
              products={resolveScopedTaggedVendorProducts(
                form.taggedVendorProductIds,
                form.vendorProductLocations,
                selectedLocationIds,
              )}
              companyLocations={companyLocations}
              hideYieldLoss={form.splitUse.enabled}
              handlers={{
                defaultComponentUom: form.recipeUnit,
                principalComponentUom: form.recipeUnit,
                altRecipeUnits: form.altRecipeUnits,
                componentUomChoices,
                componentUomByProduct: form.vendorProductComponentUom,
                principalQtyByProduct: form.vendorProductPrincipalQty,
                lossYieldByProduct: form.vendorProductLossYield,
                locationsByProduct: form.vendorProductLocations,
                taggedProductIds: form.taggedVendorProductIds,
                activeLocationIds: selectedLocationIds,
                onPrincipalQtyChange: handlePrincipalQtyChange,
                onLossYieldChange: handleLossYieldChange,
                onComponentUomChange: handleVendorProductComponentUomChange,
                onToggleTag: handleToggleVendorProductTag,
                onProductLocationsChange: handleProductLocationsChange,
              }}
            />

            <SectionTitle>Vendor &amp; Pricing</SectionTitle>

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
              hideYieldLoss={form.splitUse.enabled}
              showTaggedSection={false}
              locationsByProduct={form.vendorProductLocations}
              companyLocations={companyLocations}
              activeLocationIds={selectedLocationIds}
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
          {(saveError || nameError || splitUseError) && (
            <p className="text-xs text-red-500 text-right">{saveError ?? splitUseError ?? nameError}</p>
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
