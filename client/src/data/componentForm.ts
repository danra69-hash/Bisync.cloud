export const RECIPE_UNITS = [
  'Mg', 'Gr', 'Kg', 'Tonne',
  'Ml', 'Cl', 'Ltr',
  'Each', 'Punnet', 'Bunch', 'Tray', 'Case', 'Bottle', 'Can', 'Tin', 'Slice',
  'Oz', 'Lb', 'FlOz', 'Gal',
];
export const STORAGE_OPTIONS = ['Chiller', 'Dry Store', 'Freezer', 'Wine Cellar', 'Storeroom', 'Office', 'Warehouse', 'Bar', 'Prep Kitchen'];

export const UNIT_CONV: Record<string, Record<string, number>> = {
  Mg: { Gr: 0.001, Kg: 0.000001, Tonne: 0.000000001 },
  Gr: { Mg: 1000, Kg: 0.001, Tonne: 0.000001, Oz: 0.035274, Lb: 0.00220462 },
  Kg: { Mg: 1_000_000, Gr: 1000, Tonne: 0.001, Oz: 35.274, Lb: 2.20462 },
  Tonne: { Mg: 1_000_000_000, Gr: 1_000_000, Kg: 1000, Lb: 2204.62 },
  Ml: { Cl: 0.1, Ltr: 0.001, FlOz: 0.033814 },
  Cl: { Ml: 10, Ltr: 0.01 },
  Ltr: { Ml: 1000, Cl: 100, FlOz: 33.814, Gal: 0.264172 },
  FlOz: { Ml: 29.5735, Ltr: 0.0295735, Gal: 0.0078125 },
  Gal: { Ml: 3785.41, Ltr: 3.78541, FlOz: 128 },
  Oz: { Gr: 28.3495, Kg: 0.0283495, Lb: 0.0625 },
  Lb: { Gr: 453.592, Kg: 0.453592, Tonne: 0.000453592, Oz: 16 },
};

export function getConversion(from: string, to: string): number | null {
  if (from === to) return 1;
  return UNIT_CONV[from]?.[to] ?? null;
}

export function toApiUom(unit: string): string {
  const map: Record<string, string> = {
    Mg: 'mg', Gr: 'g', Kg: 'kg', Tonne: 't',
    Ml: 'ml', Cl: 'cl', Ltr: 'L',
    Each: 'pcs', Punnet: 'punnet', Bunch: 'bunch', Tray: 'tray', Case: 'case', Bottle: 'btl', Can: 'can', Tin: 'tin', Slice: 'slice',
    Oz: 'oz', Lb: 'lb', FlOz: 'fl oz', Gal: 'gal',
  };
  return map[unit] ?? unit.toLowerCase();
}

export function fromApiUom(unit: string): string {
  const map: Record<string, string> = {
    mg: 'Mg', g: 'Gr', kg: 'Kg', t: 'Tonne',
    ml: 'Ml', cl: 'Cl', L: 'Ltr',
    pcs: 'Each', punnet: 'Punnet', bunch: 'Bunch', tray: 'Tray', case: 'Case', btl: 'Bottle', can: 'Can', tin: 'Tin', slice: 'Slice',
    oz: 'Oz', lb: 'Lb', 'fl oz': 'FlOz', gal: 'Gal', box: 'Case', set: 'Each',
  };
  return map[unit] ?? unit;
}

export type AltUnitEntry = { fromQty: string; qty: string; unit: string };

export const MAX_ALTERNATE_UOMS = 2;

/** Principal component UOM plus up to two configured alternates. */
export function getComponentUomChoices(principalUnit: string, altUnits: AltUnitEntry[]): string[] {
  const alternates = altUnits.map(a => a.unit).filter(u => u && u !== principalUnit);
  return [...new Set([principalUnit, ...alternates])].slice(0, 1 + MAX_ALTERNATE_UOMS);
}

export function swapPrincipalWithAlternateUnit(
  principalUnit: string,
  altUnits: AltUnitEntry[],
  selectedUnit: string,
): { principalUnit: string; altUnits: AltUnitEntry[] } {
  if (selectedUnit === principalUnit) {
    return { principalUnit, altUnits };
  }

  const altIndex = altUnits.findIndex(a => a.unit === selectedUnit);
  if (altIndex < 0) {
    return { principalUnit: selectedUnit, altUnits };
  }

  const picked = altUnits[altIndex];
  const pickedFrom = parseFloat(picked.fromQty || '1') || 1;
  const pickedQty = parseFloat(picked.qty || '1') || 1;

  const formerPrincipalAlt: AltUnitEntry = {
    unit: principalUnit,
    fromQty: String(pickedQty),
    qty: String(pickedFrom),
  };

  const remainingAlts = altUnits
    .filter((_, i) => i !== altIndex)
    .map(au => {
      const auFrom = parseFloat(au.fromQty || '1') || 1;
      const auQty = parseFloat(au.qty || '1') || 1;
      const scaledQty = pickedQty === 0 ? auQty : (auQty * pickedFrom) / pickedQty;
      return {
        ...au,
        fromQty: String(auFrom),
        qty: Number.isFinite(scaledQty) ? String(scaledQty) : au.qty,
      };
    });

  return {
    principalUnit: selectedUnit,
    altUnits: [formerPrincipalAlt, ...remainingAlts].slice(0, MAX_ALTERNATE_UOMS),
  };
}

export type ComponentDetailConfig = {
  altRecipeUnits: AltUnitEntry[];
  altInventoryUnits: AltUnitEntry[];
  convertFromInventoryQty: string;
  convertToRecipeQty: string;
  taggedVendorProductIds: string[];
  vendorProductPrincipalQty: Record<string, string>;
  vendorProductLossYield: Record<string, string>;
  vendorProductComponentUom: Record<string, string>;
  vendorProductLocations: Record<string, string[]>;
  vendor: string;
  vendorProduct: string;
  deliveryUnitPrice: string;
};

export const EMPTY_COMPONENT_DETAIL_CONFIG: ComponentDetailConfig = {
  altRecipeUnits: [],
  altInventoryUnits: [],
  convertFromInventoryQty: '1',
  convertToRecipeQty: '1',
  taggedVendorProductIds: [],
  vendorProductPrincipalQty: {},
  vendorProductLossYield: {},
  vendorProductComponentUom: {},
  vendorProductLocations: {},
  vendor: '',
  vendorProduct: '',
  deliveryUnitPrice: '',
};

export function detailConfigFromForm(form: ComponentForm): ComponentDetailConfig {
  return {
    altRecipeUnits: form.altRecipeUnits,
    altInventoryUnits: form.altInventoryUnits,
    convertFromInventoryQty: form.convertFromInventoryQty,
    convertToRecipeQty: form.convertToRecipeQty,
    taggedVendorProductIds: form.taggedVendorProductIds,
    vendorProductPrincipalQty: form.vendorProductPrincipalQty,
    vendorProductLossYield: form.vendorProductLossYield,
    vendorProductComponentUom: form.vendorProductComponentUom,
    vendorProductLocations: form.vendorProductLocations,
    vendor: form.vendor,
    vendorProduct: form.vendorProduct,
    deliveryUnitPrice: form.deliveryUnitPrice,
  };
}

export function parseDetailConfigJson(json: string | null | undefined): ComponentDetailConfig {
  if (!json || json.trim() === '') return { ...EMPTY_COMPONENT_DETAIL_CONFIG };
  try {
    const parsed = JSON.parse(json) as Partial<ComponentDetailConfig>;
    return {
      ...EMPTY_COMPONENT_DETAIL_CONFIG,
      ...parsed,
      altRecipeUnits: Array.isArray(parsed.altRecipeUnits) ? parsed.altRecipeUnits : [],
      altInventoryUnits: Array.isArray(parsed.altInventoryUnits) ? parsed.altInventoryUnits : [],
      taggedVendorProductIds: Array.isArray(parsed.taggedVendorProductIds) ? parsed.taggedVendorProductIds : [],
      vendorProductPrincipalQty: parsed.vendorProductPrincipalQty ?? {},
      vendorProductLossYield: parsed.vendorProductLossYield ?? {},
      vendorProductComponentUom: parsed.vendorProductComponentUom ?? {},
      vendorProductLocations: parsed.vendorProductLocations ?? {},
    };
  } catch {
    return { ...EMPTY_COMPONENT_DETAIL_CONFIG };
  }
}

export function serializeDetailConfig(config: ComponentDetailConfig): string {
  return JSON.stringify(config);
}

export function readDetailConfigJsonFromIngredient(ingredient: {
  detailConfigJson?: string | null;
  DetailConfigJson?: string | null;
}): string {
  const raw = ingredient.detailConfigJson ?? ingredient.DetailConfigJson;
  return raw && raw.trim() !== '' ? raw : '{}';
}

export function resolveDetailConfigForRow(row: Pick<ComponentRow, 'detailConfig' | 'detailConfigJson'>): ComponentDetailConfig {
  if (row.detailConfig) return row.detailConfig;
  return parseDetailConfigJson(row.detailConfigJson);
}

export function resolveDetailConfigJsonForSave(
  row: Pick<ComponentRow, 'detailConfig' | 'detailConfigJson'>,
  partial: Partial<ComponentRow> = {},
): string {
  const merged = { ...row, ...partial };
  if (merged.detailConfig) {
    return serializeDetailConfig(merged.detailConfig);
  }
  if (merged.detailConfigJson && merged.detailConfigJson.trim() !== '' && merged.detailConfigJson !== '{}') {
    return merged.detailConfigJson;
  }
  return serializeDetailConfig(EMPTY_COMPONENT_DETAIL_CONFIG);
}

export type ComponentForm = {
  name: string;
  componentId: string;
  category: string;
  group: string;
  storages: string[];
  storageNote: string;
  active: boolean;
  recipeUnit: string;
  altRecipeUnits: AltUnitEntry[];
  inventoryUnit: string;
  altInventoryUnits: AltUnitEntry[];
  vendor: string;
  vendorProduct: string;
  taggedVendorProductIds: string[];
  vendorProductPrincipalQty: Record<string, string>;
  vendorProductLossYield: Record<string, string>;
  vendorProductComponentUom: Record<string, string>;
  vendorProductLocations: Record<string, string[]>;
  deliveryUnitPrice: string;
  convertFromInventoryQty: string;
  convertToRecipeQty: string;
  lossYield: string;
};

export function buildComponentIdPrefix(name: string): string {
  const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alpha.slice(0, 6) || 'NEW';
}

export function generateComponentId(name: string, existingIds: string[]): string {
  const baseId = `CMP-${buildComponentIdPrefix(name)}`;
  for (let seq = 1; seq <= 999; seq++) {
    const candidate = `${baseId}-${String(seq).padStart(3, '0')}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${baseId}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function isComponentNameTaken(
  name: string,
  existing: { id?: number; name: string }[],
  excludeId?: number,
): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return existing.some(c => c.id !== excludeId && c.name.trim().toLowerCase() === normalized);
}

export type ComponentRow = {
  id?: number;
  componentId: string;
  name: string;
  category: string;
  group: string;
  recipeUOM: string;
  inventoryUOM: string;
  lastPriceRecipe: number;
  lastPriceInventory: number;
  dailyUsage: number;
  orderFreqDays: number;
  storage: string[];
  storageNote?: string;
  attachedProducts: number;
  attachedVendors: number;
  active: boolean;
  locations: string[];
  detailConfig?: ComponentDetailConfig;
  detailConfigJson?: string;
};

export function toForm(row: ComponentRow, existingComponentIds: string[] = []): ComponentForm {
  const recipeUnit = fromApiUom(row.recipeUOM);
  const inventoryUnit = fromApiUom(row.inventoryUOM);
  const componentId = row.componentId
    || generateComponentId(row.name || 'New', existingComponentIds);
  const detail = resolveDetailConfigForRow(row);
  return {
    name: row.name,
    componentId,
    category: row.category,
    group: row.group,
    storages: [...row.storage],
    storageNote: row.storageNote ?? '',
    active: row.active,
    recipeUnit,
    altRecipeUnits: detail.altRecipeUnits.map(au => ({ ...au, fromQty: au.fromQty ?? '1' })),
    inventoryUnit,
    altInventoryUnits: detail.altInventoryUnits.map(au => ({ ...au, fromQty: au.fromQty ?? '1' })),
    vendor: detail.vendor,
    vendorProduct: detail.vendorProduct,
    taggedVendorProductIds: [...detail.taggedVendorProductIds],
    vendorProductPrincipalQty: { ...detail.vendorProductPrincipalQty },
    vendorProductLossYield: { ...detail.vendorProductLossYield },
    vendorProductComponentUom: { ...detail.vendorProductComponentUom },
    vendorProductLocations: { ...detail.vendorProductLocations },
    deliveryUnitPrice: detail.deliveryUnitPrice || String(row.lastPriceInventory),
    convertFromInventoryQty: detail.convertFromInventoryQty || '1',
    convertToRecipeQty: detail.convertToRecipeQty || (
      inventoryUnit === recipeUnit
        ? '1'
        : String(getConversion(inventoryUnit, recipeUnit) ?? '')
    ),
    lossYield: '0',
  };
}

export const blankComponentRow: ComponentRow = {
  componentId: '',
  name: '',
  category: 'Food',
  group: 'Proteins',
  recipeUOM: 'g',
  inventoryUOM: 'kg',
  lastPriceRecipe: 0,
  lastPriceInventory: 0,
  dailyUsage: 0,
  orderFreqDays: 7,
  storage: ['Dry Store'],
  storageNote: '',
  attachedProducts: 0,
  attachedVendors: 0,
  active: true,
  locations: ['all'],
};

export { fieldCls, filterInputCls, filterSelectCls, inlineNumberCls, inputCls, numberCls, selectCls } from '../components/layout/formControls';
