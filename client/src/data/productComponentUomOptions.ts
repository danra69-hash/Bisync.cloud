import type { Product } from '../api';
import {
  fromApiUom,
  getComponentUomChoices,
  getConversionFactor,
  resolveDetailConfigForRow,
  type AltUnitEntry,
  type ComponentRow,
} from './componentForm';
import { parseYieldAltUnitsJson } from './productBatchUom';
import {
  formatSubProductPrimaryBatchUnit,
  resolveSubProductRecipeUnit,
  type ProductLine,
} from './productForm';
import {
  convertComponentUnitPrice,
  formatBomUnitPrice,
  resolveSystemComponentUnitPrice,
} from './resolveBomComponentPrice';

export type ProductComponentUomOption = {
  label: string;
  price: number;
};

export function uomKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function sameUom(left: string, right: string): boolean {
  const a = fromApiUom(left) || left;
  const b = fromApiUom(right) || right;
  return Boolean(a) && uomKey(a) === uomKey(b);
}

/** True when a stored recipe UOM is a whole-batch label like "2000gr" / "10 each". */
export function isSubProductBatchUomLabel(
  lineUom: string,
  product: { yieldQuantity: number; yieldUom: string },
): boolean {
  const compact = uomKey(lineUom);
  if (!compact) return false;
  const batchLabel = formatSubProductPrimaryBatchUnit(product);
  if (batchLabel !== '—' && uomKey(batchLabel) === compact) return true;
  const yieldQty = product.yieldQuantity > 0 ? product.yieldQuantity : 0;
  if (yieldQty <= 0) return false;
  const qtyText = Number.isInteger(yieldQty)
    ? String(yieldQty)
    : String(Number(yieldQty.toFixed(2).replace(/\.?0+$/, '')));
  const principal = uomKey(fromApiUom(product.yieldUom) || product.yieldUom);
  if (!principal) return false;
  return compact === `${qtyText}${principal}` || compact === `${qtyText}${uomKey(product.yieldUom)}`;
}

/** UOM choices when attaching a Sub-Product into a Product recipe mix. */
export function subProductComponentUomOptions(product: Product): ProductComponentUomOption[] {
  const { uom: principalUom, unitCost } = resolveSubProductRecipeUnit(product);
  if (!principalUom.trim()) return [];

  const options: ProductComponentUomOption[] = [
    { label: principalUom, price: unitCost },
  ];

  // Optional alternate yield UOMs at converted per-unit prices (never whole-batch labels).
  const altUnits = parseYieldAltUnitsJson(product.yieldAltUnitsJson)
    .map(entry => fromApiUom(entry.unit) || entry.unit.trim())
    .filter(Boolean);
  for (const altUnit of altUnits.slice(0, 3)) {
    if (options.some(option => sameUom(option.label, altUnit))) continue;
    const factor = getConversionFactor(altUnit, principalUom);
    if (factor == null) continue;
    options.push({ label: altUnit, price: unitCost * factor });
  }

  return options;
}

function priceForComponentUom(
  selectedUnit: string,
  recipeUnit: string,
  recipePrice: number,
  altUnits: AltUnitEntry[],
): number {
  if (!(recipePrice > 0)) return 0;
  const selected = fromApiUom(selectedUnit) || selectedUnit;
  const recipe = fromApiUom(recipeUnit) || recipeUnit;
  if (!selected || !recipe) return 0;
  if (sameUom(selected, recipe)) return recipePrice;

  const alt = altUnits.find(item => sameUom(item.unit, selected));
  if (alt) {
    const from = parseFloat(alt.fromQty || '1') || 1;
    const qty = parseFloat(alt.qty || '1') || 1;
    if (qty <= 0 || from <= 0) return 0;
    return recipePrice * (qty / from);
  }

  const conv = getConversionFactor(selected, recipe);
  if (conv !== null) return recipePrice * conv;

  return 0;
}

function priceForComponentOption(component: ComponentRow, selectedUnit: string): number {
  const systemPrice = resolveSystemComponentUnitPrice(component, selectedUnit);
  if (systemPrice !== null && systemPrice > 0) return systemPrice;

  const recipeUnit = fromApiUom(component.recipeUOM);
  const basePrice = component.lastPriceRecipe ?? 0;
  if (!(basePrice > 0) || !recipeUnit) return 0;

  const detail = resolveDetailConfigForRow(component);
  return priceForComponentUom(selectedUnit, recipeUnit, basePrice, detail.altRecipeUnits);
}

export function componentComponentUomOptions(component: ComponentRow): ProductComponentUomOption[] {
  const recipeUnit = fromApiUom(component.recipeUOM);
  const detail = resolveDetailConfigForRow(component);
  const choices = getComponentUomChoices(recipeUnit, detail.altRecipeUnits)
    .map(unit => fromApiUom(unit) || unit)
    .filter(Boolean);

  const options: ProductComponentUomOption[] = [];
  for (const unit of choices) {
    if (options.some(option => sameUom(option.label, unit))) continue;
    options.push({
      label: unit,
      price: priceForComponentOption(component, unit),
    });
  }

  return options;
}

export function findSubProductForLine(line: ProductLine, subProducts: Product[]): Product | null {
  if (line.sourceProductId) {
    const byId = subProducts.find(product => product.id === line.sourceProductId && product.isSubProduct);
    if (byId) return byId;
  }

  const componentKey = line.componentId.trim().toLowerCase();
  if (!componentKey) return null;

  return subProducts.find(product =>
    product.isSubProduct
    && product.productId.trim().toLowerCase() === componentKey,
  ) ?? null;
}

export function isSubProductLine(line: ProductLine, subProducts: Product[]): boolean {
  return findSubProductForLine(line, subProducts) !== null;
}

/** Remount legacy whole-batch UOM/price onto principal UOM + unit COGS. */
export function normalizeSubProductRecipeLine(
  line: ProductLine,
  subProduct: Product,
): ProductLine {
  const { uom, unitCost } = resolveSubProductRecipeUnit(subProduct);
  if (!uom) return line;

  const needsRemount = !line.componentUom.trim()
    || isSubProductBatchUomLabel(line.componentUom, subProduct)
    || uomKey(line.componentUom) === uomKey(uom)
    || uomKey(line.componentUom) === uomKey(subProduct.yieldUom);

  if (!needsRemount) return line;

  const nextPrice = unitCost > 0 ? String(unitCost) : line.componentUomPrice;
  if (
    line.componentUom === uom
    && line.componentUomPrice === nextPrice
  ) {
    return line;
  }

  return {
    ...line,
    componentUom: uom,
    componentUomPrice: nextPrice,
  };
}

export function resolveProductLineUomOptions(
  line: ProductLine,
  components: ComponentRow[],
  subProducts: Product[] = [],
): ProductComponentUomOption[] {
  if (!line.componentId.trim() && !line.sourceProductId) return [];

  const subProduct = findSubProductForLine(line, subProducts);
  if (subProduct) return subProductComponentUomOptions(subProduct);

  const component = components.find(item => item.componentId === line.componentId);
  if (component) return componentComponentUomOptions(component);

  return [];
}

export function withCurrentProductLineUomOption(
  options: ProductComponentUomOption[],
  line: ProductLine,
): ProductComponentUomOption[] {
  const currentLabel = line.componentUom.trim();
  if (!currentLabel) return options;

  const normalizedCurrent = fromApiUom(currentLabel) || currentLabel;
  if (options.some(option => sameUom(option.label, normalizedCurrent) || sameUom(option.label, currentLabel))) {
    return options;
  }

  // Do not keep legacy whole-batch labels (e.g. 2000gr) in the picker once principal UOM exists.
  if (options.length > 0 && /^\d+(\.\d+)?[a-z]+$/i.test(currentLabel.replace(/\s+/g, ''))) {
    return options;
  }

  return [
    ...options,
    {
      label: normalizedCurrent,
      price: parseFloat(line.componentUomPrice) || 0,
    },
  ];
}

/** Resolve the select value so API/UI UOM aliases (g/Gr) still match an option. */
export function resolveSelectedUomOptionLabel(
  options: ProductComponentUomOption[],
  lineUom: string,
): string {
  const current = lineUom.trim();
  if (!current) return '';
  if (options.some(option => option.label === current)) return current;
  const normalized = fromApiUom(current) || current;
  const match = options.find(option => sameUom(option.label, normalized) || sameUom(option.label, current));
  return match?.label ?? current;
}

/**
 * Auto-fill Smart component UOM price when the line UOM changes.
 * Prefers live BOM estimate, then converts the current line price, then the option catalog price.
 */
export function resolveAutomatedComponentUomPrice(options: {
  selected: ProductComponentUomOption;
  component?: ComponentRow | null;
  lineUom: string;
  lineUomPrice: string;
  estimatedPrice?: string;
}): string {
  const { selected, component, lineUom, lineUomPrice, estimatedPrice = '' } = options;
  if (estimatedPrice.trim()) return estimatedPrice.trim();

  if (component && lineUom.trim()) {
    const currentPrice = parseFloat(lineUomPrice);
    if (currentPrice > 0) {
      const converted = convertComponentUnitPrice(currentPrice, lineUom, selected.label, component);
      if (converted !== null && converted > 0) {
        return formatBomUnitPrice(converted);
      }
    }
  }

  if (selected.price > 0) return formatBomUnitPrice(selected.price);
  return '';
}
