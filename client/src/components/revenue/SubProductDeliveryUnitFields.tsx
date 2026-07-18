import { getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import {
  DELIVERY_UNIT_LEVEL_LABELS,
} from '../../data/vendorProductCatalog';
import {
  formatSubProductDeliveryUnitPath,
  type YieldPackagingLevels,
} from '../../data/productBatchUom';

const compactQtyCls =
  'w-20 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const compactUnitCls =
  'w-28 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

type Props = {
  orderQty: string;
  orderUnit: string;
  packaging: YieldPackagingLevels;
  readOnly?: boolean;
  cogsLabel?: string;
  cogsHint?: string;
  onOrderQtyChange?: (value: string) => void;
  onOrderUnitChange?: (value: string) => void;
  onPackagingChange?: (packaging: YieldPackagingLevels) => void;
};

function PackagingRow({
  label,
  qty,
  unit,
  readOnly,
  qtyId,
  unitId,
  onQtyChange,
  onUnitChange,
}: {
  label: string;
  qty: string;
  unit: string;
  readOnly?: boolean;
  qtyId: string;
  unitId: string;
  onQtyChange?: (value: string) => void;
  onUnitChange?: (value: string) => void;
}) {
  const units = getKnownRecipeUnits();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      {readOnly ? (
        <>
          <p className={`${compactQtyCls} bg-muted/30`}>{qty || '—'}</p>
          <p className={`${compactUnitCls} bg-muted/30`}>{unit || '—'}</p>
        </>
      ) : (
        <>
          <input
            id={qtyId}
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={e => onQtyChange?.(e.target.value)}
            placeholder="Qty"
            className={compactQtyCls}
          />
          <select
            id={unitId}
            value={unit}
            onChange={e => onUnitChange?.(e.target.value)}
            className={compactUnitCls}
          >
            <option value="">Select UOM…</option>
            {units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

export function SubProductDeliveryUnitFields({
  orderQty,
  orderUnit,
  packaging,
  readOnly = false,
  cogsLabel,
  cogsHint,
  onOrderQtyChange,
  onOrderUnitChange,
  onPackagingChange,
}: Props) {
  const units = getKnownRecipeUnits();
  const path = formatSubProductDeliveryUnitPath(orderQty, orderUnit, packaging);
  const orderEditable = !readOnly && Boolean(onOrderQtyChange && onOrderUnitChange);
  const packagingEditable = !readOnly && Boolean(onPackagingChange);

  function patchPackaging(patch: Partial<YieldPackagingLevels>) {
    onPackagingChange?.({ ...packaging, ...patch });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivery unit</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{path}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Order UOM is the production unit. Add Primary / Secondary Packaging when the batch breaks into smaller packs.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-muted-foreground w-36 shrink-0">{DELIVERY_UNIT_LEVEL_LABELS.order}</span>
            {orderEditable ? (
              <>
                <input
                  id="yield-quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={orderQty}
                  onChange={e => onOrderQtyChange?.(e.target.value)}
                  placeholder="e.g. 10"
                  className={compactQtyCls}
                  aria-label="Order Qty"
                />
                <select
                  id="yield-uom"
                  value={orderUnit}
                  onChange={e => onOrderUnitChange?.(e.target.value)}
                  className={compactUnitCls}
                  aria-label="Order UOM"
                >
                  <option value="">Select UOM…</option>
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <p className={`${compactQtyCls} bg-muted/30`}>{orderQty || '—'}</p>
                <p className={`${compactUnitCls} bg-muted/30`}>{orderUnit || '—'}</p>
              </>
            )}
          </div>
          {cogsLabel ? (
            <div className="shrink-0 min-w-[7rem]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
              <p className="text-sm font-semibold mt-1">{cogsLabel}</p>
              {cogsHint ? (
                <p className="text-[10px] text-muted-foreground mt-0.5">{cogsHint}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <PackagingRow
          label={DELIVERY_UNIT_LEVEL_LABELS.primary}
          qty={packaging.primaryQty}
          unit={packaging.primaryUnit}
          readOnly={!packagingEditable}
          qtyId="yield-primary-qty"
          unitId="yield-primary-uom"
          onQtyChange={value => patchPackaging({ primaryQty: value })}
          onUnitChange={value => patchPackaging({ primaryUnit: value })}
        />

        <PackagingRow
          label={DELIVERY_UNIT_LEVEL_LABELS.secondary}
          qty={packaging.secondaryQty}
          unit={packaging.secondaryUnit}
          readOnly={!packagingEditable}
          qtyId="yield-secondary-qty"
          unitId="yield-secondary-uom"
          onQtyChange={value => patchPackaging({ secondaryQty: value })}
          onUnitChange={value => patchPackaging({ secondaryUnit: value })}
        />
      </div>

    </div>
  );
}
