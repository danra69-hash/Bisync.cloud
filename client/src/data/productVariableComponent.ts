/** Variable Component — original component + alternate swaps with optional Addon RRP. */

export type VariableComponentAlternative = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  /** Component COGS unit price (for reference). */
  unitPrice: number;
  quantity: number;
  /** Addon RRP charged when this alternate is chosen (0 = free swap). Same currency as RRP. */
  extraCharge: number;
};

export type VariableComponentSlot = {
  key: string;
  slotLabel: string;
  baseComponentId: string;
  baseComponentName: string;
  baseComponentUom: string;
  baseUnitPrice: number;
  quantity: number;
  alternatives: VariableComponentAlternative[];
};

export type VariableComponentConfig = {
  slots: VariableComponentSlot[];
};

export function newVariableComponentKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function blankVariableComponentSlot(): VariableComponentSlot {
  return {
    key: newVariableComponentKey('slot'),
    slotLabel: '',
    baseComponentId: '',
    baseComponentName: '',
    baseComponentUom: '',
    baseUnitPrice: 0,
    quantity: 0,
    alternatives: [],
  };
}

export function blankVariableComponentConfig(): VariableComponentConfig {
  return { slots: [blankVariableComponentSlot()] };
}

export function blankVariableComponentAlternative(): VariableComponentAlternative {
  return {
    key: newVariableComponentKey('alt'),
    componentId: '',
    componentName: '',
    componentUom: '',
    unitPrice: 0,
    quantity: 0,
    extraCharge: 0,
  };
}

/** Editor always works on a single original + its alternates. */
export function getPrimaryVariableComponentSlot(config: VariableComponentConfig): VariableComponentSlot {
  return config.slots[0] ?? blankVariableComponentSlot();
}

export function setPrimaryVariableComponentSlot(
  slot: VariableComponentSlot,
): VariableComponentConfig {
  return { slots: [slot] };
}

export function serializeVariableComponentOptionsJson(config: VariableComponentConfig): string {
  const slot = getPrimaryVariableComponentSlot(config);
  if (!slot.baseComponentId.trim()) {
    return JSON.stringify({ slots: [] });
  }
  return JSON.stringify({
    slots: [{
      slotLabel: slot.slotLabel || slot.baseComponentName,
      baseComponentId: slot.baseComponentId,
      baseComponentName: slot.baseComponentName,
      baseComponentUom: slot.baseComponentUom,
      baseUnitPrice: slot.baseUnitPrice,
      quantity: slot.quantity,
      alternatives: slot.alternatives
        .filter(a => a.componentId.trim())
        .map(a => ({
          componentId: a.componentId,
          componentName: a.componentName,
          componentUom: a.componentUom,
          unitPrice: a.unitPrice,
          quantity: a.quantity,
          extraCharge: a.extraCharge > 0 ? a.extraCharge : 0,
          addonRrp: a.extraCharge > 0 ? a.extraCharge : 0,
        })),
    }],
  });
}

/** Parse Variable Component JSON, or migrate legacy Variable Product replacement options. */
export function parseVariableComponentOptionsJson(raw?: string | null): VariableComponentConfig {
  const empty = blankVariableComponentConfig();
  if (!raw || !raw.trim() || raw.trim() === '[]' || raw.trim() === '{}') return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const slots = Array.isArray(data.slots) ? data.slots : [];
    const parsedSlots = slots.map((s, i) => {
      const row = s as Record<string, unknown>;
      const alts = Array.isArray(row.alternatives) ? row.alternatives : [];
      return {
        key: newVariableComponentKey(`slot-${i}`),
        slotLabel: String(row.slotLabel ?? row.baseComponentName ?? `Option ${i + 1}`),
        baseComponentId: String(row.baseComponentId ?? ''),
        baseComponentName: String(row.baseComponentName ?? ''),
        baseComponentUom: String(row.baseComponentUom ?? ''),
        baseUnitPrice: Number(row.baseUnitPrice) || 0,
        quantity: Number(row.quantity) || 0,
        alternatives: alts.map((a, j) => {
          const alt = a as Record<string, unknown>;
          const addon = Number(alt.addonRrp ?? alt.extraCharge) || 0;
          return {
            key: newVariableComponentKey(`alt-${i}-${j}`),
            componentId: String(alt.componentId ?? ''),
            componentName: String(alt.componentName ?? ''),
            componentUom: String(alt.componentUom ?? ''),
            unitPrice: Number(alt.unitPrice) || 0,
            quantity: Number(alt.quantity) || Number(row.quantity) || 0,
            extraCharge: Math.max(0, addon),
          };
        }).filter(a => a.componentId),
      };
    }).filter(s => s.baseComponentId);

    if (parsedSlots.length === 0) return empty;
    // Editor is single-original: keep the first configured slot.
    return { slots: [parsedSlots[0]!] };
  } catch {
    return empty;
  }
}

/** True when original + at least one alternate are configured. */
export function hasConfiguredVariableComponentSlots(config: VariableComponentConfig): boolean {
  const slot = getPrimaryVariableComponentSlot(config);
  return Boolean(
    slot.baseComponentId.trim()
    && slot.quantity > 0
    && slot.alternatives.some(a => a.componentId.trim() && a.quantity > 0),
  );
}

export function validateVariableComponentConfig(config: VariableComponentConfig): string | null {
  const slot = getPrimaryVariableComponentSlot(config);
  if (!slot.baseComponentId.trim()) return 'Select the original component.';
  if (!slot.baseComponentUom.trim()) return 'Enter a UOM for the original component.';
  if (!(slot.quantity > 0)) return 'Enter a quantity greater than zero for the original component.';
  const alts = slot.alternatives.filter(a => a.componentId.trim());
  if (alts.length === 0) return 'Add at least one alternate component that can replace the original.';
  for (const alt of alts) {
    if (!alt.componentUom.trim()) return `Enter a UOM for alternate “${alt.componentName || alt.componentId}”.`;
    if (!(alt.quantity > 0)) return `Enter a quantity greater than zero for alternate “${alt.componentName || alt.componentId}”.`;
    if (alt.componentId === slot.baseComponentId) {
      return 'Alternate components must be different from the original.';
    }
  }
  return null;
}

export function variableComponentRecipeCost(config: VariableComponentConfig): number {
  const slot = getPrimaryVariableComponentSlot(config);
  if (!slot.baseComponentId || !(slot.quantity > 0)) return 0;
  return Math.round(slot.quantity * slot.baseUnitPrice * 100) / 100;
}

/** BOM lines derived from the original component for inventory / COGS. */
export function variableComponentToRecipeItems(config: VariableComponentConfig) {
  const slot = getPrimaryVariableComponentSlot(config);
  if (!slot.baseComponentId.trim() || !(slot.quantity > 0)) return [];
  return [{
    componentId: slot.baseComponentId,
    componentName: slot.baseComponentName,
    componentUom: slot.baseComponentUom,
    componentUomPrice: slot.baseUnitPrice,
    quantity: slot.quantity,
  }];
}

export function calcVariableComponentExtraChargeTotal(
  selections: { extraCharge?: number }[],
): number {
  return Math.round(
    selections.reduce((sum, s) => sum + Math.max(0, Number(s.extraCharge) || 0), 0) * 100,
  ) / 100;
}
