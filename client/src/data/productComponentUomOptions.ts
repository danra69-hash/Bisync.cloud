import type { Product } from '../api';
import {
  fromApiUom,
  getComponentUomChoices,
  getConversion,
  resolveDetailConfigForRow,
  type AltUnitEntry,
  type ComponentRow,
} from './componentForm';
import {
  parseYieldAltUnitsJson,
  refreshBatchAdditionalUoms,
  resolveBatchAdditionalEntry,
} from './productBatchUom';
import {
  calcProductCogs,
  formatSubProductPrimaryBatchUnit,
  type ProductLine,
} from './productForm';

export type ProductComponentUomOption = {
  label: string;
  price: number;
};

function subProductBatchCogs(product: Product): number {
  return calcProductCogs(product.totalCost, product.packagingCost ?? 0, {
    isSubProduct: true,
    b2bEnabled: false,
    b2cEnabled: false,
  });
}

function formatAltBatchLabel(qtyText: string, unit: string): string {
  const qtyNum = parseFloat(qtyText);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !unit.trim()) return '';
  const qty = Number.isInteger(qtyNum)
    ? String(qtyNum)
    : String(Number(qtyNum.toFixed(2).replace(/\.?0+$/, '')));
  return `${qty}${unit.trim().toLowerCase()}`;
}

function subProductAltUomLabel(
  entry: AltUnitEntry,
  resolved: ReturnType<typeof resolveBatchAdditionalEntry>,
): string {
  if (resolved.packStyle) {
    return entry.unit;
  }
  return formatAltBatchLabel(resolved.qty || entry.qty, entry.unit);
}

function subProductAltUomPrice(
  batchCogs: number,
  entry: AltUnitEntry,
  resolved: ReturnType<typeof resolveBatchAdditionalEntry>,
): number {
  if (resolved.packStyle) {
    const packs = parseFloat(entry.fromQty) || 0;
    return packs > 0 ? batchCogs / packs : batchCogs;
  }
  // Alt expresses the same batch (e.g. 10each = 1kg), so recipe qty 1 costs one batch.
  return batchCogs;
}

/** UOM choices when attaching a Sub-Product into a Product recipe mix. */
export function subProductComponentUomOptions(product: Product): ProductComponentUomOption[] {
  const batchUom = fromApiUom(product.yieldUom);
  const batchQty = product.yieldQuantity;
  const batchLabel = formatSubProductPrimaryBatchUnit(product);
  const batchCogs = subProductBatchCogs(product);
  const options: ProductComponentUomOption[] = [];

  if (batchLabel !== '—') {
    options.push({ label: batchLabel, price: batchCogs });
  }

  const parsed = parseYieldAltUnitsJson(product.yieldAltUnitsJson).map(entry => ({
    ...entry,
    unit: fromApiUom(entry.unit) || entry.unit,
  }));
  const altEntries = batchUom.trim()
    ? refreshBatchAdditionalUoms(parsed, batchQty, batchUom)
    : parsed;

  // Sub-products expose at most one alternative batch expression in the recipe picker.
  for (const entry of altEntries.slice(0, 1)) {
    const resolved = resolveBatchAdditionalEntry(entry, batchQty, batchUom);
    const label = subProductAltUomLabel(entry, resolved);
    if (!label || options.some(option => option.label === label)) continue;
    options.push({
      label,
      price: subProductAltUomPrice(batchCogs, entry, resolved),
    });
  }

  return options;
}

function priceForComponentUom(
  selectedUnit: string,
  recipeUnit: string,
  recipePrice: number,
  altUnits: AltUnitEntry[],
): number {
  if (selectedUnit === recipeUnit) return recipePrice;

  const alt = altUnits.find(item => item.unit === selectedUnit);
  if (alt) {
    const from = parseFloat(alt.fromQty || '1') || 1;
    const qty = parseFloat(alt.qty || '1') || 1;
    if (qty <= 0) return recipePrice;
    return recipePrice * (qty / from);
  }

  const conv = getConversion(selectedUnit, recipeUnit);
  if (conv !== null) return recipePrice * conv;

  return recipePrice;
}

export function componentComponentUomOptions(component: ComponentRow): ProductComponentUomOption[] {
  const recipeUnit = fromApiUom(component.recipeUOM);
  const basePrice = component.lastPriceRecipe ?? 0;
  const detail = resolveDetailConfigForRow(component);
  const choices = getComponentUomChoices(recipeUnit, detail.altRecipeUnits);

  return choices.map(unit => ({
    label: unit,
    price: priceForComponentUom(unit, recipeUnit, basePrice, detail.altRecipeUnits),
  }));
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
  if (!currentLabel || options.some(option => option.label === currentLabel)) {
    return options;
  }

  return [
    ...options,
    {
      label: currentLabel,
      price: parseFloat(line.componentUomPrice) || 0,
    },
  ];
}
