export const RECIPE_UNITS = ['Gr', 'Kg', 'Ml', 'Ltr', 'Each', 'Slice', 'Tin', 'Oz', 'Lb'];
export const STORAGE_OPTIONS = ['Chiller', 'Dry Store', 'Freezer', 'Wine Cellar', 'Storeroom', 'Office', 'Warehouse', 'Bar', 'Prep Kitchen'];

export const UNIT_CONV: Record<string, Record<string, number>> = {
  Gr: { Kg: 0.001, Oz: 0.035274, Lb: 0.002205 },
  Kg: { Gr: 1000, Oz: 35.274, Lb: 2.20462 },
  Ml: { Ltr: 0.001 },
  Ltr: { Ml: 1000 },
  Oz: { Gr: 28.3495, Kg: 0.0283495, Lb: 0.0625 },
  Lb: { Gr: 453.592, Kg: 0.453592, Oz: 16 },
};

export function getConversion(from: string, to: string): number | null {
  if (from === to) return 1;
  return UNIT_CONV[from]?.[to] ?? null;
}

export function toApiUom(unit: string): string {
  const map: Record<string, string> = {
    Gr: 'g', Kg: 'kg', Ml: 'ml', Ltr: 'L', Each: 'pcs', Slice: 'slice', Tin: 'tin', Oz: 'oz', Lb: 'lb',
  };
  return map[unit] ?? unit.toLowerCase();
}

export function fromApiUom(unit: string): string {
  const map: Record<string, string> = {
    g: 'Gr', kg: 'Kg', ml: 'Ml', L: 'Ltr', pcs: 'Each', slice: 'Slice', tin: 'Tin', oz: 'Oz', lb: 'Lb', btl: 'Each', can: 'Each', box: 'Each', set: 'Each',
  };
  return map[unit] ?? unit;
}

export type AltUnitEntry = { qty: string; unit: string };

export type ComponentForm = {
  name: string;
  componentId: string;
  category: string;
  group: string;
  storages: string[];
  active: boolean;
  recipeUnit: string;
  altRecipeUnits: AltUnitEntry[];
  altInventoryUnits: AltUnitEntry[];
  vendor: string;
  vendorProduct: string;
  deliveryUnit: string;
  deliveryUnitPrice: string;
  convertToRecipeQty: string;
  lossYield: string;
};

export type ComponentRow = {
  id?: number;
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
  attachedProducts: number;
  attachedVendors: number;
  active: boolean;
  locations: string[];
};

export function toForm(row: ComponentRow): ComponentForm {
  const recipeUnit = fromApiUom(row.recipeUOM);
  const deliveryUnit = fromApiUom(row.inventoryUOM);
  return {
    name: row.name,
    componentId: `CMP-${row.name.replace(/\s+/g, '').toUpperCase().slice(0, 6)}-001`,
    category: row.category,
    group: row.group,
    storages: [...row.storage],
    active: row.active,
    recipeUnit,
    altRecipeUnits: [],
    altInventoryUnits: [{
      qty: String(row.inventoryUOM !== row.recipeUOM ? getConversion(recipeUnit, deliveryUnit) ?? '' : ''),
      unit: deliveryUnit,
    }],
    vendor: '',
    vendorProduct: '',
    deliveryUnit,
    deliveryUnitPrice: String(row.lastPriceInventory),
    convertToRecipeQty: String(getConversion(deliveryUnit, recipeUnit) ?? ''),
    lossYield: '0',
  };
}

export const blankComponentRow: ComponentRow = {
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
  attachedProducts: 0,
  attachedVendors: 0,
  active: true,
  locations: ['all'],
};

export const inputCls = 'bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full';
export const selectCls = `${inputCls} cursor-pointer`;
