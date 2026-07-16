import { Plus, Trash2, X } from 'lucide-react';
import type { ComponentForm } from '../../data/componentForm';
import { inputCls, selectCls } from '../../data/componentForm';
import {
  calcSplitUseLineAssignedValue,
  createSplitUseLine,
  resolveSplitUseBasisUom,
  SPLIT_USE_UOM_OPTIONS,
  sumSplitUseLineQtyInBasis,
  type ComponentSplitUseConfig,
  type SplitUseLine,
} from '../../data/componentSplitUse';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  form: ComponentForm;
  componentPrice: number;
  principalQty: number;
  onChange: (splitUse: ComponentSplitUseConfig) => void;
};

function updateLine(lines: SplitUseLine[], key: string, patch: Partial<SplitUseLine>): SplitUseLine[] {
  return lines.map(line => (line.key === key ? { ...line, ...patch } : line));
}

export function ComponentSplitUseSection({ form, componentPrice, principalQty, onChange }: Props) {
  const { number } = useCountryFormatters();
  const splitUse = form.splitUse;
  const basisUom = resolveSplitUseBasisUom(splitUse.qtyBasis, form.inventoryUnit, form.recipeUnit);
  const { total: lineTotal } = sumSplitUseLineQtyInBasis(
    splitUse.lines,
    basisUom,
    form.inventoryUnit,
    form.recipeUnit,
    form.convertFromInventoryQty,
    form.convertToRecipeQty,
  );
  const componentQty = parseFloat(splitUse.componentQty) || 0;
  const quantitiesValid = lineTotal !== null && lineTotal < componentQty;
  const nettQty = lineTotal === null ? null : Math.max(0, componentQty - lineTotal);
  const allocatedValue = splitUse.lines.reduce((sum, line) => {
    const value = calcSplitUseLineAssignedValue(
      line,
      splitUse,
      componentPrice,
      form.inventoryUnit,
      form.recipeUnit,
      form.convertFromInventoryQty,
      form.convertToRecipeQty,
      principalQty,
    );
    return sum + (value ?? 0);
  }, 0);

  function patchSplitUse(patch: Partial<ComponentSplitUseConfig>) {
    onChange({ ...splitUse, ...patch });
  }

  function patchLine(key: string, patch: Partial<SplitUseLine>) {
    patchSplitUse({ lines: updateLine(splitUse.lines, key, patch) });
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Component Name</p>
          <p className="font-medium text-foreground truncate">{form.name.trim() || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inventory UOM</p>
          <p className="font-medium text-foreground">{form.inventoryUnit}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">QTY</p>
          <div className="flex items-center gap-2">
            <input
              className={`${inputCls} w-24`}
              type="number"
              min="0"
              step="any"
              value={splitUse.componentQty}
              onChange={e => patchSplitUse({ componentQty: e.target.value })}
            />
            <select
              className={`${selectCls} w-28`}
              value={splitUse.qtyBasis}
              onChange={e => patchSplitUse({ qtyBasis: e.target.value as 'inventory' | 'recipe' })}
            >
              <option value="inventory">{form.inventoryUnit}</option>
              <option value="recipe">{form.recipeUnit}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <TableHeaderCell>Sub-component Name</TableHeaderCell>
              <TableHeaderCell>QTY</TableHeaderCell>
              <TableHeaderCell>Inventory UOM</TableHeaderCell>
              <TableHeaderCell headerAlign="right">Value Assigned %</TableHeaderCell>
              <TableHeaderCell headerAlign="right">Calculated Value</TableHeaderCell>
              <TableHeaderCell headerAlign="center">Waste</TableHeaderCell>
              <TableHeaderCell className="w-8">&nbsp;</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {splitUse.lines.map(line => {
              const assigned = calcSplitUseLineAssignedValue(
                line,
                splitUse,
                componentPrice,
                form.inventoryUnit,
                form.recipeUnit,
                form.convertFromInventoryQty,
                form.convertToRecipeQty,
                principalQty,
              );
              return (
                <tr key={line.key} className="border-b border-border/50">
                  <td className="p-2">
                    <input
                      className={inputCls}
                      value={line.name}
                      onChange={e => patchLine(line.key, { name: e.target.value })}
                      placeholder="e.g. Wings"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className={`${inputCls} w-20`}
                      type="number"
                      min="0"
                      step="any"
                      value={line.qty}
                      onChange={e => patchLine(line.key, { qty: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className={`${selectCls} w-24`}
                      value={line.inventoryUom}
                      onChange={e => patchLine(line.key, { inventoryUom: e.target.value })}
                    >
                      {SPLIT_USE_UOM_OPTIONS.map(uom => (
                        <option key={uom} value={uom}>{uom}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <div className="relative w-24 ml-auto">
                      <input
                        className={`${inputCls} w-24 pr-6 text-right bg-amber-50/60 dark:bg-amber-950/20`}
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={line.valueAssignedPct}
                        onChange={e => patchLine(line.key, {
                          valueAssignedPct: e.target.value,
                          valueAssigned: e.target.value,
                        })}
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">
                    {assigned !== null ? number(assigned) : '—'}
                  </td>
                  <td className="p-2 text-center">
                    <label className={`inline-flex items-center gap-1 cursor-pointer ${line.isWaste ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <input
                        type="checkbox"
                        checked={line.isWaste}
                        onChange={e => patchLine(line.key, { isWaste: e.target.checked })}
                        aria-label={`Mark ${line.name || 'split output'} as waste`}
                      />
                      <Trash2 size={13} />
                    </label>
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => patchSplitUse({ lines: splitUse.lines.filter(row => row.key !== line.key) })}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/10">
              <td className="p-2 font-medium">Component Nett</td>
              <td className="p-2 font-medium tabular-nums" colSpan={2}>
                <span className={quantitiesValid ? 'text-foreground' : 'text-destructive'}>
                  {nettQty !== null ? `${number(nettQty)} ${basisUom}` : '—'}
                </span>
              </td>
              <td className="p-2 text-right text-muted-foreground">Remaining value</td>
              <td className="p-2 text-right font-medium tabular-nums" colSpan={3}>
                {number(Math.max(0, componentPrice - allocatedValue))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={() => patchSplitUse({ lines: [...splitUse.lines, createSplitUseLine()] })}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus size={12} />
        Add sub-component
      </button>
      <p className="text-[10px] text-muted-foreground">
        Split output quantities are deducted from the inbound component; Component Nett remains as parent stock.
        Value Assigned % allocates incoming FIFO value to each output. Tick the bin to record that output as wastage.
        Yield Loss % is disabled while Split Use is enabled.
      </p>
    </div>
  );
}
