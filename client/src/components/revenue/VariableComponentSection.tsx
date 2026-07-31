import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ComponentRow } from '../../data/componentForm';
import { inputCls } from '../../data/countries';
import {
  newVariableComponentKey,
  type VariableComponentConfig,
} from '../../data/productVariableComponent';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type RecipeLine = {
  key: string;
  componentId: string;
  componentName: string;
  componentUom: string;
  componentUomPrice: string;
  quantity: string;
};

type Props = {
  config: VariableComponentConfig;
  onChange: (next: VariableComponentConfig) => void;
  recipeLines: RecipeLine[];
  ingredients: ComponentRow[];
  disabled?: boolean;
};

const labelCls = 'text-xs font-sans text-muted-foreground uppercase tracking-wider';

export function VariableComponentSection({
  config,
  onChange,
  recipeLines,
  ingredients,
  disabled,
}: Props) {
  const { currency, symbol } = useCountryFormatters();

  const syncSlotsFromRecipe = () => {
    const nextSlots = recipeLines
      .filter(line => line.componentId.trim())
      .map(line => {
        const existing = config.slots.find(s => s.baseComponentId === line.componentId);
        return {
          key: existing?.key ?? newVariableComponentKey('slot'),
          slotLabel: line.componentName || line.componentId,
          baseComponentId: line.componentId,
          baseComponentName: line.componentName,
          baseComponentUom: line.componentUom,
          baseUnitPrice: parseFloat(line.componentUomPrice) || 0,
          quantity: parseFloat(line.quantity) || 0,
          alternatives: existing?.alternatives ?? [],
        };
      });
    onChange({ slots: nextSlots });
  };

  const addAlternative = (slotKey: string, componentId: string) => {
    const ingredient = ingredients.find(i => i.componentId === componentId);
    if (!ingredient) return;
    onChange({
      slots: config.slots.map(slot => {
        if (slot.key !== slotKey) return slot;
        if (slot.alternatives.some(a => a.componentId === componentId)) return slot;
        return {
          ...slot,
          alternatives: [
            ...slot.alternatives,
            {
              key: newVariableComponentKey('alt'),
              componentId: ingredient.componentId,
              componentName: ingredient.name,
              componentUom: slot.baseComponentUom || ingredient.recipeUOM,
              unitPrice: ingredient.lastPriceRecipe ?? 0,
              quantity: slot.quantity,
              extraCharge: 0,
            },
          ],
        };
      }),
    });
  };

  const removeAlternative = (slotKey: string, altKey: string) => {
    onChange({
      slots: config.slots.map(slot =>
        slot.key === slotKey
          ? { ...slot, alternatives: slot.alternatives.filter(a => a.key !== altKey) }
          : slot,
      ),
    });
  };

  const setExtraCharge = (slotKey: string, altKey: string, value: string) => {
    const parsed = Math.max(0, parseFloat(value) || 0);
    onChange({
      slots: config.slots.map(slot =>
        slot.key === slotKey
          ? {
              ...slot,
              alternatives: slot.alternatives.map(a =>
                a.key === altKey ? { ...a, extraCharge: parsed } : a,
              ),
            }
          : slot,
      ),
    });
  };

  const filledRecipeCount = useMemo(
    () => recipeLines.filter(l => l.componentId.trim()).length,
    [recipeLines],
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Variable Component</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Mark recipe components that can be swapped at POS. Substitutes can be free or charged extra.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || filledRecipeCount === 0}
          onClick={syncSlotsFromRecipe}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
          Sync slots from Product Component
        </button>
      </div>

      {config.slots.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-4">
          Add recipe components below, then sync slots and attach substitute components (e.g. almond milk, oat milk).
        </p>
      ) : (
        <div className="space-y-3">
          {config.slots.map(slot => {
            const usedIds = new Set([
              slot.baseComponentId,
              ...slot.alternatives.map(a => a.componentId),
            ]);
            const availableAlts = ingredients.filter(i => i.componentId && !usedIds.has(i.componentId));
            return (
              <div key={slot.key} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{slot.slotLabel}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Base: {slot.baseComponentName} · Qty {slot.quantity} {slot.baseComponentUom}
                      {' · '}
                      {currency(slot.quantity * slot.baseUnitPrice)} COGS
                    </p>
                  </div>
                  <select
                    className={`${inputCls} w-auto min-w-[200px]`}
                    disabled={disabled || availableAlts.length === 0}
                    value=""
                    onChange={e => {
                      if (e.target.value) addAlternative(slot.key, e.target.value);
                    }}
                  >
                    <option value="">Add substitute…</option>
                    {availableAlts.map(ing => (
                      <option key={ing.componentId} value={ing.componentId}>
                        {ing.name}
                      </option>
                    ))}
                  </select>
                </div>
                {slot.alternatives.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No substitutes yet — base component stays as ordered.</p>
                ) : (
                  <ul className="space-y-2">
                    {slot.alternatives.map(alt => (
                      <li
                        key={alt.key}
                        className="flex flex-wrap items-center gap-2 text-xs border-t border-border/60 pt-2"
                      >
                        <span className="min-w-0 flex-1">
                          {alt.componentName}
                          <span className="text-muted-foreground">
                            {' · '}Qty {alt.quantity} {alt.componentUom}
                          </span>
                        </span>
                        <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          Extra charge
                          <span className="text-muted-foreground">{symbol}</span>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            disabled={disabled}
                            className={`${inputCls} w-24 py-1`}
                            value={alt.extraCharge > 0 ? alt.extraCharge : ''}
                            placeholder="0"
                            onChange={e => setExtraCharge(slot.key, alt.key, e.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeAlternative(slot.key, alt.key)}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                          aria-label={`Remove ${alt.componentName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className={labelCls}>
        POS shows SWAP when this product is ordered so staff can pick what the customer chose.
      </p>
    </section>
  );
}
