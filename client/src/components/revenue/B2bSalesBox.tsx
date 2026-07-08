import type { Product } from '../../api';
import { inputCls } from '../../data/componentForm';
import {
  b2bSalesUnitTitle,
  describeB2bDeliveryYieldResolution,
  getB2bDeliveryUnitChoices,
  summarizeB2bSalesUnit,
  type B2bSalesConfig,
  type B2bSalesUnitLine,
} from '../../data/productB2bSales';
import { formatSubProductBatchPackageUnit } from '../../data/productForm';
import type { DeliveryUnitBreakdown } from '../../data/vendorProductCatalog';

type Props = {
  config: B2bSalesConfig;
  linkedSubProduct: Product | null;
  disabled?: boolean;
  onChange: (config: B2bSalesConfig) => void;
};

function qtyInput(value: number, onChange: (value: number) => void, disabled?: boolean) {
  return (
    <input
      type="number"
      min={1}
      step={1}
      disabled={disabled}
      value={value}
      onChange={e => onChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
      className={`${inputCls} w-20 font-sans text-xs`}
    />
  );
}

function unitInput(
  value: string,
  options: string[],
  onChange: (unit: string) => void,
  listId: string,
  disabled?: boolean,
) {
  return (
    <>
      <input
        list={listId}
        disabled={disabled}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} w-28 font-sans text-xs`}
      />
      <datalist id={listId}>
        {options.map(unit => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  );
}

function DeliveryUnitEditor({
  delivery,
  linkedSubProduct,
  disabled,
  onChange,
  idPrefix,
  showTitle = true,
}: {
  delivery: DeliveryUnitBreakdown;
  linkedSubProduct: Product | null;
  disabled?: boolean;
  onChange: (delivery: DeliveryUnitBreakdown) => void;
  idPrefix: string;
  showTitle?: boolean;
}) {
  const unitChoices = getB2bDeliveryUnitChoices(linkedSubProduct);
  const batchLabel = linkedSubProduct ? formatSubProductBatchPackageUnit(linkedSubProduct) : null;
  const yieldResolution = describeB2bDeliveryYieldResolution(delivery, linkedSubProduct);
  const requireBreakdown = Boolean(linkedSubProduct);

  function patch(patch: Partial<DeliveryUnitBreakdown>) {
    onChange({ ...delivery, ...patch });
  }

  return (
    <div className="space-y-2 min-w-0">
      {showTitle ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>
      ) : null}
      {batchLabel && batchLabel !== '—' ? (
        <p className="text-[11px] text-muted-foreground">
          Batch UOM: <span className="font-medium text-foreground">{batchLabel}</span>
          {' '}· break down via Pack and Unit into smaller sellable units.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Order</span>
        {qtyInput(delivery.orderQty, orderQty => patch({ orderQty }), disabled)}
        {unitInput(delivery.orderUnit, unitChoices, orderUnit => patch({ orderUnit }), `${idPrefix}-order`, disabled)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Pack</span>
        {qtyInput(delivery.packQty, packQty => patch({ packQty }), disabled)}
        {unitInput(delivery.packUnit, unitChoices, packUnit => patch({ packUnit }), `${idPrefix}-pack`, disabled)}
      </div>

      {(requireBreakdown || delivery.packUnit !== delivery.orderUnit || delivery.packQty !== 1 || delivery.unitQty !== 1) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-16 shrink-0">Unit</span>
          {qtyInput(delivery.unitQty, unitQty => patch({ unitQty }), disabled)}
          {unitInput(delivery.unitUnit, unitChoices, unitUnit => patch({ unitUnit }), `${idPrefix}-unit`, disabled)}
        </div>
      )}

      {linkedSubProduct ? (
        <p className={`text-[11px] ${yieldResolution.ok ? 'text-muted-foreground' : 'text-amber-600'}`}>
          {yieldResolution.message}
        </p>
      ) : null}
    </div>
  );
}

function SalesUnitCard({
  title,
  line,
  linkedSubProduct,
  alternateIndex,
  disabled,
  onChange,
}: {
  title: string;
  line: B2bSalesUnitLine;
  linkedSubProduct: Product | null;
  alternateIndex?: number;
  disabled?: boolean;
  onChange: (line: B2bSalesUnitLine) => void;
}) {
  const summary = summarizeB2bSalesUnit(line, linkedSubProduct, alternateIndex);
  const cogsDisplay = linkedSubProduct && !summary.yieldResolution.ok
    ? '—'
    : `RM ${summary.cogs.toFixed(2)}`;
  const cogsPercentDisplay = linkedSubProduct && !summary.yieldResolution.ok
    ? '—'
    : summary.cogsPercent;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{summary.detailPath}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 items-stretch">
        <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-3 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown</p>
          <DeliveryUnitEditor
            delivery={line.delivery}
            linkedSubProduct={linkedSubProduct}
            disabled={disabled}
            idPrefix={line.key}
            showTitle={false}
            onChange={delivery => onChange({ ...line, delivery })}
          />
          <div className="mt-auto pt-1 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">RRP</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted-foreground">RM</span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={disabled}
                value={line.rrp}
                onChange={e => onChange({ ...line, rrp: e.target.value })}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS</p>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm font-semibold text-foreground">{cogsDisplay}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">COGS %</p>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm font-semibold text-foreground">{cogsPercentDisplay}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function B2bSalesBox({ config, linkedSubProduct, disabled = false, onChange }: Props) {
  function updatePrincipal(next: B2bSalesUnitLine) {
    onChange({ ...config, principal: { ...next, isPrincipal: true } });
  }

  function updateAlternate(index: number, next: B2bSalesUnitLine) {
    onChange({
      ...config,
      alternates: config.alternates.map((line, i) => (i === index ? { ...next, isPrincipal: false } : line)),
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">B2B Sales</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Define principal and alternate delivery units for wholesale sales. Each unit must break down from the sub-product batch UOM into smaller sellable units.
        </p>
        {linkedSubProduct ? (
          <p className="text-[11px] text-muted-foreground mt-1">
            Linked sub-product: <span className="font-medium text-foreground">{linkedSubProduct.name}</span>
            {' '}({linkedSubProduct.productId}) · {formatSubProductBatchPackageUnit(linkedSubProduct)} per batch
          </p>
        ) : (
          <p className="text-[11px] text-amber-600 mt-1">
            Select a sub-product in Product Component below to calculate delivery-unit COGS.
          </p>
        )}
      </div>

      <SalesUnitCard
        title={b2bSalesUnitTitle(config.principal)}
        line={config.principal}
        linkedSubProduct={linkedSubProduct}
        disabled={disabled}
        onChange={updatePrincipal}
      />

      {config.alternates.map((line, index) => (
        <SalesUnitCard
          key={line.key}
          title={b2bSalesUnitTitle(line, index)}
          line={line}
          linkedSubProduct={linkedSubProduct}
          alternateIndex={index}
          disabled={disabled}
          onChange={next => updateAlternate(index, next)}
        />
      ))}
    </section>
  );
}
