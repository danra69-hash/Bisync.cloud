import { getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import { getConversionFactor, type AltUnitEntry } from '../../data/componentForm';
import { formatBatchAdditionalQty } from '../../data/productBatchUom';

const qtyCls =
  'w-20 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const unitCls =
  'w-28 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

export const MAX_SUB_PRODUCT_ALT_UOMS = 1;

type Props = {
  batchQty: string;
  batchUom: string;
  altUnits: AltUnitEntry[];
  readOnly?: boolean;
  batchReadOnly?: boolean;
  cogsLabel?: string;
  cogsHint?: string;
  onBatchQtyChange?: (value: string) => void;
  onBatchUomChange?: (value: string) => void;
  onAltUnitsChange?: (entries: AltUnitEntry[]) => void;
};

function resolveAltEntry(
  batchQty: string,
  batchUom: string,
  entry: AltUnitEntry | undefined,
): AltUnitEntry {
  const batch = parseFloat(batchQty) || 0;
  const unit = entry?.unit?.trim() ?? '';
  if (!unit) return { unit: '', fromQty: batch > 0 ? String(batch) : '', qty: '' };

  const factor = batchUom && unit ? getConversionFactor(batchUom, unit) : null;
  const autoQty = factor !== null && batch > 0 ? formatBatchAdditionalQty(batch * factor) : (entry?.qty ?? '');
  return {
    unit,
    fromQty: batch > 0 ? String(batch) : (entry?.fromQty || ''),
    qty: factor !== null ? autoQty : (entry?.qty ?? ''),
  };
}

export function SubProductBatchProduceFields({
  batchQty,
  batchUom,
  altUnits,
  readOnly = false,
  batchReadOnly = false,
  cogsLabel,
  cogsHint,
  onBatchQtyChange,
  onBatchUomChange,
  onAltUnitsChange,
}: Props) {
  const units = getKnownRecipeUnits();
  const batchEditable = !readOnly && !batchReadOnly && Boolean(onBatchQtyChange && onBatchUomChange);
  const altEditable = !readOnly && Boolean(onAltUnitsChange);
  const alt = resolveAltEntry(batchQty, batchUom, altUnits[0]);
  const altAuto = Boolean(batchUom && alt.unit && getConversionFactor(batchUom, alt.unit) !== null);
  const altUnitOptions = units.filter(unit => unit !== batchUom);

  function setAlt(patch: Partial<AltUnitEntry>) {
    if (!onAltUnitsChange) return;
    const nextUnit = (patch.unit ?? alt.unit).trim();
    if (!nextUnit) {
      onAltUnitsChange([]);
      return;
    }
    const merged = resolveAltEntry(batchQty, batchUom, {
      unit: nextUnit,
      fromQty: patch.fromQty ?? alt.fromQty,
      qty: patch.qty ?? alt.qty,
    });
    // If user typed qty manually on a non-auto pair, keep their qty.
    if (patch.qty !== undefined && getConversionFactor(batchUom, nextUnit) === null) {
      merged.qty = patch.qty;
    }
    onAltUnitsChange([{ ...merged, unit: nextUnit }].slice(0, MAX_SUB_PRODUCT_ALT_UOMS));
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Batch produce
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Recipe yield per batch for use in a Product mix. One alternative UOM is optional
            (e.g. 1000 Gr or 1 Ltr; 10 Each or 1 Kg).
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Qty</p>
            {batchEditable ? (
              <input
                id="yield-quantity"
                type="number"
                min="0"
                step="any"
                value={batchQty}
                onChange={e => onBatchQtyChange?.(e.target.value)}
                placeholder="e.g. 10"
                className={qtyCls}
                aria-label="Batch quantity"
              />
            ) : (
              <p className={`${qtyCls} bg-muted/30`}>{batchQty || '—'}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">UOM</p>
            {batchEditable ? (
              <select
                id="yield-uom"
                value={batchUom}
                onChange={e => onBatchUomChange?.(e.target.value)}
                className={unitCls}
                aria-label="Batch UOM"
              >
                <option value="">Select…</option>
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            ) : (
              <p className={`${unitCls} bg-muted/30`}>{batchUom || '—'}</p>
            )}
          </div>

          <span className="pb-2 text-xs text-muted-foreground shrink-0">or</span>

          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Alt Qty
            </p>
            {altEditable ? (
              <div className="relative">
                <input
                  id="yield-alt-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={alt.qty}
                  onChange={e => setAlt({ qty: e.target.value })}
                  placeholder="e.g. 1"
                  disabled={!alt.unit || altAuto}
                  className={`${qtyCls}${altAuto ? ' bg-muted/20 pr-7' : ''}${!alt.unit ? ' opacity-60' : ''}`}
                  aria-label="Alternative batch quantity"
                />
                {altAuto ? (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[6px] font-sans text-primary pointer-events-none">
                    auto
                  </span>
                ) : null}
              </div>
            ) : (
              <p className={`${qtyCls} bg-muted/30`}>{alt.qty || '—'}</p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Alt UOM
            </p>
            {altEditable ? (
              <select
                id="yield-alt-uom"
                value={alt.unit}
                onChange={e => setAlt({ unit: e.target.value, qty: '' })}
                disabled={!batchUom}
                className={unitCls}
                aria-label="Alternative batch UOM"
              >
                <option value="">None</option>
                {altUnitOptions.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            ) : (
              <p className={`${unitCls} bg-muted/30`}>{alt.unit || '—'}</p>
            )}
          </div>

          {cogsLabel ? (
            <div className="space-y-1 min-w-[7rem] ml-auto">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
              <p className="text-sm font-semibold">{cogsLabel}</p>
              {cogsHint ? (
                <p className="text-[10px] text-muted-foreground">{cogsHint}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Keep at most one alternative UOM for sub-products. */
export function clampSubProductAltUnits(entries: AltUnitEntry[]): AltUnitEntry[] {
  return entries
    .filter(entry => entry.unit.trim())
    .slice(0, MAX_SUB_PRODUCT_ALT_UOMS)
    .map(entry => ({
      unit: entry.unit.trim(),
      fromQty: entry.fromQty?.trim() || '',
      qty: entry.qty?.trim() || '',
    }));
}
