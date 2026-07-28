import { Plus, Trash2 } from 'lucide-react';
import type { Product } from '../../api';
import type { ComponentRow } from '../../data/componentForm';
import { inputCls } from '../../data/countries';
import { calcProductCogs } from '../../data/productForm';
import {
  calcVariableMinMaxCost,
  newOptionKey,
  type VariableCombinationOption,
  type VariableMode,
  type VariableProductConfig,
  type VariableReplacementSlot,
} from '../../data/productVariable';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type Props = {
  config: VariableProductConfig;
  onChange: (next: VariableProductConfig) => void;
  /** Finished products available as combination options. */
  catalogProducts: Product[];
  /** Recipe lines used to seed replacement slots. */
  recipeLines: {
    key: string;
    componentId: string;
    componentName: string;
    componentUom: string;
    componentUomPrice: string;
    quantity: string;
  }[];
  /** Ingredient catalog for replacement alternatives. */
  ingredients: ComponentRow[];
  disabled?: boolean;
  baseRecipeCost: number;
};

const labelCls = 'text-xs font-sans text-muted-foreground uppercase tracking-wider';

export function VariableProductSection({
  config,
  onChange,
  catalogProducts,
  recipeLines,
  ingredients,
  disabled,
  baseRecipeCost,
}: Props) {
  const { currency } = useCountryFormatters();
  const { minCost, maxCost } = calcVariableMinMaxCost(config, baseRecipeCost);

  const setMode = (mode: VariableMode) => {
    onChange({
      ...config,
      mode,
      combinationOptions: mode === 'combination' ? config.combinationOptions : [],
      replacementSlots: mode === 'replacement' ? config.replacementSlots : [],
    });
  };

  const addCombinationProduct = (productId: number) => {
    const product = catalogProducts.find(p => p.id === productId);
    if (!product) return;
    if (config.combinationOptions.some(o => o.productId === product.id)) return;
    const unitCost = calcProductCogs(product.totalCost ?? 0, product.packagingCost ?? 0, product);
    const option: VariableCombinationOption = {
      key: newOptionKey('combo'),
      productId: product.id,
      productCode: product.productId,
      productName: product.name,
      unitCost,
    };
    onChange({
      ...config,
      combinationOptions: [...config.combinationOptions, option],
    });
  };

  const removeCombination = (key: string) => {
    onChange({
      ...config,
      combinationOptions: config.combinationOptions.filter(o => o.key !== key),
    });
  };

  const syncSlotsFromRecipe = () => {
    const slots: VariableReplacementSlot[] = recipeLines
      .filter(line => line.componentId)
      .map(line => {
        const existing = config.replacementSlots.find(s => s.baseComponentId === line.componentId);
        return {
          key: existing?.key ?? newOptionKey('slot'),
          slotLabel: existing?.slotLabel || line.componentName || 'Component',
          baseComponentId: line.componentId,
          baseComponentName: line.componentName,
          baseComponentUom: line.componentUom,
          baseUnitPrice: parseFloat(line.componentUomPrice) || 0,
          quantity: parseFloat(line.quantity) || 0,
          alternatives: existing?.alternatives ?? [],
        };
      });
    onChange({ ...config, replacementSlots: slots });
  };

  const addAlternative = (slotKey: string, componentId: string) => {
    const ingredient = ingredients.find(i => i.componentId === componentId);
    if (!ingredient) return;
    onChange({
      ...config,
      replacementSlots: config.replacementSlots.map(slot => {
        if (slot.key !== slotKey) return slot;
        if (slot.alternatives.some(a => a.componentId === ingredient.componentId)) return slot;
        if (slot.baseComponentId === ingredient.componentId) return slot;
        return {
          ...slot,
          alternatives: [
            ...slot.alternatives,
            {
              key: newOptionKey('alt'),
              componentId: ingredient.componentId,
              componentName: ingredient.name,
              componentUom: ingredient.recipeUOM || slot.baseComponentUom,
              unitPrice: ingredient.lastPriceRecipe ?? 0,
              quantity: slot.quantity,
            },
          ],
        };
      }),
    });
  };

  const removeAlternative = (slotKey: string, altKey: string) => {
    onChange({
      ...config,
      replacementSlots: config.replacementSlots.map(slot => (
        slot.key !== slotKey
          ? slot
          : { ...slot, alternatives: slot.alternatives.filter(a => a.key !== altKey) }
      )),
    });
  };

  const availableComboProducts = catalogProducts.filter(
    p => !config.combinationOptions.some(o => o.productId === p.id),
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Variable Product</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Combination packages (choose any up to a total qty) or component replacements (same qty).
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="text-muted-foreground">
            Min Cost: <span className="font-semibold text-foreground">{currency(minCost)}</span>
          </span>
          <span className="text-muted-foreground">
            Max Cost: <span className="font-semibold text-foreground">{currency(maxCost)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={config.mode === 'combination'}
            disabled={disabled}
            onChange={() => setMode('combination')}
            className="rounded border-border"
          />
          Combination of products
        </label>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={config.mode === 'replacement'}
            disabled={disabled}
            onChange={() => setMode('replacement')}
            className="rounded border-border"
          />
          Replacement of components
        </label>
      </div>

      {config.mode === 'combination' ? (
        <div className="space-y-3">
          <div className="max-w-xs space-y-1.5">
            <label className={labelCls}>Total quantity (package size)</label>
            <input
              type="number"
              min={1}
              step={1}
              disabled={disabled}
              className={inputCls}
              value={config.choiceQty || ''}
              onChange={e => onChange({
                ...config,
                choiceQty: Math.max(0, parseFloat(e.target.value) || 0),
              })}
              placeholder="e.g. 5"
            />
            <p className="text-[10px] text-muted-foreground">
              Customer chooses any products from the list up to this total quantity. Line quantities are not used.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <label className={labelCls}>Add product to choice list</label>
              <select
                className={inputCls}
                disabled={disabled || availableComboProducts.length === 0}
                value=""
                onChange={e => {
                  const id = Number(e.target.value);
                  if (id > 0) addCombinationProduct(id);
                }}
              >
                <option value="">
                  {availableComboProducts.length === 0 ? 'No more products available' : 'Select product…'}
                </option>
                {availableComboProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.productId} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3 font-semibold">Product Code</th>
                  <th className="py-2 px-3 font-semibold">Product</th>
                  <th className="py-2 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-2 px-3 font-semibold w-12" />
                </tr>
              </thead>
              <tbody>
                {config.combinationOptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 px-3 text-muted-foreground">
                      Add at least two products the customer can choose from.
                    </td>
                  </tr>
                ) : (
                  config.combinationOptions.map(option => (
                    <tr key={option.key} className="border-b border-border/70">
                      <td className="py-2 px-3 font-mono text-muted-foreground">{option.productCode}</td>
                      <td className="py-2 px-3">{option.productName}</td>
                      <td className="py-2 px-3 text-right">{currency(option.unitCost)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => removeCombination(option.key)}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || recipeLines.every(l => !l.componentId)}
              onClick={syncSlotsFromRecipe}
              className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Sync slots from Product Component
            </button>
            <p className="text-[10px] text-muted-foreground">
              Each slot keeps the same quantity; customers pick an alternative component.
            </p>
          </div>

          {config.replacementSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-4">
              Add recipe components above, then sync slots and attach alternatives (e.g. almond milk, low-fat milk).
            </p>
          ) : (
            <div className="space-y-3">
              {config.replacementSlots.map(slot => {
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
                          {currency(slot.quantity * slot.baseUnitPrice)}
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
                        <option value="">Add alternative…</option>
                        {availableAlts.map(ing => (
                          <option key={ing.componentId} value={ing.componentId}>
                            {ing.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {slot.alternatives.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No alternatives yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {slot.alternatives.map(alt => (
                          <li
                            key={alt.key}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-border/60 pt-1"
                          >
                            <span>
                              {alt.componentName}
                              <span className="text-muted-foreground">
                                {' · '}Qty {alt.quantity} {alt.componentUom}
                                {' · '}
                                {currency(alt.quantity * alt.unitPrice)}
                              </span>
                            </span>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => removeAlternative(slot.key, alt.key)}
                              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
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
        </div>
      )}
    </section>
  );
}
