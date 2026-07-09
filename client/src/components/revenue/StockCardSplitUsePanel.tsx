import { useMemo, useState } from 'react';
import type { ComponentSplitUseConfig } from '../../data/componentSplitUse';
import {
  calcSplitUseBreakdown,
  calcSplitUseLineAssignedValue,
  calcVirtualSubComponentStock,
} from '../../data/componentSplitUse';
import { fromApiUom } from '../../data/componentForm';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { inputCls } from '../layout/formControls';
import { TableHeaderCell } from '../shared/TableHeaderCell';

type Props = {
  splitUse: ComponentSplitUseConfig;
  componentName: string;
  onHandQty: number;
  displayUom: string;
  inventoryUom: string;
  recipeUom: string;
  convertFromInventoryQty: string;
  convertToRecipeQty: string;
  componentPrice: number;
  principalQty: number;
};

function fmtQty(value: number, format: (n: number) => string) {
  if (!Number.isFinite(value)) return '—';
  return format(value);
}

export function StockCardSplitUsePanel({
  splitUse,
  componentName,
  onHandQty,
  displayUom,
  inventoryUom,
  recipeUom,
  convertFromInventoryQty,
  convertToRecipeQty,
  componentPrice,
  principalQty,
}: Props) {
  const { number } = useCountryFormatters();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [unitsToSplit, setUnitsToSplit] = useState('1');

  const splitQty = Math.min(
    Math.max(parseFloat(unitsToSplit) || 0, 0),
    Math.max(onHandQty, 0),
  );

  const splitLines = useMemo(
    () => calcSplitUseBreakdown(splitUse, splitQty),
    [splitUse, splitQty],
  );

  const virtualStock = useMemo(
    () => calcVirtualSubComponentStock(splitUse, onHandQty),
    [splitUse, onHandQty],
  );

  if (!splitUse.enabled || splitUse.lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">Split Use</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{componentName}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            On hand: {fmtQty(onHandQty, number)} {displayUom}. Yield loss is not applied for split-use components.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={showBreakdown}
            onChange={e => setShowBreakdown(e.target.checked)}
            className="rounded border-border"
          />
          Convert to sub-components
        </label>
      </div>

      {showBreakdown ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                Units to split ({displayUom})
              </label>
              <input
                className={`${inputCls} w-28`}
                type="number"
                min="0"
                max={onHandQty}
                step="any"
                value={unitsToSplit}
                onChange={e => setUnitsToSplit(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground pb-2">
              Remaining whole stock after split: {fmtQty(Math.max(onHandQty - splitQty, 0), number)} {displayUom}
            </p>
          </div>

          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <TableHeaderCell>Sub-component</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Split QTY</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Available (all on hand)</TableHeaderCell>
                  <TableHeaderCell headerAlign="right">Value</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {splitLines.map(line => {
                  const virtual = virtualStock.find(row => row.key === line.key);
                  const value = calcSplitUseLineAssignedValue(
                    line,
                    splitUse,
                    componentPrice,
                    fromApiUom(inventoryUom),
                    fromApiUom(recipeUom),
                    convertFromInventoryQty,
                    convertToRecipeQty,
                    principalQty,
                  );
                  return (
                    <tr key={line.key} className="border-b border-border/50">
                      <td className="p-2 font-medium">{line.name}</td>
                      <td className="p-2 text-right tabular-nums">
                        {fmtQty(line.resultQty, number)} {line.resultUom}
                      </td>
                      <td className="p-2 text-right tabular-nums text-muted-foreground">
                        {virtual ? `${fmtQty(virtual.availableQty, number)} ${virtual.availableUom}` : '—'}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {value !== null && value > 0 ? number(value) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
