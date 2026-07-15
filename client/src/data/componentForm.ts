import {
  EMPTY_SPLIT_USE_CONFIG,
  parseSplitUseConfig,
  type ComponentSplitUseConfig,
} from './componentSplitUse';

export type { ComponentSplitUseConfig, SplitUseLine } from './componentSplitUse';

export const RECIPE_UNITS = [
  'Mg', 'Gr', 'Kg', 'Tonne',
  'Ml', 'Cl', 'Ltr',
  'Each', 'Pack', 'Punnet', 'Bunch', 'Tray', 'Case', 'Bottle', 'Can', 'Tin', 'Slice',
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

export function getConversionFactor(from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = getConversion(from, to);
  if (direct !== null) return direct;
  const inverse = getConversion(to, from);
  if (inverse !== null && inverse !== 0) return 1 / inverse;
  return null;
}

export function isConversionQtyAutoFilled(
  fromUnit: string,
  toUnit: string,
  qty: string,
  fromQty: string,
): boolean {
  const conv = getConversion(fromUnit, toUnit);
  if (conv === null) return false;
  const from = parseFloat(fromQty || '1') || 1;
  const expected = conv * from;
  const parsed = parseFloat(qty);
  if (!Number.isFinite(parsed)) return false;
  return Math.abs(parsed - expected) < 0.0001;
}

export function resolveInventoryToRecipeQty(
  inventoryUnit: string,
  recipeUnit: string,
  fromQty: string,
  currentQty?: string,
): { fromQty: string; qty: string } {
  if (inventoryUnit === recipeUnit) return { fromQty: '1', qty: '1' };
  const from = parseFloat(fromQty || '1') || 1;
  const conv = getConversion(inventoryUnit, recipeUnit);
  return {
    fromQty: fromQty || '1',
    qty: conv !== null ? String(conv * from) : (currentQty?.trim() || ''),
  };
}

function resolveInventoryToRecipeQtyOnLoad(
  inventoryUnit: string,
  recipeUnit: string,
  fromQty: string,
  storedQty?: string,
): string {
  if (inventoryUnit === recipeUnit) return storedQty?.trim() || '1';
  const from = parseFloat(fromQty || '1') || 1;
  const conv = getConversion(inventoryUnit, recipeUnit);
  if (conv === null) return storedQty?.trim() || '';
  const expected = String(conv * from);
  const stored = storedQty?.trim();
  if (!stored || stored === '1') return expected;
  if (isConversionQtyAutoFilled(inventoryUnit, recipeUnit, stored, fromQty)) return stored;
  return stored;
}

export function toApiUom(unit: string): string {
  const map: Record<string, string> = {
    Mg: 'mg', Gr: 'g', Kg: 'kg', Tonne: 't',
    Ml: 'ml', Cl: 'cl', Ltr: 'L',
    Each: 'pcs', Punnet: 'punnet', Bunch: 'bunch', Tray: 'tray', Case: 'case', Bottle: 'btl', Can: 'can', Tin: 'tin', Slice: 'slice',
    Pack: 'pack',
    Oz: 'oz', Lb: 'lb', FlOz: 'fl oz', Gal: 'gal',
  };
  return map[unit] ?? unit.toLowerCase();
}

export function fromApiUom(unit: string): string {
  const map: Record<string, string> = {
    mg: 'Mg', g: 'Gr', kg: 'Kg', t: 'Tonne',
    ml: 'Ml', cl: 'Cl', L: 'Ltr',
    pcs: 'Each', pack: 'Pack', punnet: 'Punnet', bunch: 'Bunch', tray: 'Tray', case: 'Case', btl: 'Bottle', can: 'Can', tin: 'Tin', slice: 'Slice',
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
  splitUse?: ComponentSplitUseConfig;
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
  splitUse: { ...EMPTY_SPLIT_USE_CONFIG },
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
    splitUse: form.splitUse,
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
      splitUse: parseSplitUseConfig(parsed.splitUse),
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
  dailyUsage: string;
  orderFreqDays: string;
  splitUse: ComponentSplitUseConfig;
};

export function normalizeComponentName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim();
}

export function normalizeComponentNameKey(name: string): string {
  return normalizeComponentName(name).toLowerCase();
}

export function isValidComponentName(name: string): boolean {
  const normalized = normalizeComponentName(name);
  if (!normalized) return false;
  if (normalized !== name.trim()) return false;
  return /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/.test(normalized);
}

export function componentNameValidationMessage(name: string): string | null {
  if (!name.trim()) return 'Component name is required.';
  if (!isValidComponentName(name)) {
    return 'Component name allows only letters, numbers, a single space between words, and - (dash).';
  }
  return null;
}

export function buildComponentIdPrefix(name: string): string {
  const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alpha.slice(0, 6) || 'NEW';
}

/** Preview-only ID. Final ID is always assigned by the API from the company code. */
export function generateComponentId(companyCode: string | null | undefined, existingIds: string[]): string {
  const code = (companyCode ?? 'XXXX').replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(4, 'X').slice(0, 4);
  const used = new Set(
    existingIds
      .filter(id => id.toUpperCase().startsWith(`${code}-`) && id.length === 9)
      .map(id => id.slice(-4).toUpperCase()),
  );
  for (let letter = 0; letter < 26; letter++) {
    const L = String.fromCharCode(65 + letter);
    for (let n = 1; n <= 999; n++) {
      const suffix = `${L}${String(n).padStart(3, '0')}`;
      if (!used.has(suffix)) return `${code}-${suffix}`;
    }
  }
  return `${code}-Z${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

export function isComponentNameTaken(
  name: string,
  existing: { id?: number; name: string }[],
  excludeId?: number,
): boolean {
  const normalized = normalizeComponentNameKey(name);
  if (!normalized) return false;
  return existing.some(c => c.id !== excludeId && normalizeComponentNameKey(c.name) === normalized);
}

export type ComponentRow = {
  id?: number;
  companyId?: number | null;
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
  createdAt?: string;
  updatedAt?: string;
};

export function toForm(
  row: ComponentRow,
  existingComponentIds: string[] = [],
  companyCode?: string | null,
): ComponentForm {
  const recipeUnit = fromApiUom(row.recipeUOM);
  const inventoryUnit = fromApiUom(row.inventoryUOM);
  const componentId = row.componentId
    || generateComponentId(companyCode, existingComponentIds);
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
    convertToRecipeQty: resolveInventoryToRecipeQtyOnLoad(
      inventoryUnit,
      recipeUnit,
      detail.convertFromInventoryQty || '1',
      detail.convertToRecipeQty,
    ),
    lossYield: '0',
    dailyUsage: row.dailyUsage > 0 ? String(row.dailyUsage) : '',
    orderFreqDays: String(row.orderFreqDays > 0 ? row.orderFreqDays : 7),
    splitUse: detail.splitUse ? { ...detail.splitUse, lines: detail.splitUse.lines.map(line => ({ ...line })) } : { ...EMPTY_SPLIT_USE_CONFIG },
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
