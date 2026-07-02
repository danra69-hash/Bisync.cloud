import { fromApiUom } from './componentForm';
import type { ComponentRow } from './componentForm';

export type ProductKind = 'product' | 'subproduct';

export type ProductLine = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  componentUomPrice: string;
  quantity: string;
};

export function buildComponentIdPrefix(name: string): string {
  const alpha = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return alpha.slice(0, 6) || 'NEW';
}

export function generateProductId(
  name: string,
  kind: ProductKind,
  existingIds: string[],
): string {
  const prefix = kind === 'subproduct' ? 'SUB' : 'PRD';
  const baseId = `${prefix}-${buildComponentIdPrefix(name)}`;
  for (let seq = 1; seq <= 999; seq++) {
    const candidate = `${baseId}-${String(seq).padStart(3, '0')}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${baseId}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function resolveComponentUomPrice(component: ComponentRow): {
  uom: string;
  price: number;
} {
  const uom = fromApiUom(component.recipeUOM);
  return {
    uom,
    price: component.lastPriceRecipe ?? 0,
  };
}

export function calcLineSubtotal(quantity: string, unitPrice: string): number {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  return qty * price;
}

export function calcTotalCost(lines: ProductLine[]): number {
  return lines.reduce(
    (sum, line) => sum + calcLineSubtotal(line.quantity, line.componentUomPrice),
    0,
  );
}

export function isProductLineFilled(line: ProductLine): boolean {
  return Boolean(line.componentId.trim()) && (parseFloat(line.quantity) || 0) > 0;
}

export function blankProductLine(): ProductLine {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: '',
    componentName: '',
    componentUom: '',
    componentUomPrice: '',
    quantity: '1',
  };
}

export function productLineFromComponent(component: ComponentRow): ProductLine {
  const { uom, price } = resolveComponentUomPrice(component);
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: component.componentId,
    componentName: component.name,
    componentUom: uom,
    componentUomPrice: price > 0 ? String(price) : '',
    quantity: '1',
  };
}

export function filterComponentsForPicker(
  components: ComponentRow[],
  query: string,
): ComponentRow[] {
  const normalized = query.trim().toLowerCase();
  const active = components.filter(c => c.active);

  if (!normalized) {
    return [...active].sort((a, b) => a.name.localeCompare(b.name));
  }

  const scored = active
    .map(component => {
      const name = component.name.toLowerCase();
      const id = component.componentId.toLowerCase();
      let score = 0;
      if (name === normalized || id === normalized) score = 100;
      else if (name.startsWith(normalized) || id.startsWith(normalized)) score = 80;
      else if (name.includes(normalized) || id.includes(normalized)) score = 60;
      else return null;
      return { component, score };
    })
    .filter((row): row is { component: ComponentRow; score: number } => row !== null);

  return scored
    .sort((a, b) => b.score - a.score || a.component.name.localeCompare(b.component.name))
    .map(row => row.component);
}
