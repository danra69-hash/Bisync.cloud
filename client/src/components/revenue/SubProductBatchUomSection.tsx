import { Plus, X } from 'lucide-react';
import { getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import type { AltUnitEntry } from '../../data/componentForm';
import {
  MAX_BATCH_ADDITIONAL_UOMS,
  isBatchPackStyleUnit,
  refreshBatchAdditionalUoms,
  resolveBatchAdditionalEntry,
} from '../../data/productBatchUom';

const compactSelectCls =
  'rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[5rem]';
const compactQtyCls =
  'w-20 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const compactWideQtyCls =
  'w-28 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

type Props = {
  yieldQuantity: string;
  yieldUom: string;
  altUnits: AltUnitEntry[];
  onAltUnitsChange: (entries: AltUnitEntry[]) => void;
};

export function SubProductBatchAdditionalUoms({
  yieldQuantity,
  yieldUom,
  altUnits,
  onAltUnitsChange,
}: Props) {
  const batchQty = parseFloat(yieldQuantity) || 0;
  const recipeUnits = getKnownRecipeUnits();
  const unitOptions = recipeUnits.filter(unit => unit !== yieldUom);

  function updateEntry(index: number, patch: Partial<AltUnitEntry>) {
    const next = [...altUnits];
    const updated = { ...next[index], ...patch };
    if (patch.unit) {
      const packStyle = isBatchPackStyleUnit(patch.unit, yieldUom);
      updated.fromQty = packStyle ? '' : (batchQty > 0 ? String(batchQty) : '1');
      updated.qty = '';
    }
    next[index] = updated;
    onAltUnitsChange(refreshBatchAdditionalUoms(next, batchQty, yieldUom));
  }

  function addEntry() {
    if (altUnits.length >= MAX_BATCH_ADDITIONAL_UOMS || !yieldUom) return;
    const nextUnit = unitOptions.find(unit => !altUnits.some(entry => entry.unit === unit)) ?? unitOptions[0];
    if (!nextUnit) return;
    onAltUnitsChange(refreshBatchAdditionalUoms(
      [...altUnits, { unit: nextUnit, fromQty: batchQty > 0 ? String(batchQty) : '1', qty: '' }],
      batchQty,
      yieldUom,
    ));
  }

  function removeEntry(index: number) {
    onAltUnitsChange(altUnits.filter((_, i) => i !== index));
  }

  if (!yieldUom) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Alternate UOM
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Optional conversions from Order UOM. Primary / Secondary Packaging are set in the Delivery unit breakdown above.
          </p>
        </div>
        {altUnits.length < MAX_BATCH_ADDITIONAL_UOMS ? (
          <button
            type="button"
            onClick={addEntry}
            className="text-xs font-sans text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <Plus size={12} />
            Add
          </button>
        ) : null}
      </div>

      {altUnits.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No alternate UOM yet. Use Add to convert Order UOM into another unit.</p>
      ) : (
        <div className="space-y-2">
          {altUnits.map((entry, index) => {
            const resolved = resolveBatchAdditionalEntry(entry, batchQty, yieldUom);
            return (
              <div key={`${entry.unit}-${index}`} className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <select
                    className={compactSelectCls}
                    value={entry.unit}
                    onChange={e => updateEntry(index, { unit: e.target.value })}
                  >
                    {unitOptions.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  {resolved.packStyle ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={entry.fromQty}
                        onChange={e => updateEntry(index, { fromQty: e.target.value })}
                        placeholder="Packs"
                        className={compactQtyCls}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">primary pack(s)</span>
                      <span className="text-xs text-muted-foreground shrink-0">→</span>
                      <input
                        type="number"
                        value={resolved.qty}
                        readOnly
                        className={`${compactWideQtyCls} bg-muted/20`}
                      />
                      <span className="text-xs font-sans shrink-0">{yieldUom} / {entry.unit}</span>
                    </>
                  ) : (
                    <>
                      <input
                        type="number"
                        value={resolved.fromQty}
                        readOnly
                        className={`${compactQtyCls} bg-muted/20`}
                      />
                      <span className="text-xs text-muted-foreground shrink-0">{yieldUom}</span>
                      <span className="text-xs text-muted-foreground shrink-0">=</span>
                      <div className="relative shrink-0">
                        <input
                          type="number"
                          value={resolved.qty}
                          readOnly
                          className={`${compactWideQtyCls} bg-muted/20${resolved.autoFilled ? ' pr-7' : ''}`}
                        />
                        {resolved.autoFilled ? (
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] font-sans text-primary pointer-events-none">
                            auto
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs font-sans shrink-0">{entry.unit}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeEntry(index)}
                    className="p-0.5 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remove ${entry.unit}`}
                  >
                    <X size={12} />
                  </button>
                </div>
                {resolved.perPackLabel ? (
                  <p className="text-[10px] text-muted-foreground pl-1">{resolved.perPackLabel}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function createDefaultBatchAdditionalEntry(
  altUnits: AltUnitEntry[],
  yieldQuantity: string,
  yieldUom: string,
): AltUnitEntry[] {
  const batchQty = parseFloat(yieldQuantity) || 0;
  const recipeUnits = getKnownRecipeUnits();
  const unitOptions = recipeUnits.filter(unit => unit !== yieldUom);
  if (altUnits.length >= MAX_BATCH_ADDITIONAL_UOMS || !yieldUom) return altUnits;
  const nextUnit = unitOptions.find(unit => !altUnits.some(entry => entry.unit === unit)) ?? unitOptions[0];
  if (!nextUnit) return altUnits;
  return refreshBatchAdditionalUoms(
    [...altUnits, { unit: nextUnit, fromQty: batchQty > 0 ? String(batchQty) : '1', qty: '' }],
    batchQty,
    yieldUom,
  );
}
