/** Variable Component — substitutable recipe components with optional POS surcharge. */

export type VariableComponentAlternative = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  /** Component COGS unit price (for reference). */
  unitPrice: number;
  quantity: number;
  /** Extra charge to the customer (0 = free swap). Same currency as RRP. */
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

export function blankVariableComponentConfig(): VariableComponentConfig {
  return { slots: [] };
}

export function newVariableComponentKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function serializeVariableComponentOptionsJson(config: VariableComponentConfig): string {
  return JSON.stringify({
    slots: config.slots.map(s => ({
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
        extraCharge: a.extraCharge > 0 ? a.extraCharge : 0,
      })),
    })),
  });
}

/** Parse Variable Component JSON, or migrate legacy Variable Product replacement options. */
export function parseVariableComponentOptionsJson(raw?: string | null): VariableComponentConfig {
  const empty = blankVariableComponentConfig();
  if (!raw || !raw.trim() || raw.trim() === '[]' || raw.trim() === '{}') return empty;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const slots = Array.isArray(data.slots) ? data.slots : [];
    return {
      slots: slots.map((s, i) => {
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
            return {
              key: newVariableComponentKey(`alt-${i}-${j}`),
              componentId: String(alt.componentId ?? ''),
              componentName: String(alt.componentName ?? ''),
              componentUom: String(alt.componentUom ?? ''),
              unitPrice: Number(alt.unitPrice) || 0,
              quantity: Number(alt.quantity) || Number(row.quantity) || 0,
              extraCharge: Math.max(0, Number(alt.extraCharge) || 0),
            };
          }).filter(a => a.componentId),
        };
      }).filter(s => s.baseComponentId),
    };
  } catch {
    return empty;
  }
}

/** True when config has at least one slot with one or more substitutes. */
export function hasConfiguredVariableComponentSlots(config: VariableComponentConfig): boolean {
  return config.slots.some(s => s.alternatives.length > 0);
}

export function calcVariableComponentExtraChargeTotal(
  selections: { extraCharge?: number }[],
): number {
  return Math.round(
    selections.reduce((sum, s) => sum + Math.max(0, Number(s.extraCharge) || 0), 0) * 100,
  ) / 100;
}
