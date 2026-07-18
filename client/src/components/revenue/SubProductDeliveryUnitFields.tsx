import { getKnownRecipeUnits } from '../../data/componentCatalogConfig';
import {
  DELIVERY_UNIT_LEVEL_LABELS,
} from '../../data/vendorProductCatalog';
import {
  formatSubProductDeliveryUnitPath,
  type YieldPackagingLevels,
} from '../../data/productBatchUom';

const compactQtyCls =
  'w-16 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const compactUnitCls =
  'min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary';

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

function LevelCell({
  label,
  qty,
  unit,
  readOnly,
  qtyId,
  unitId,
  qtyPlaceholder = 'Qty',
  onQtyChange,
  onUnitChange,
}: {
  label: string;
  qty: string;
  unit: string;
  readOnly?: boolean;
  qtyId: string;
  unitId: string;
  qtyPlaceholder?: string;
  onQtyChange?: (value: string) => void;
  onUnitChange?: (value: string) => void;
}) {
  const units = getKnownRecipeUnits();
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </p>
      {readOnly ? (
        <div className="flex items-center gap-1.5">
          <p className={`${compactQtyCls} bg-muted/30`}>{qty || '—'}</p>
          <p className={`${compactUnitCls} bg-muted/30`}>{unit || '—'}</p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            id={qtyId}
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={e => onQtyChange?.(e.target.value)}
            placeholder={qtyPlaceholder}
            className={compactQtyCls}
            aria-label={`${label} qty`}
          />
          <select
            id={unitId}
            value={unit}
            onChange={e => onUnitChange?.(e.target.value)}
            className={compactUnitCls}
            aria-label={`${label} UOM`}
          >
            <option value="">UOM…</option>
            {units.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
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

      <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>

        <div className={`grid gap-3 items-start ${cogsLabel ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <LevelCell
            label={DELIVERY_UNIT_LEVEL_LABELS.order}
            qty={orderQty}
            unit={orderUnit}
            readOnly={!orderEditable}
            qtyId="yield-quantity"
            unitId="yield-uom"
            qtyPlaceholder="e.g. 10"
            onQtyChange={onOrderQtyChange}
            onUnitChange={onOrderUnitChange}
          />
          <LevelCell
            label={DELIVERY_UNIT_LEVEL_LABELS.primary}
            qty={packaging.primaryQty}
            unit={packaging.primaryUnit}
            readOnly={!packagingEditable}
            qtyId="yield-primary-qty"
            unitId="yield-primary-uom"
            onQtyChange={value => patchPackaging({ primaryQty: value })}
            onUnitChange={value => patchPackaging({ primaryUnit: value })}
          />
          <LevelCell
            label={DELIVERY_UNIT_LEVEL_LABELS.secondary}
            qty={packaging.secondaryQty}
            unit={packaging.secondaryUnit}
            readOnly={!packagingEditable}
            qtyId="yield-secondary-qty"
            unitId="yield-secondary-uom"
            onQtyChange={value => patchPackaging({ secondaryQty: value })}
            onUnitChange={value => patchPackaging({ secondaryUnit: value })}
          />
          {cogsLabel ? (
            <div className="min-w-0 space-y-1">
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
