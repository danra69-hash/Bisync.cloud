import { Plus, X } from 'lucide-react';
import { getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import {
  getConversion,
  isConversionQtyAutoFilled,
  type AltUnitEntry,
} from '../../data/componentForm';
import { MAX_PRODUCTION_ALT_UOMS } from '../../data/productBatchUom';

const selectCls =
  'rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[5rem]';
const qtyCls =
  'min-w-[8.5rem] w-[8.5rem] rounded-md border border-border bg-background px-2 py-1.5 text-xs tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-primary';

type Props = {
  principalUnit: string;
  altUnits: AltUnitEntry[];
  disabled?: boolean;
  /** When true, principal select is read-only (alts may still edit unless disabled). */
  lockPrincipal?: boolean;
  onPrincipalChange: (unit: string) => void;
  onAltUnitsChange: (entries: AltUnitEntry[]) => void;
};

function refreshAlt(entry: AltUnitEntry, principalUnit: string): AltUnitEntry {
  const fromQty = entry.fromQty?.trim() || '1';
  const conv = getConversion(entry.unit, principalUnit);
  if (conv === null) return { ...entry, fromQty };
  const from = parseFloat(fromQty) || 1;
  return { ...entry, fromQty, qty: String(conv * from) };
}

export function clampProductionAltUnits(entries: AltUnitEntry[]): AltUnitEntry[] {
  return entries
    .filter(entry => entry.unit.trim())
    .slice(0, MAX_PRODUCTION_ALT_UOMS)
    .map(entry => ({
      unit: entry.unit.trim(),
      fromQty: entry.fromQty?.trim() || '1',
      qty: entry.qty?.trim() || '',
    }));
}

export function B2bProductionUomFields({
  principalUnit,
  altUnits,
  disabled = false,
  lockPrincipal = false,
  onPrincipalChange,
  onAltUnitsChange,
}: Props) {
  const recipeUnits = getKnownRecipeUnits();
  const unitOptions = recipeUnits.filter(unit => unit !== principalUnit);

  function updateAlt(index: number, patch: Partial<AltUnitEntry>) {
    const next = [...altUnits];
    const updated = refreshAlt({ ...next[index], fromQty: next[index].fromQty || '1', ...patch }, principalUnit);
    next[index] = updated;
    onAltUnitsChange(clampProductionAltUnits(next));
  }

  function addAlt() {
    if (altUnits.length >= MAX_PRODUCTION_ALT_UOMS || !principalUnit || disabled) return;
    const nextUnit = unitOptions.find(unit => !altUnits.some(entry => entry.unit === unit)) ?? unitOptions[0];
    if (!nextUnit) return;
    onAltUnitsChange(clampProductionAltUnits([
      ...altUnits,
      refreshAlt({ unit: nextUnit, fromQty: '1', qty: '' }, principalUnit),
    ]));
  }

  function removeAlt(index: number) {
    onAltUnitsChange(altUnits.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 max-w-md">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="principal-production-uom">
          Principal Production UOM
        </label>
        <select
          id="principal-production-uom"
          className={`${selectCls} w-full`}
          value={principalUnit}
          disabled={disabled || lockPrincipal}
          onChange={e => {
            const next = e.target.value;
            onPrincipalChange(next);
            onAltUnitsChange(clampProductionAltUnits(altUnits.map(entry => refreshAlt(entry, next))));
          }}
        >
          <option value="">Select Production UOM…</option>
          {recipeUnits.map(unit => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          How this B2B Principal product is created. Up to {MAX_PRODUCTION_ALT_UOMS} alternate production units
          ({`1 alt = qty × principal`}).
        </p>
      </div>

      {principalUnit ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Alternate Production Unit
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Optional. Example: 1 Box = 12 {principalUnit}.
              </p>
            </div>
            {altUnits.length < MAX_PRODUCTION_ALT_UOMS ? (
              <button
                type="button"
                onClick={addAlt}
                disabled={disabled}
                className="text-xs font-sans text-primary hover:underline flex items-center gap-1 shrink-0 disabled:opacity-50"
              >
                <Plus size={12} />
                Add
              </button>
            ) : null}
          </div>

          {altUnits.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No alternate production units yet.</p>
          ) : (
            <div className="space-y-2">
              {altUnits.map((entry, index) => {
                const autoFilled = isConversionQtyAutoFilled(
                  entry.unit,
                  principalUnit,
                  entry.qty,
                  entry.fromQty || '1',
                );
                return (
                  <div key={`${entry.unit}-${index}`} className="flex flex-wrap items-center gap-1.5">
                    <select
                      className={selectCls}
                      value={entry.unit}
                      disabled={disabled}
                      onChange={e => updateAlt(index, { unit: e.target.value })}
                    >
                      {unitOptions.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                      {!unitOptions.includes(entry.unit) && entry.unit ? (
                        <option value={entry.unit}>{entry.unit}</option>
                      ) : null}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={entry.fromQty || '1'}
                      disabled={disabled}
                      onChange={e => updateAlt(index, { fromQty: e.target.value })}
                      className={qtyCls}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">=</span>
                    <div className="relative shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entry.qty}
                        disabled={disabled}
                        onChange={e => updateAlt(index, { qty: e.target.value })}
                        className={`${qtyCls}${autoFilled ? ' pr-7' : ''}`}
                      />
                      {autoFilled ? (
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] font-sans text-primary pointer-events-none">
                          auto
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs shrink-0">{principalUnit}</span>
                    <button
                      type="button"
                      onClick={() => removeAlt(index)}
                      disabled={disabled}
                      className="p-0.5 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                      aria-label={`Remove ${entry.unit}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
