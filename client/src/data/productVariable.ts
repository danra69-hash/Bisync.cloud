/** Variable Product config — combination packages or component replacements. */

export type VariableMode = 'combination' | 'replacement';

export type VariableCombinationOption = {
  key: string;
  productId: number;
  productCode: string;
  productName: string;
  unitCost: number;
};

export type VariableReplacementAlternative = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  unitPrice: number;
  quantity: number;
};

export type VariableReplacementSlot = {
  key: string;
  slotLabel: string;
  baseComponentId: string;
  baseComponentName: string;
  baseComponentUom: string;
  baseUnitPrice: number;
  quantity: number;
  alternatives: VariableReplacementAlternative[];
};

export type VariableProductConfig = {
  mode: VariableMode;
  choiceQty: number;
  combinationOptions: VariableCombinationOption[];
  replacementSlots: VariableReplacementSlot[];
};

export function blankVariableConfig(mode: VariableMode = 'combination'): VariableProductConfig {
  return {
    mode,
    choiceQty: 1,
    combinationOptions: [],
    replacementSlots: [],
  };
}

export function newOptionKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Min/max COGS for a combination package (qty of cheapest / most expensive options). */
export function calcCombinationMinMaxCost(
  choiceQty: number,
  options: Pick<VariableCombinationOption, 'unitCost'>[],
): { minCost: number; maxCost: number } {
  const costs = options.map(o => o.unitCost).filter(c => Number.isFinite(c) && c >= 0);
  if (choiceQty <= 0 || costs.length === 0) return { minCost: 0, maxCost: 0 };
  const minUnit = Math.min(...costs);
  const maxUnit = Math.max(...costs);
  return {
    minCost: roundMoney(choiceQty * minUnit),
    maxCost: roundMoney(choiceQty * maxUnit),
  };
}

/**
 * Min/max COGS for replacement slots on top of a fixed base recipe cost.
 * Each slot swaps the base component cost for the cheapest / dearest alternative
 * (same quantity). Slots with no alternatives keep the base cost.
 */
export function calcReplacementMinMaxCost(
  baseRecipeCost: number,
  slots: VariableReplacementSlot[],
): { minCost: number; maxCost: number } {
  let min = baseRecipeCost;
  let max = baseRecipeCost;
  for (const slot of slots) {
    const baseLine = roundMoney(slot.quantity * slot.baseUnitPrice);
    const altLineCosts = slot.alternatives
      .map(a => roundMoney(a.quantity * a.unitPrice))
      .filter(c => Number.isFinite(c) && c >= 0);
    if (altLineCosts.length === 0) continue;
    min = min - baseLine + Math.min(...altLineCosts);
    max = max - baseLine + Math.max(...altLineCosts);
  }
  return {
    minCost: roundMoney(Math.max(0, min)),
    maxCost: roundMoney(Math.max(0, max)),
  };
}

export function calcVariableMinMaxCost(
  config: VariableProductConfig,
  baseRecipeCost = 0,
): { minCost: number; maxCost: number } {
  if (config.mode === 'combination') {
    return calcCombinationMinMaxCost(config.choiceQty, config.combinationOptions);
  }
  return calcReplacementMinMaxCost(baseRecipeCost, config.replacementSlots);
}

export function serializeVariableOptionsJson(config: VariableProductConfig): string {
  if (config.mode === 'combination') {
    return JSON.stringify({
      mode: 'combination',
      choiceQty: config.choiceQty,
      options: config.combinationOptions.map(o => ({
        productId: o.productId,
        productCode: o.productCode,
        productName: o.productName,
        unitCost: o.unitCost,
      })),
    });
  }
  return JSON.stringify({
    mode: 'replacement',
    slots: config.replacementSlots.map(s => ({
      slotLabel: s.slotLabel,
      baseComponentId: s.baseComponentId,
      baseComponentName: s.baseComponentName,
      baseComponentUom: s.baseComponentUom,
      baseUnitPrice: s.baseUnitPrice,
      quantity: s.quantity,
      alternatives: s.alternatives.map(a => ({
        componentId: a.componentId,
        componentName: a.componentName,
        componentUom: a.componentUom,
        unitPrice: a.unitPrice,
        quantity: a.quantity,
      })),
    })),
  });
}

export function parseVariableOptionsJson(
  raw?: string | null,
  modeHint?: VariableMode,
): VariableProductConfig {
  const fallback = blankVariableConfig(modeHint ?? 'combination');
  if (!raw || !raw.trim() || raw.trim() === '[]' || raw.trim() === '{}') return fallback;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const mode = data.mode === 'replacement' ? 'replacement' : 'combination';
    if (mode === 'combination') {
      const options = Array.isArray(data.options) ? data.options : [];
      return {
        mode,
        choiceQty: Number(data.choiceQty) > 0 ? Number(data.choiceQty) : 1,
        combinationOptions: options.map((o, i) => {
          const row = o as Record<string, unknown>;
          return {
            key: newOptionKey(`combo-${i}`),
            productId: Number(row.productId) || 0,
            productCode: String(row.productCode ?? ''),
            productName: String(row.productName ?? ''),
            unitCost: Number(row.unitCost) || 0,
          };
        }).filter(o => o.productId > 0),
        replacementSlots: [],
      };
    }
    const slots = Array.isArray(data.slots) ? data.slots : [];
    return {
      mode,
      choiceQty: 1,
      combinationOptions: [],
      replacementSlots: slots.map((s, i) => {
        const row = s as Record<string, unknown>;
        const alts = Array.isArray(row.alternatives) ? row.alternatives : [];
        return {
          key: newOptionKey(`slot-${i}`),
          slotLabel: String(row.slotLabel ?? row.baseComponentName ?? `Option ${i + 1}`),
          baseComponentId: String(row.baseComponentId ?? ''),
          baseComponentName: String(row.baseComponentName ?? ''),
          baseComponentUom: String(row.baseComponentUom ?? ''),
          baseUnitPrice: Number(row.baseUnitPrice) || 0,
          quantity: Number(row.quantity) || 0,
          alternatives: alts.map((a, j) => {
            const alt = a as Record<string, unknown>;
            return {
              key: newOptionKey(`alt-${i}-${j}`),
              componentId: String(alt.componentId ?? ''),
              componentName: String(alt.componentName ?? ''),
              componentUom: String(alt.componentUom ?? ''),
              unitPrice: Number(alt.unitPrice) || 0,
              quantity: Number(alt.quantity) || Number(row.quantity) || 0,
            };
          }).filter(a => a.componentId),
        };
      }).filter(s => s.baseComponentId),
    };
  } catch {
    return fallback;
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
