import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Product } from '../../api';
import type { ComponentRow } from '../../data/componentForm';
import { inputCls } from '../../data/countries';
import { calcProductCogs } from '../../data/productForm';
import {
  WEIGHT_UOM_OPTIONS,
  calcVariableMinMaxCost,
  calcWeightUnitRrp,
  newOptionKey,
  type VariableCombinationOption,
  type VariableMode,
  type VariableProductConfig,
  type VariableReplacementSlot,
} from '../../data/productVariable';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { ColGroup } from '../shared/SortableTableHead';

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
  /** Quoted RRP for the weight reference qty (from product pricing). */
  rrp?: number;
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
  rrp = 0,
}: Props) {
  const { currency } = useCountryFormatters();
  const { minCost, maxCost } = calcVariableMinMaxCost(config, baseRecipeCost);
  const unitRrp = config.mode === 'weight' ? calcWeightUnitRrp(rrp, config.choiceQty) : 0;
  /** Pending multi-ticks when picking products for the combination choice list. */
  const [pendingComboIds, setPendingComboIds] = useState<number[]>([]);
  const [comboFilter, setComboFilter] = useState('');

  const setMode = (mode: VariableMode) => {
    onChange({
      ...config,
      mode,
      weightUom: mode === 'weight' ? (config.weightUom || 'kg') : '',
      choiceQty: mode === 'weight' ? (config.choiceQty > 0 ? config.choiceQty : 1) : config.choiceQty,
      combinationOptions: mode === 'combination' ? config.combinationOptions : [],
      replacementSlots: mode === 'replacement' ? config.replacementSlots : [],
    });
    if (mode !== 'combination') {
      setPendingComboIds([]);
      setComboFilter('');
    }
  };

  const addCombinationProducts = (productIds: number[]) => {
    const existing = new Set(config.combinationOptions.map(o => o.productId));
    const toAdd: VariableCombinationOption[] = [];
    for (const productId of productIds) {
      if (existing.has(productId)) continue;
      const product = catalogProducts.find(p => p.id === productId);
      if (!product) continue;
      const unitCost = calcProductCogs(product.totalCost ?? 0, product.packagingCost ?? 0, product);
      toAdd.push({
        key: newOptionKey('combo'),
        productId: product.id,
        productCode: product.productId,
        productName: product.name,
        productGroup: (product.group || product.category || '').trim() || undefined,
        unitCost,
      });
      existing.add(product.id);
    }
    if (toAdd.length === 0) return;
    onChange({
      ...config,
      combinationOptions: [...config.combinationOptions, ...toAdd],
    });
  };

  const removeCombination = (key: string) => {
    onChange({
      ...config,
      combinationOptions: config.combinationOptions.filter(o => o.key !== key),
    });
  };

  const togglePendingCombo = (productId: number, checked: boolean) => {
    setPendingComboIds(prev => {
      if (checked) {
        return prev.includes(productId) ? prev : [...prev, productId];
      }
      return prev.filter(id => id !== productId);
    });
  };

  const addPendingComboProducts = () => {
    if (pendingComboIds.length === 0) return;
    addCombinationProducts(pendingComboIds);
    setPendingComboIds([]);
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

  const availableComboProducts = useMemo(() => {
    const chosen = new Set(config.combinationOptions.map(o => o.productId));
    const q = comboFilter.trim().toLowerCase();
    return catalogProducts
      .filter(p => {
        if (chosen.has(p.id)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q)
          || (p.productId || '').toLowerCase().includes(q)
          || (p.category || '').toLowerCase().includes(q)
          || (p.group || '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const groupA = (a.group || a.category || 'General').trim() || 'General';
        const groupB = (b.group || b.category || 'General').trim() || 'General';
        const byGroup = groupA.localeCompare(groupB);
        if (byGroup !== 0) return byGroup;
        return a.name.localeCompare(b.name);
      });
  }, [catalogProducts, config.combinationOptions, comboFilter]);

  const availableComboByGroup = useMemo(() => {
    const groups: { group: string; products: typeof availableComboProducts }[] = [];
    for (const product of availableComboProducts) {
      const group = (product.group || product.category || 'General').trim() || 'General';
      const last = groups[groups.length - 1];
      if (last && last.group === group) {
        last.products.push(product);
      } else {
        groups.push({ group, products: [product] });
      }
    }
    return groups;
  }, [availableComboProducts]);

  const catalogById = useMemo(
    () => new Map(catalogProducts.map(p => [p.id, p])),
    [catalogProducts],
  );

  const sortedCombinationOptions = useMemo(() => {
    return config.combinationOptions
      .map(option => {
        const product = catalogById.get(option.productId);
        const productGroup = (
          option.productGroup
          || product?.group
          || product?.category
          || ''
        ).trim() || 'General';
        return { option, productGroup };
      })
      .sort((a, b) => {
        const byGroup = a.productGroup.localeCompare(b.productGroup);
        if (byGroup !== 0) return byGroup;
        return a.option.productName.localeCompare(b.option.productName);
      });
  }, [config.combinationOptions, catalogById]);

  const allVisiblePendingChecked =
    availableComboProducts.length > 0
    && availableComboProducts.every(p => pendingComboIds.includes(p.id));

  const toggleAllVisiblePending = (checked: boolean) => {
    if (!checked) {
      const visible = new Set(availableComboProducts.map(p => p.id));
      setPendingComboIds(prev => prev.filter(id => !visible.has(id)));
      return;
    }
    setPendingComboIds(prev => {
      const next = new Set(prev);
      for (const p of availableComboProducts) next.add(p.id);
      return [...next];
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Variable Product</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Combination packages, component replacements, or weight-based pricing for POS.
          </p>
        </div>
        {config.mode !== 'weight' ? (
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-muted-foreground">
              Min Cost: <span className="font-semibold text-foreground">{currency(minCost)}</span>
            </span>
            <span className="text-muted-foreground">
              Max Cost: <span className="font-semibold text-foreground">{currency(maxCost)}</span>
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Recipe cost for quoted weight:{' '}
            <span className="font-semibold text-foreground">{currency(minCost)}</span>
          </div>
        )}
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
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={config.mode === 'weight'}
            disabled={disabled}
            onChange={() => setMode('weight')}
            className="rounded border-border"
          />
          Weight based Product
        </label>
      </div>

      {config.mode === 'weight' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
            <div className="space-y-1.5">
              <label className={labelCls}>Weight UOM *</label>
              <select
                className={inputCls}
                disabled={disabled}
                value={config.weightUom || 'kg'}
                onChange={e => onChange({ ...config, weightUom: e.target.value })}
              >
                {WEIGHT_UOM_OPTIONS.map(uom => (
                  <option key={uom} value={uom}>{uom}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>QTY *</label>
              <input
                type="number"
                min={0.001}
                step="any"
                disabled={disabled}
                className={inputCls}
                value={config.choiceQty || ''}
                onChange={e => onChange({
                  ...config,
                  choiceQty: Math.max(0, parseFloat(e.target.value) || 0),
                })}
                placeholder="e.g. 1"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>RRP (for QTY above)</label>
              <p className={`${inputCls} bg-muted/30`}>
                {rrp > 0 ? currency(rrp) : 'Set RRP in Pricing below'}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            RRP is for the QTY × Weight UOM above
            {rrp > 0 && config.choiceQty > 0 && config.weightUom
              ? ` (${currency(unitRrp)} per ${config.weightUom}).`
              : '.'}
            {' '}At POS the cashier enters the sold weight to calculate total RRP.
          </p>
        </div>
      ) : config.mode === 'combination' ? (
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <label className={labelCls}>Add products to choice list</label>
                <input
                  type="search"
                  className={inputCls}
                  disabled={disabled}
                  value={comboFilter}
                  onChange={e => setComboFilter(e.target.value)}
                  placeholder="Search products…"
                />
              </div>
              <button
                type="button"
                disabled={disabled || pendingComboIds.length === 0}
                onClick={addPendingComboProducts}
                className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                Add selected ({pendingComboIds.length})
              </button>
            </div>

            <div className="border border-border rounded-md max-h-56 overflow-y-auto">
              {availableComboProducts.length === 0 ? (
                <p className="py-4 px-3 text-xs text-muted-foreground">
                  {catalogProducts.length === 0
                    ? 'No products available.'
                    : comboFilter.trim()
                      ? 'No matching products.'
                      : 'All available products are already on the choice list.'}
                </p>
              ) : (
                <ul className="divide-y divide-border/70">
                  <li className="sticky top-0 bg-card/95 backdrop-blur-sm px-3 py-2 border-b border-border">
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        disabled={disabled}
                        checked={allVisiblePendingChecked}
                        onChange={e => toggleAllVisiblePending(e.target.checked)}
                      />
                      <span className="font-semibold text-muted-foreground">
                        Select all shown ({availableComboProducts.length})
                      </span>
                    </label>
                  </li>
                  {availableComboByGroup.map(({ group, products }) => (
                    <li key={group}>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                        {group}
                      </div>
                      <ul>
                        {products.map(p => {
                          const checked = pendingComboIds.includes(p.id);
                          return (
                            <li key={p.id}>
                              <label className="flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/40">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 rounded border-border"
                                  disabled={disabled}
                                  checked={checked}
                                  onChange={e => togglePendingCombo(p.id, e.target.checked)}
                                />
                                <span className="min-w-0">
                                  <span className="font-medium text-foreground">
                                    <span className="text-muted-foreground font-normal">{group}</span>
                                    <span className="text-muted-foreground font-normal"> · </span>
                                    {p.name}
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground font-mono">
                                    {p.productId}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tick one or more products, then Add selected to put them on the choice list.
            </p>
          </div>

          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <ColGroup widths={['18%', '16%', '36%', '14%', 88]} />
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 px-3 font-semibold">Group</th>
                  <th className="py-2 px-3 font-semibold">Product Code</th>
                  <th className="py-2 px-3 font-semibold">Product</th>
                  <th className="py-2 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-2 px-3 font-semibold w-12" />
                </tr>
              </thead>
              <tbody>
                {sortedCombinationOptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 px-3 text-muted-foreground">
                      Add at least two products the customer can choose from.
                    </td>
                  </tr>
                ) : (
                  sortedCombinationOptions.map(({ option, productGroup }) => (
                    <tr key={option.key} className="border-b border-border/70">
                      <td className="py-2 px-3 text-muted-foreground">{productGroup}</td>
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
