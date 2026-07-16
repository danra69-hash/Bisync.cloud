const API_UOM_TO_DISPLAY: Record<string, string> = {
  mg: 'Mg', g: 'Gr', kg: 'Kg', t: 'Tonne',
  ml: 'Ml', cl: 'Cl', L: 'Ltr',
  pcs: 'Each', pack: 'Pack', punnet: 'Punnet', bunch: 'Bunch', tray: 'Tray', case: 'Case', btl: 'Bottle', can: 'Can', tin: 'Tin', slice: 'Slice',
  oz: 'Oz', lb: 'Lb', 'fl oz': 'FlOz', gal: 'Gal', box: 'Case', set: 'Each',
};

const UNIT_CONV: Record<string, Record<string, number>> = {
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

function fromApiUom(unit: string): string {
  return API_UOM_TO_DISPLAY[unit] ?? unit;
}

function getConversionFactor(from: string, to: string): number | null {
  if (from === to) return 1;
  const direct = UNIT_CONV[from]?.[to] ?? null;
  if (direct !== null) return direct;
  const inverse = UNIT_CONV[to]?.[from] ?? null;
  if (inverse !== null && inverse !== 0) return 1 / inverse;
  return null;
}

export const SPLIT_USE_UOM_OPTIONS = [
  'Mg', 'Gr', 'Kg', 'Tonne',
  'Ml', 'Cl', 'Ltr',
  'Each', 'Pack', 'Punnet', 'Bunch', 'Tray', 'Case', 'Bottle', 'Can', 'Tin', 'Slice',
  'Oz', 'Lb', 'FlOz', 'Gal',
] as const;

export type SplitUseLine = {
  key: string;
  name: string;
  qty: string;
  inventoryUom: string;
  valueAssigned: string;
  valueAssignedPct: string;
  noValue: boolean;
  isWaste: boolean;
  childComponentId?: string;
};

export type ComponentSplitUseConfig = {
  enabled: boolean;
  componentQty: string;
  qtyBasis: 'inventory' | 'recipe';
  lines: SplitUseLine[];
};

export const EMPTY_SPLIT_USE_CONFIG: ComponentSplitUseConfig = {
  enabled: false,
  componentQty: '1',
  qtyBasis: 'inventory',
  lines: [],
};

export function createSplitUseLine(partial: Partial<SplitUseLine> = {}): SplitUseLine {
  return {
    key: partial.key ?? `split-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name ?? '',
    qty: partial.qty ?? '',
    inventoryUom: partial.inventoryUom ?? 'Gr',
    valueAssigned: partial.valueAssigned ?? '',
    valueAssignedPct: partial.valueAssignedPct ?? partial.valueAssigned ?? '',
    noValue: partial.noValue ?? false,
    isWaste: partial.isWaste ?? false,
    childComponentId: partial.childComponentId ?? '',
  };
}

export function parseSplitUseConfig(raw: unknown): ComponentSplitUseConfig {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SPLIT_USE_CONFIG };
  const parsed = raw as Record<string, unknown>;
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines.map((line, index) => {
        const row = line as Record<string, unknown>;
        return createSplitUseLine({
          key: String(row.key ?? row.Key ?? `split-${index}`),
          name: String(row.name ?? row.Name ?? ''),
          qty: String(row.qty ?? row.Qty ?? ''),
          inventoryUom: fromApiUom(String(row.inventoryUom ?? row.InventoryUom ?? 'Gr')),
          valueAssigned: String(row.valueAssignedPct ?? row.ValueAssignedPct ?? row.valueAssigned ?? row.ValueAssigned ?? ''),
          valueAssignedPct: String(row.valueAssignedPct ?? row.ValueAssignedPct ?? row.valueAssigned ?? row.ValueAssigned ?? ''),
          noValue: Boolean(row.noValue ?? row.NoValue),
          isWaste: Boolean(row.isWaste ?? row.IsWaste),
          childComponentId: String(row.childComponentId ?? row.ChildComponentId ?? ''),
        });
      })
    : [];
  return {
    enabled: Boolean(parsed.enabled ?? parsed.Enabled),
    componentQty: String(parsed.componentQty ?? parsed.ComponentQty ?? '1'),
    qtyBasis: parsed.qtyBasis === 'recipe' || parsed.QtyBasis === 'recipe' ? 'recipe' : 'inventory',
    lines,
  };
}

export function convertQtyBetweenUnits(qty: number, fromUom: string, toUom: string): number | null {
  if (!Number.isFinite(qty)) return null;
  if (fromUom === toUom) return qty;
  const factor = getConversionFactor(fromUom, toUom);
  if (factor === null) return null;
  return qty * factor;
}

export function resolveSplitUseBasisUom(
  basis: 'inventory' | 'recipe',
  inventoryUom: string,
  recipeUom: string,
): string {
  return basis === 'recipe' ? recipeUom : inventoryUom;
}

export function lineQtyInBasis(
  line: SplitUseLine,
  basisUom: string,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): number | null {
  const qty = parseFloat(line.qty);
  if (!Number.isFinite(qty) || qty < 0) return null;
  const lineUom = line.inventoryUom.trim();
  if (!lineUom) return null;

  const direct = convertQtyBetweenUnits(qty, lineUom, basisUom);
  if (direct !== null) return direct;

  if (basisUom === recipeUom && lineUom === inventoryUom) {
    const from = parseFloat(convertFromInventoryQty || '1') || 1;
    const to = parseFloat(convertToRecipeQty || '1') || 1;
    if (from <= 0) return null;
    return (qty / from) * to;
  }
  if (basisUom === inventoryUom && lineUom === recipeUom) {
    const from = parseFloat(convertFromInventoryQty || '1') || 1;
    const to = parseFloat(convertToRecipeQty || '1') || 1;
    if (to <= 0) return null;
    return (qty / to) * from;
  }
  return null;
}

export function sumSplitUseLineQtyInBasis(
  lines: SplitUseLine[],
  basisUom: string,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): { total: number | null; unresolved: boolean } {
  let total = 0;
  let unresolved = false;
  for (const line of lines) {
    if (!line.name.trim() && !line.qty.trim()) continue;
    const converted = lineQtyInBasis(
      line,
      basisUom,
      inventoryUom,
      recipeUom,
      convertFromInventoryQty,
      convertToRecipeQty,
    );
    if (converted === null) {
      unresolved = true;
      continue;
    }
    total += converted;
  }
  return { total: unresolved ? null : total, unresolved };
}

export function validateSplitUseConfig(
  config: ComponentSplitUseConfig,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): string | null {
  if (!config.enabled) return null;
  const componentQty = parseFloat(config.componentQty);
  if (!Number.isFinite(componentQty) || componentQty <= 0) {
    return 'Enter a valid component quantity for split use.';
  }
  const activeLines = config.lines.filter(line => line.name.trim() || line.qty.trim());
  if (activeLines.length === 0) {
    return 'Add at least one sub-component row for split use.';
  }
  if (activeLines.some(line => !line.name.trim())) {
    return 'Each sub-component needs a name.';
  }
  if (activeLines.some(line => !line.qty.trim() || !(parseFloat(line.qty) > 0))) {
    return 'Each sub-component needs a quantity greater than zero.';
  }
  const basisUom = resolveSplitUseBasisUom(config.qtyBasis, inventoryUom, recipeUom);
  const { total, unresolved } = sumSplitUseLineQtyInBasis(
    activeLines,
    basisUom,
    inventoryUom,
    recipeUom,
    convertFromInventoryQty,
    convertToRecipeQty,
  );
  if (unresolved || total === null) {
    return 'Sub-component quantities use UOMs that cannot be totalled — align units or add conversion.';
  }
  if (total >= componentQty - 0.0001) {
    return `Split outputs (${total} ${basisUom}) must leave a positive nett component quantity.`;
  }
  if (activeLines.some(line => {
    const pct = parseFloat(line.valueAssignedPct);
    return !Number.isFinite(pct) || pct < 0 || pct > 100;
  })) {
    return 'Each Value Assigned % must be between 0 and 100.';
  }
  const allocatedBasis = activeLines.reduce((sum, line) => {
    const qty = lineQtyInBasis(
      line,
      basisUom,
      inventoryUom,
      recipeUom,
      convertFromInventoryQty,
      convertToRecipeQty,
    ) ?? 0;
    return sum + qty * (parseFloat(line.valueAssignedPct) || 0) / 100;
  }, 0);
  if (allocatedBasis > componentQty + 0.0001) {
    return 'Split Use assigned value exceeds 100% of the component value.';
  }
  return null;
}

export function calcSplitUseNoValueUnitCost(
  componentPrice: number,
  componentQty: number,
  noValueQtyTotal: number,
): number {
  const denominator = componentQty - noValueQtyTotal;
  if (componentPrice <= 0 || denominator <= 0) return 0;
  return componentPrice / denominator;
}

/** Component Nett qty in basis UOM (componentQty − sum of output qtys). */
export function calcSplitUseNettQty(
  config: ComponentSplitUseConfig,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): number | null {
  if (!config.enabled) return null;
  const componentQty = parseFloat(config.componentQty);
  if (!Number.isFinite(componentQty) || componentQty <= 0) return null;
  const basisUom = resolveSplitUseBasisUom(config.qtyBasis, inventoryUom, recipeUom);
  const { total, unresolved } = sumSplitUseLineQtyInBasis(
    config.lines,
    basisUom,
    inventoryUom,
    recipeUom,
    convertFromInventoryQty,
    convertToRecipeQty,
  );
  if (unresolved || total === null) return null;
  const nett = componentQty - total;
  return nett > 0 ? nett : null;
}

/**
 * Nett recipe unit cost for Split Use:
 * (purchase value − value assigned to outputs) ÷ Component Nett qty.
 * When outputs take 0% value, this equals grossUnitCost / keepFraction
 * (same relationship as Yield Loss nett cost).
 */
export function calcSplitUseNettUnitCost(
  purchaseValue: number,
  config: ComponentSplitUseConfig,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): number {
  if (!config.enabled || purchaseValue <= 0) return 0;
  const componentQty = parseFloat(config.componentQty);
  if (!Number.isFinite(componentQty) || componentQty <= 0) return 0;

  const basisUom = resolveSplitUseBasisUom(config.qtyBasis, inventoryUom, recipeUom);
  let allocatedValue = 0;
  let outputBasisQty = 0;
  for (const line of config.lines) {
    if (!line.name.trim() && !line.qty.trim()) continue;
    const lineQty = lineQtyInBasis(
      line,
      basisUom,
      inventoryUom,
      recipeUom,
      convertFromInventoryQty,
      convertToRecipeQty,
    );
    if (lineQty === null) continue;
    outputBasisQty += lineQty;
    const pct = parseFloat(line.valueAssignedPct) || 0;
    allocatedValue += purchaseValue * (lineQty / componentQty) * (pct / 100);
  }

  const nettQty = componentQty - outputBasisQty;
  if (nettQty <= 0) return 0;
  const nettValue = Math.max(0, purchaseValue - allocatedValue);
  return nettValue / nettQty;
}

export function calcSplitUseLineAssignedValue(
  line: SplitUseLine,
  config: ComponentSplitUseConfig,
  componentPrice: number,
  inventoryUom: string,
  recipeUom: string,
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
  principalQty: number,
): number | null {
  const basisUom = resolveSplitUseBasisUom(config.qtyBasis, inventoryUom, recipeUom);
  const componentQty = parseFloat(config.componentQty) || principalQty || 0;
  const lineQty = lineQtyInBasis(
    line,
    basisUom,
    inventoryUom,
    recipeUom,
    convertFromInventoryQty,
    convertToRecipeQty,
  );
  if (lineQty === null) return null;

  const pct = parseFloat(line.valueAssignedPct);
  if (!Number.isFinite(pct)) return null;
  const unitCost = componentQty > 0 ? componentPrice / componentQty : 0;
  return lineQty * unitCost * pct / 100;
}

export function calcSplitUseBreakdown(
  config: ComponentSplitUseConfig,
  unitsToSplit: number,
): Array<SplitUseLine & { resultQty: number; resultUom: string }> {
  const componentQty = parseFloat(config.componentQty) || 1;
  if (componentQty <= 0 || unitsToSplit <= 0) return [];
  const factor = unitsToSplit / componentQty;
  return config.lines
    .filter(line => line.name.trim() && parseFloat(line.qty) > 0)
    .map(line => ({
      ...line,
      resultQty: (parseFloat(line.qty) || 0) * factor,
      resultUom: line.inventoryUom,
    }));
}

export function calcVirtualSubComponentStock(
  config: ComponentSplitUseConfig,
  onHandWholeQty: number,
): Array<SplitUseLine & { availableQty: number; availableUom: string }> {
  return calcSplitUseBreakdown(config, onHandWholeQty).map(line => ({
    ...line,
    availableQty: line.resultQty,
    availableUom: line.resultUom,
  }));
}