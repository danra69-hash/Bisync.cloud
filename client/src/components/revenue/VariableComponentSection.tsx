import { Plus, Trash2 } from 'lucide-react';
import type { ComponentRow } from '../../data/componentForm';
import { inputCls } from '../../data/countries';
import {
  blankVariableComponentAlternative,
  getPrimaryVariableComponentSlot,
  setPrimaryVariableComponentSlot,
  type VariableComponentConfig,
} from '../../data/productVariableComponent';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { SmartComponentPicker } from './SmartComponentPicker';

type Props = {
  config: VariableComponentConfig;
  onChange: (next: VariableComponentConfig) => void;
  ingredients: ComponentRow[];
  disabled?: boolean;
};

const labelCls = 'text-xs font-sans text-muted-foreground uppercase tracking-wider';

export function VariableComponentSection({
  config,
  onChange,
  ingredients,
  disabled,
}: Props) {
  const { symbol } = useCountryFormatters();
  const slot = getPrimaryVariableComponentSlot(config);

  const commit = (nextSlot: typeof slot) => {
    onChange(setPrimaryVariableComponentSlot(nextSlot));
  };

  const usedIds = new Set([
    slot.baseComponentId,
    ...slot.alternatives.map(a => a.componentId).filter(Boolean),
  ]);

  const setOriginalComponent = (component: ComponentRow | null) => {
    if (!component) {
      commit({
        ...slot,
        slotLabel: '',
        baseComponentId: '',
        baseComponentName: '',
        baseComponentUom: '',
        baseUnitPrice: 0,
      });
      return;
    }
    commit({
      ...slot,
      slotLabel: component.name,
      baseComponentId: component.componentId,
      baseComponentName: component.name,
      baseComponentUom: component.recipeUOM || slot.baseComponentUom,
      baseUnitPrice: component.lastPriceRecipe ?? 0,
      quantity: slot.quantity > 0 ? slot.quantity : 1,
    });
  };

  const addAlternate = () => {
    commit({
      ...slot,
      alternatives: [...slot.alternatives, blankVariableComponentAlternative()],
    });
  };

  const updateAlternate = (
    altKey: string,
    patch: Partial<(typeof slot.alternatives)[number]>,
  ) => {
    commit({
      ...slot,
      alternatives: slot.alternatives.map(a => (a.key === altKey ? { ...a, ...patch } : a)),
    });
  };

  const setAlternateComponent = (altKey: string, component: ComponentRow | null) => {
    if (!component) {
      updateAlternate(altKey, {
        componentId: '',
        componentName: '',
        componentUom: '',
        unitPrice: 0,
      });
      return;
    }
    const current = slot.alternatives.find(a => a.key === altKey);
    updateAlternate(altKey, {
      componentId: component.componentId,
      componentName: component.name,
      componentUom: component.recipeUOM || current?.componentUom || slot.baseComponentUom,
      unitPrice: component.lastPriceRecipe ?? 0,
      quantity: current && current.quantity > 0 ? current.quantity : (slot.quantity > 0 ? slot.quantity : 1),
    });
  };

  const removeAlternate = (altKey: string) => {
    commit({
      ...slot,
      alternatives: slot.alternatives.filter(a => a.key !== altKey),
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Variable Component</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Set the original component and the alternates that can replace it at POS (SWAP). Addon RRP is charged when an alternate is chosen.
        </p>
      </div>

      {/* Original */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
        <p className="text-xs font-semibold text-foreground">Original component</p>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 items-end">
          <div className="space-y-1.5 min-w-0">
            <label className={labelCls}>Component</label>
            <SmartComponentPicker
              components={ingredients}
              value={slot.baseComponentId}
              fallbackLabel={slot.baseComponentName}
              placeholder="Search original component…"
              disabled={disabled}
              onChange={setOriginalComponent}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="vc-original-uom">UOM</label>
            <input
              id="vc-original-uom"
              type="text"
              disabled={disabled}
              className={inputCls}
              value={slot.baseComponentUom}
              placeholder="e.g. ml"
              onChange={e => commit({ ...slot, baseComponentUom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls} htmlFor="vc-original-qty">QTY</label>
            <input
              id="vc-original-qty"
              type="number"
              min={0}
              step="any"
              disabled={disabled}
              className={inputCls}
              value={slot.quantity > 0 ? slot.quantity : ''}
              placeholder="0"
              onChange={e => commit({ ...slot, quantity: Math.max(0, parseFloat(e.target.value) || 0) })}
            />
          </div>
        </div>
      </div>

      {/* Alternates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Alternate components</p>
          <button
            type="button"
            disabled={disabled || !slot.baseComponentId}
            onClick={addAlternate}
            className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add alternate
          </button>
        </div>

        {slot.alternatives.length === 0 ? (
          <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-4">
            Add an alternate component that can replace the original at POS.
          </p>
        ) : (
          slot.alternatives.map((alt, index) => {
            const altOptions = ingredients.filter(
              i => i.componentId
                && (!usedIds.has(i.componentId) || i.componentId === alt.componentId),
            );
            return (
              <div
                key={alt.key}
                className="rounded-lg border border-border bg-muted/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">
                    Alternate {index + 1}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeAlternate(alt.key)}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                    aria-label={`Remove alternate ${index + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem] gap-3 items-end">
                  <div className="space-y-1.5 min-w-0">
                    <label className={labelCls}>Component</label>
                    <SmartComponentPicker
                      components={altOptions}
                      value={alt.componentId}
                      fallbackLabel={alt.componentName}
                      placeholder="Search replacement component…"
                      disabled={disabled}
                      onChange={component => setAlternateComponent(alt.key, component)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>UOM</label>
                    <input
                      type="text"
                      disabled={disabled}
                      className={inputCls}
                      value={alt.componentUom}
                      placeholder="e.g. ml"
                      onChange={e => updateAlternate(alt.key, { componentUom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>QTY</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={disabled}
                      className={inputCls}
                      value={alt.quantity > 0 ? alt.quantity : ''}
                      placeholder="0"
                      onChange={e => updateAlternate(alt.key, {
                        quantity: Math.max(0, parseFloat(e.target.value) || 0),
                      })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>Addon RRP</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{symbol}</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        disabled={disabled}
                        className={inputCls}
                        value={alt.extraCharge > 0 ? alt.extraCharge : ''}
                        placeholder="0"
                        onChange={e => updateAlternate(alt.key, {
                          extraCharge: Math.max(0, parseFloat(e.target.value) || 0),
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {slot.alternatives.length > 0 ? (
          <button
            type="button"
            disabled={disabled || !slot.baseComponentId}
            onClick={addAlternate}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another alternate component
          </button>
        ) : null}
      </div>

      <p className={labelCls}>
        POS shows SWAP using the SWAP Name so staff can pick the alternate the customer chose.
      </p>
    </section>
  );
}
