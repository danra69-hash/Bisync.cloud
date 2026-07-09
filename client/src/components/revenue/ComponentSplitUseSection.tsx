import { Plus, Trash2 } from 'lucide-react';
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
  const totalMatches = lineTotal !== null && Math.abs(lineTotal - componentQty) < 0.0001;

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
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <TableHeaderCell>Sub-component Name</TableHeaderCell>
              <TableHeaderCell>QTY</TableHeaderCell>
              <TableHeaderCell>Inventory UOM</TableHeaderCell>
              <TableHeaderCell headerAlign="right">Value Assigned</TableHeaderCell>
              <TableHeaderCell headerAlign="center">No Value</TableHeaderCell>
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
                  <td className="p-2 text-right">
                    {line.noValue ? (
                      <span className="tabular-nums text-muted-foreground">
                        {assigned !== null && assigned > 0 ? number(assigned) : 'Auto'}
                      </span>
                    ) : (
                      <input
                        className={`${inputCls} w-24 text-right`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.valueAssigned}
                        onChange={e => patchLine(line.key, { valueAssigned: e.target.value })}
                        placeholder="0"
                      />
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={line.noValue}
                      onChange={e => patchLine(line.key, {
                        noValue: e.target.checked,
                        valueAssigned: e.target.checked ? '' : line.valueAssigned,
                      })}
                      aria-label={`No value for ${line.name || 'sub-component'}`}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => patchSplitUse({ lines: splitUse.lines.filter(row => row.key !== line.key) })}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/10">
              <td colSpan={2} className="p-2 font-medium">Total</td>
              <td className="p-2 font-medium tabular-nums" colSpan={4}>
                <span className={totalMatches ? 'text-foreground' : 'text-destructive'}>
                  {lineTotal !== null ? `${number(lineTotal)} ${basisUom}` : '—'}
                </span>
                <span className="text-muted-foreground mx-2">/</span>
                <span>{componentQty > 0 ? `${number(componentQty)} ${basisUom}` : '—'}</span>
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
        Total sub-component quantity must match component QTY. Tick No Value to auto-allocate cost from component price
        (price ÷ (component QTY − no-value QTY) × sub-component QTY). Yield loss is not applied when split use is enabled.
      </p>
    </div>
  );
}
